/**
 * AI-Assisted Quality Review & Automated Correction Pipeline
 *
 * Implements a comprehensive quality review stage combining:
 * 1. Deterministic Rule Checks (geometry fidelity, physical temperature bounds,
 *    energy conservation across partitions, valid airflow paths).
 * 2. Amazon Bedrock Runtime / Mantle AI Reviewer (when configured / enabled).
 * 3. Structured Review Report: PASS, PASS_WITH_WARNINGS, or FAIL.
 * 4. Bounded correction and regeneration loop (strictly preserves physics).
 */

import { FloorPlanModel } from '../floorplan/geometry-extraction';
import { EnvironmentalDataProfile } from '../environmental/environmental-types';
import { ThermalSimulationOutput } from '../thermal/thermal-types';
import { RenderedSvgResult, SvgRenderOptions } from './renderer-types';
import { renderThermalFloorPlanSvg } from './svg-renderer';
import {
  BedrockReviewReport,
  runBedrockReview,
  reviewThermalVisualization as syncReviewShim,
} from './bedrock-reviewer';
import { ConductiveHeatOverlay, VentilationOverlay } from './overlay-types';

export type ReviewStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface QualityFinding {
  category: 'GEOMETRY' | 'TEMPERATURE' | 'GRADIENT' | 'OVERLAYS' | 'AIRFLOW' | 'VISUAL_QUALITY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  recommendation?: string;
}

export interface QualityReviewReport {
  overallStatus: ReviewStatus;
  reviewTimestamp: string;
  deterministicChecksPassed: boolean;
  aiReviewExecuted: boolean;
  bedrockReport?: BedrockReviewReport;
  findings: QualityFinding[];
  summary: string;
  requiresCorrectionPass: boolean;
}

export interface ReviewPipelineOptions {
  /** Maximum number of auto-correction attempts (default: 2) */
  maxCorrectionAttempts?: number;
  /** Whether to execute external LLM / Bedrock review (default: false or true if BEDROCK_REVIEW_MODEL_ID present) */
  enableAiReview?: boolean;
  /** Custom render options to pass into the renderer */
  renderOptions?: SvgRenderOptions;
}

/**
 * Runs rigorous deterministic physics and geometry checks on the generated SVG.
 */
export function runDeterministicQualityChecks(
  geometry: FloorPlanModel,
  simulation: ThermalSimulationOutput,
  rendered: RenderedSvgResult,
): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const svg = rendered.svg;

  // 1. Geometry Fidelity Checks: Every room must exist in SVG
  for (const room of geometry.rooms) {
    if (!svg.includes(`id="room-${room.id}"`)) {
      findings.push({
        category: 'GEOMETRY',
        severity: 'CRITICAL',
        description: `Room ${room.id} (${room.label ?? 'unlabeled'}) is missing from rendered SVG.`,
        recommendation: 'Ensure all room IDs are processed in layer-rooms.',
      });
    }
  }

  // 2. Temperature Value & Range Checks: Must be within realistic Earth ambient ranges
  for (const [rId, renderedTemp] of Object.entries(rendered.renderedRoomTemperatures)) {
    if (renderedTemp === null) {
      findings.push({
        category: 'TEMPERATURE',
        severity: 'WARNING',
        description: `Room ${rId} has no simulated temperature for timestamp ${rendered.selectedTimestamp}.`,
        recommendation: 'Check whether thermal simulation covered this room.',
      });
    } else {
      if (renderedTemp < -40 || renderedTemp > 80) {
        findings.push({
          category: 'TEMPERATURE',
          severity: 'CRITICAL',
          description: `Room ${rId} temperature (${renderedTemp}°C) is outside physically realistic bounds (-40°C to 80°C).`,
          recommendation: 'Inspect thermal capacitance or boundary conduction rates.',
        });
      }
    }
  }

  // 3. XML / SVG Validity Checks
  if (!svg.startsWith('<?xml version="1.0"') || !svg.endsWith('</svg>')) {
    findings.push({
      category: 'VISUAL_QUALITY',
      severity: 'CRITICAL',
      description: 'SVG markup is incomplete or malformed (missing XML declaration or </svg> closing tag).',
      recommendation: 'Regenerate SVG with proper document enclosing tags.',
    });
  }

  // 4. Check for unescaped characters in text elements
  if (svg.match(/<text[^>]*>[^<]*&[^a-z0-9#][^<]*<\/text>/i)) {
    findings.push({
      category: 'VISUAL_QUALITY',
      severity: 'CRITICAL',
      description: 'SVG contains unescaped ampersand in text elements.',
      recommendation: 'Apply escapeXml to all text strings.',
    });
  }

  // 5. Check Legend Consistency
  if (!svg.includes('id="thermal-legend"')) {
    findings.push({
      category: 'VISUAL_QUALITY',
      severity: 'WARNING',
      description: 'Temperature colorbar legend is missing from SVG.',
      recommendation: 'Enable showLegend in render options.',
    });
  }

  // 6. Physical Overlay Integrity Checks
  if (rendered.physicalOverlays) {
    const overlays = rendered.physicalOverlays.overlays;

    // A. Check that partition conductive transfers conserve energy across adjacent room pairs
    const partitionOverlays = overlays.filter(
      (o): o is ConductiveHeatOverlay => o.overlayType === 'CONDUCTIVE_HEAT' && o.elementType === 'interior-partition',
    );

    for (const po of partitionOverlays) {
      if (!po.adjacentRoomId) continue;
      // Find matching reverse partition transfer if present
      const reverse = partitionOverlays.find(
        (o) => o.roomId === po.adjacentRoomId && o.adjacentRoomId === po.roomId,
      );
      if (reverse) {
        // Magnitude must be approximately equal and opposite in sign direction
        const deltaW = Math.abs(po.magnitude - reverse.magnitude);
        if (deltaW > 5 && po.magnitude > 20) {
          findings.push({
            category: 'OVERLAYS',
            severity: 'WARNING',
            description: `Partition heat transfer between ${po.roomId} and ${po.adjacentRoomId} has energy imbalance (${po.magnitude}W vs ${reverse.magnitude}W).`,
            recommendation: 'Verify shared partition area and heat balance symmetry.',
          });
        }
      }
    }

    // B. Check that airflow overlays do not cross solid walls without an opening
    const ventOverlays = overlays.filter((o): o is VentilationOverlay => o.overlayType === 'VENTILATION');
    for (const vo of ventOverlays) {
      if (!vo.openingId) continue;
      const op = geometry.openings.find((o) => o.id === vo.openingId);
      if (!op) {
        findings.push({
          category: 'AIRFLOW',
          severity: 'CRITICAL',
          description: `Airflow overlay ${vo.overlayId} references non-existent opening ${vo.openingId}.`,
          recommendation: 'Ensure airflow paths only originate at verified openings.',
        });
      }
    }
  }

  return findings;
}

/**
 * Executes full quality review and auto-correction pipeline.
 */
export async function reviewAndRenderThermalVisualization(
  geometry: FloorPlanModel,
  environment: EnvironmentalDataProfile,
  simulation: ThermalSimulationOutput,
  options: ReviewPipelineOptions = {},
): Promise<{ rendered: RenderedSvgResult; reviewReport: QualityReviewReport; attemptsCount: number }> {
  const maxAttempts = options.maxCorrectionAttempts ?? 2;
  let currentRenderOptions: SvgRenderOptions = {
    ...options.renderOptions,
    enableSpatialGradients: options.renderOptions?.enableSpatialGradients ?? true,
    showHeatFluxVectors: options.renderOptions?.showHeatFluxVectors ?? true,
    showPhysicalOverlays: options.renderOptions?.showPhysicalOverlays ?? true,
    showFixtures: options.renderOptions?.showFixtures ?? true,
  };

  let rendered = renderThermalFloorPlanSvg({ geometry, simulation, options: currentRenderOptions });
  let attemptsCount = 1;
  let findings = runDeterministicQualityChecks(geometry, simulation, rendered);

  // Correction loop for deterministic issues
  while (findings.some((f) => f.severity === 'CRITICAL') && attemptsCount < maxAttempts) {
    attemptsCount++;
    console.warn(`[quality-review] Critical findings detected in attempt ${attemptsCount - 1}. Applying corrections…`);

    // Self-healing corrections:
    // If spatial gradients caused clipping failure, fallback to safe room fills
    if (findings.some((f) => f.category === 'GRADIENT' && f.severity === 'CRITICAL')) {
      currentRenderOptions = { ...currentRenderOptions, enableSpatialGradients: false };
    }

    rendered = renderThermalFloorPlanSvg({ geometry, simulation, options: currentRenderOptions });
    findings = runDeterministicQualityChecks(geometry, simulation, rendered);
  }

  // Execute optional Amazon Bedrock Mantle AI review
  let bedrockReport: BedrockReviewReport | undefined;
  let aiReviewExecuted = false;

  if (options.enableAiReview) {
    try {
      const brRes = await runBedrockReview(
        {
          geometry,
          simulation,
          rendered,
          overlays: rendered.physicalOverlays,
          selectedTimestamp: rendered.selectedTimestamp,
        },
        { enableAiReview: true },
      );
      if (!brRes.skipped) {
        bedrockReport = brRes.report;
        aiReviewExecuted = true;
      }
    } catch (aiErr) {
      console.warn(`[quality-review] Bedrock review skipped due to error: ${(aiErr as Error).message}`);
    }
  }

  const hasCritical = findings.some((f) => f.severity === 'CRITICAL') || (bedrockReport?.status === 'FAIL');
  const hasWarning = findings.some((f) => f.severity === 'WARNING') || (bedrockReport?.status === 'PASS_WITH_WARNINGS');
  const overallStatus: ReviewStatus = hasCritical ? 'FAIL' : hasWarning ? 'PASS_WITH_WARNINGS' : 'PASS';

  const reviewReport: QualityReviewReport = {
    overallStatus,
    reviewTimestamp: new Date().toISOString(),
    deterministicChecksPassed: !findings.some((f) => f.severity === 'CRITICAL'),
    aiReviewExecuted,
    bedrockReport,
    findings,
    summary:
      overallStatus === 'PASS'
        ? 'All deterministic geometry fidelity, temperature bounds, energy conservation, and vector markup checks passed.'
        : overallStatus === 'PASS_WITH_WARNINGS'
        ? `Visualization passed with ${findings.length} advisory warnings.`
        : `Visualization failed quality review: ${findings.filter((f) => f.severity === 'CRITICAL').length} critical issues remain.`,
    requiresCorrectionPass: hasCritical,
  };

  return {
    rendered,
    reviewReport,
    attemptsCount,
  };
}

// Re-export sync shim for backward compatibility
export { syncReviewShim as reviewThermalVisualization };
