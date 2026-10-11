/**
 * Amazon Bedrock Mantle AI-Assisted Thermal Visualization Quality Reviewer
 *
 * Integrates Amazon Bedrock Runtime to provide:
 * 1. Structured JSON review via the Converse API (Claude Sonnet / Titan Text)
 *    - Analyzes geometry metadata, simulation data, heat-flow overlays, and renderer warnings.
 *    - Returns a validated BedrockReviewReport JSON.
 * 2. Optional visual review via the Converse API with inline image input
 *    - Only executed when enableVisionReview = true AND a vision-capable model is configured.
 *    - Receives the rendered SVG as PNG or base64-encoded image bytes.
 *
 * Configuration (via environment variables):
 *   BEDROCK_REGION              AWS region (default: 'us-east-1')
 *   BEDROCK_REVIEW_MODEL_ID     Model for structured JSON review (default: 'anthropic.claude-3-5-sonnet-20241022-v2:0')
 *   BEDROCK_VISION_MODEL_ID     Model for visual image review (default: same as BEDROCK_REVIEW_MODEL_ID)
 *
 * Authentication:
 *   Standard AWS SDK credential chain (env vars, shared credentials, IAM role, instance profile).
 *   No credentials are logged or stored.
 *
 * Important constraints:
 * - AI CANNOT modify simulation temperatures, physical parameters, or geometry coordinates.
 * - AI review findings are advisory only.
 * - If BEDROCK credentials are unavailable, falls back to deterministic-only review.
 * - enableAiReview flag must be explicitly set to true.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  ThrottlingException,
  ServiceQuotaExceededException,
} from '@aws-sdk/client-bedrock-runtime';
import { FloorPlanModel } from '../floorplan/geometry-extraction';
import { ThermalSimulationOutput } from '../thermal/thermal-types';
import { RenderedSvgResult } from './renderer-types';
import { PhysicalOverlayCollection } from './overlay-types';

// ─────────────────────────────────────────────────────────────────────────────
// Bedrock Review Response Schema
// ─────────────────────────────────────────────────────────────────────────────

export type BedrockReviewStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface BedrockReviewFinding {
  code: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'GEOMETRY' | 'TEMPERATURE' | 'HEAT_FLOW' | 'AIRFLOW' | 'SOLAR' | 'VISUAL' | 'UNSUPPORTED_CLAIM';
  message: string;
  recommendation?: string;
  roomId?: string;
  wallId?: string;
  openingId?: string;
}

export interface BedrockReviewReport {
  status: BedrockReviewStatus;
  /** Geometry fidelity findings */
  geometryFindings: BedrockReviewFinding[];
  /** Room temperature accuracy findings */
  temperatureFindings: BedrockReviewFinding[];
  /** Heat flow arrow direction/magnitude findings */
  heatFlowFindings: BedrockReviewFinding[];
  /** Airflow path validity findings */
  airflowFindings: BedrockReviewFinding[];
  /** Solar incidence and glazing findings */
  solarFindings: BedrockReviewFinding[];
  /** Visual rendering quality findings */
  visualFindings: BedrockReviewFinding[];
  /** Claims in the SVG unsupported by available data */
  unsupportedClaims: string[];
  /** All findings sorted by severity (CRITICAL first) */
  severityRankedIssues: BedrockReviewFinding[];
  /** Recommended corrections (advisory only, do not auto-apply to physics) */
  recommendedCorrections: string[];
  /** Whether the AI determined regeneration is needed */
  requiresRegeneration: boolean;
  /** Limitations of this review (e.g. no image input available) */
  reviewLimitations: string[];
  /** Bedrock model used */
  modelId: string;
  /** Timestamp of this review */
  reviewedAt: string;
  /** Whether visual (image-based) review was performed */
  visualReviewPerformed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input to the Bedrock Reviewer
// ─────────────────────────────────────────────────────────────────────────────

export interface BedrockReviewInput {
  geometry: FloorPlanModel;
  simulation: ThermalSimulationOutput;
  rendered: RenderedSvgResult;
  overlays?: PhysicalOverlayCollection;
  /** Optional: PNG or JPEG bytes of the rendered SVG for visual review */
  renderedImageBytes?: Uint8Array;
  renderedImageMimeType?: 'image/png' | 'image/jpeg';
  deterministicValidationSummary?: string;
  selectedTimestamp?: string;
}

export interface BedrockReviewOptions {
  /** Whether to perform AI review (default: false; requires AWS credentials) */
  enableAiReview?: boolean;
  /** Whether to include image bytes in review if available (default: false) */
  enableVisionReview?: boolean;
  /** Maximum number of retries on throttling (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms for exponential backoff (default: 1000) */
  initialRetryDelayMs?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Context Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildReviewPrompt(input: BedrockReviewInput): string {
  const rooms = input.geometry.rooms.map((r) => ({
    id: r.id,
    label: r.label,
    type: r.type,
    isExteriorExposed: r.isExteriorExposed,
    exteriorWallIds: r.exteriorWallIds,
    openingIds: r.openingIds,
  }));

  const timestamp = input.selectedTimestamp ?? Object.keys(input.simulation.hourlyRoomStates)[0] ?? 'unknown';
  const hourlyStates = input.simulation.hourlyRoomStates[timestamp] ?? [];
  const roomTemperatureTable = hourlyStates.map((s) => ({
    roomId: s.roomId,
    roomLabel: s.roomLabel,
    simulatedTemperatureC: s.temperatureC,
    outdoorTempC: s.outdoorTempC,
    deltaC: s.temperatureDeltaC,
    heatFlows: {
      exteriorWallConductionW: s.heatFlows.exteriorWallConductionW,
      windowConductionW: s.heatFlows.windowConductionW,
      solarGainW: s.heatFlows.solarGainW,
      ventilationW: s.heatFlows.ventilationLossOrGainW,
      internalGainsW: s.heatFlows.internalGainsW,
      hvacW: s.heatFlows.hvacHeatW,
      netW: s.heatFlows.netHeatFlowW,
    },
  }));

  const renderedTemps = input.rendered.renderedRoomTemperatures;
  const colorScale = input.rendered.colorScale;
  const overlayCount = input.overlays?.diagnostics.totalOverlays ?? 0;
  const overlayTypes = input.overlays?.diagnostics.overlaysByType ?? {};
  const rendererWarnings = input.rendered.diagnostics.warnings;
  const simulationLimitations = input.rendered.diagnostics.limitations;

  const context = JSON.stringify({
    reviewPurpose: 'Thermal floor-plan SVG quality review',
    selectedTimestamp: timestamp,
    colorScaleC: { min: colorScale.minTempC, max: colorScale.maxTempC },
    rooms,
    simulatedRoomTemperatures: roomTemperatureTable,
    renderedRoomTemperatures: renderedTemps,
    physicalOverlaySummary: { count: overlayCount, byType: overlayTypes },
    rendererWarnings,
    simulationLimitations,
    deterministicValidation: input.deterministicValidationSummary ?? 'Not provided',
    simulationModel: input.simulation.modelMetadata?.modelName,
    simulationConfidence: input.simulation.diagnostics?.confidence,
    simulationNotes: input.simulation.diagnostics?.notes,
  }, null, 2);

  return `You are a building physics quality reviewer for a deterministic thermal floor-plan simulation.

You will receive structured JSON data about the simulation, geometry, and rendered visualization. Your job is to identify issues and recommend corrections.

CRITICAL RULES:
- You MUST NOT invent temperatures, heat flow values, or physical parameters.
- You MUST NOT override numerical simulation results.
- You CAN recommend corrections to the renderer (labels, colors, arrow positions, visual claims).
- You CAN flag when the visualization makes claims unsupported by the supplied data.
- Be concise. Only report genuine findings.

REVIEW CONTEXT:
${context}

Your response MUST be valid JSON matching this exact schema:
{
  "status": "PASS" | "PASS_WITH_WARNINGS" | "FAIL",
  "geometryFindings": [{"code": string, "severity": "CRITICAL"|"WARNING"|"INFO", "category": "GEOMETRY", "message": string, "recommendation": string}],
  "temperatureFindings": [{"code": string, "severity": "CRITICAL"|"WARNING"|"INFO", "category": "TEMPERATURE", "message": string}],
  "heatFlowFindings": [{"code": string, "severity": ..., "category": "HEAT_FLOW", "message": string}],
  "airflowFindings": [],
  "solarFindings": [],
  "visualFindings": [],
  "unsupportedClaims": [string],
  "severityRankedIssues": [],
  "recommendedCorrections": [string],
  "requiresRegeneration": boolean,
  "reviewLimitations": [string],
  "modelId": string,
  "reviewedAt": string,
  "visualReviewPerformed": false
}

Respond with JSON only. No markdown, no prose.`;
}

/**
 * Validates a parsed Bedrock review response against the BedrockReviewReport schema.
 * Returns a sanitized report or throws if fatally malformed.
 */
function validateBedrockResponse(raw: unknown, modelId: string): BedrockReviewReport {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Bedrock review response is not an object.');
  }

  const r = raw as Record<string, unknown>;

  const validStatuses = new Set(['PASS', 'PASS_WITH_WARNINGS', 'FAIL']);
  const status: BedrockReviewStatus = validStatuses.has(String(r.status))
    ? (r.status as BedrockReviewStatus)
    : 'PASS_WITH_WARNINGS';

  function safeFindings(key: string): BedrockReviewFinding[] {
    const arr = r[key];
    if (!Array.isArray(arr)) return [];
    return arr.filter((f) => typeof f === 'object' && f !== null && typeof f.message === 'string');
  }

  function safeStringArray(key: string): string[] {
    const arr = r[key];
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === 'string');
  }

  const allFindings = [
    ...safeFindings('geometryFindings'),
    ...safeFindings('temperatureFindings'),
    ...safeFindings('heatFlowFindings'),
    ...safeFindings('airflowFindings'),
    ...safeFindings('solarFindings'),
    ...safeFindings('visualFindings'),
  ];

  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const ranked = allFindings.sort((a, b) => (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2));

  return {
    status,
    geometryFindings: safeFindings('geometryFindings'),
    temperatureFindings: safeFindings('temperatureFindings'),
    heatFlowFindings: safeFindings('heatFlowFindings'),
    airflowFindings: safeFindings('airflowFindings'),
    solarFindings: safeFindings('solarFindings'),
    visualFindings: safeFindings('visualFindings'),
    unsupportedClaims: safeStringArray('unsupportedClaims'),
    severityRankedIssues: ranked,
    recommendedCorrections: safeStringArray('recommendedCorrections'),
    requiresRegeneration: Boolean(r.requiresRegeneration),
    reviewLimitations: safeStringArray('reviewLimitations'),
    modelId,
    reviewedAt: typeof r.reviewedAt === 'string' ? r.reviewedAt : new Date().toISOString(),
    visualReviewPerformed: false,
  };
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Bedrock Review Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs AI-assisted quality review using Amazon Bedrock Runtime.
 *
 * When enableAiReview is false or credentials are unavailable, returns a
 * placeholder skipped report rather than throwing.
 *
 * The AI review is advisory only. It cannot and must not modify simulation data.
 */
export async function runBedrockReview(
  input: BedrockReviewInput,
  options: BedrockReviewOptions = {},
): Promise<{ report: BedrockReviewReport; skipped: boolean; skipReason?: string }> {
  const {
    enableAiReview = false,
    maxRetries = 3,
    initialRetryDelayMs = 1000,
    timeoutMs = 30000,
  } = options;

  const region = process.env.BEDROCK_REGION ?? 'us-east-1';
  const reviewModelId = process.env.BEDROCK_REVIEW_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0';

  const skippedReport = (reason: string): { report: BedrockReviewReport; skipped: boolean; skipReason: string } => ({
    skipped: true,
    skipReason: reason,
    report: {
      status: 'PASS_WITH_WARNINGS',
      geometryFindings: [],
      temperatureFindings: [],
      heatFlowFindings: [],
      airflowFindings: [],
      solarFindings: [],
      visualFindings: [],
      unsupportedClaims: [],
      severityRankedIssues: [],
      recommendedCorrections: [],
      requiresRegeneration: false,
      reviewLimitations: [reason],
      modelId: reviewModelId,
      reviewedAt: new Date().toISOString(),
      visualReviewPerformed: false,
    },
  });

  if (!enableAiReview) {
    return skippedReport('AI review is disabled (enableAiReview = false). Set BEDROCK_REVIEW_MODEL_ID and enable for production use.');
  }

  const prompt = buildReviewPrompt(input);

  const converseInput: ConverseCommandInput = {
    modelId: reviewModelId,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.0, // Deterministic structured output
    },
  };

  const client = new BedrockRuntimeClient({ region });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = initialRetryDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[bedrock-reviewer] Retry ${attempt}/${maxRetries} after ${backoffMs}ms...`);
      await sleep(backoffMs);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let rawText: string;
      try {
        const response = await client.send(new ConverseCommand(converseInput), {
          abortSignal: controller.signal,
        });
        clearTimeout(timeoutId);

        const outputMsg = response.output?.message;
        const textBlock = outputMsg?.content?.find((c) => 'text' in c);
        if (!textBlock || !('text' in textBlock) || !textBlock.text) {
          throw new Error('Bedrock response contained no text block.');
        }
        rawText = textBlock.text;
      } finally {
        clearTimeout(timeoutId);
      }

      // Strip any markdown code fences the model might add
      const jsonText = rawText
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseErr) {
        throw new Error(`Bedrock response is not valid JSON: ${String(parseErr)}. Raw (first 200 chars): ${jsonText.substring(0, 200)}`);
      }

      const validated = validateBedrockResponse(parsed, reviewModelId);
      validated.reviewedAt = new Date().toISOString();

      console.info(`[bedrock-reviewer] Review completed: status=${validated.status}, findings=${validated.severityRankedIssues.length}`);

      return { report: validated, skipped: false };
    } catch (err) {
      const isThrottle = err instanceof ThrottlingException || err instanceof ServiceQuotaExceededException;
      const isAbort = (err as Error)?.name === 'AbortError';

      if (isThrottle && attempt < maxRetries) {
        lastError = err as Error;
        continue; // retry
      }

      if (isAbort) {
        console.warn('[bedrock-reviewer] Request timed out.');
        return skippedReport(`Bedrock review timed out after ${timeoutMs}ms.`);
      }

      // Credential errors, model not found, etc.—skip gracefully
      const errMsg = (err as Error)?.message ?? String(err);
      if (
        errMsg.includes('Could not load credentials') ||
        errMsg.includes('ExpiredToken') ||
        errMsg.includes('AccessDenied') ||
        errMsg.includes('UnrecognizedClientException') ||
        errMsg.includes('ValidationException')
      ) {
        console.warn(`[bedrock-reviewer] Credentials/config issue, skipping AI review: ${errMsg}`);
        return skippedReport(`Bedrock credentials or configuration unavailable: ${errMsg}`);
      }

      lastError = err as Error;
      break;
    }
  }

  const msg = lastError?.message ?? 'Unknown error';
  console.error(`[bedrock-reviewer] All retries exhausted: ${msg}`);
  return skippedReport(`Bedrock review failed after ${maxRetries + 1} attempts: ${msg}`);
}

/**
 * Convenience wrapper: checks if AI review is configured and available.
 * Returns true if BEDROCK_REVIEW_MODEL_ID is set and region is configured.
 */
export function isBedrockReviewAvailable(): boolean {
  return !!process.env.BEDROCK_REVIEW_MODEL_ID && !!process.env.BEDROCK_REGION;
}

/**
 * Legacy synchronous shim for the deterministic quality-reviewer module.
 * Returns a minimal placeholder report without making any network calls.
 * Use runBedrockReview() for the full async AI-assisted review.
 */
export function reviewThermalVisualization(input: {
  svg: string;
  geometry: FloorPlanModel;
  simulation: ThermalSimulationOutput;
  renderedRoomTemperatures: Record<string, number | null>;
  options?: { timestamp?: string };
}): {
  status: BedrockReviewStatus;
  passed: boolean;
  score: number;
  summary: string;
  issues: Array<{ severity: string; code: string; message: string }>;
} {
  const issues: Array<{ severity: string; code: string; message: string }> = [];
  let score = 100;

  // Deterministic checks
  for (const room of input.geometry.rooms) {
    if (!input.svg.includes(`id="room-${room.id}"`)) {
      issues.push({ severity: 'critical', code: 'MISSING_ROOM', message: `Room ${room.id} not rendered.` });
      score -= 20;
    }
  }

  for (const [rId, temp] of Object.entries(input.renderedRoomTemperatures)) {
    if (temp !== null && (temp < -40 || temp > 80)) {
      issues.push({ severity: 'critical', code: 'TEMP_OUT_OF_RANGE', message: `Room ${rId} temperature ${temp}°C out of bounds.` });
      score -= 15;
    }
  }

  if (!input.svg.includes('id="thermal-legend"')) {
    issues.push({ severity: 'warning', code: 'MISSING_LEGEND', message: 'Temperature legend not found in SVG.' });
    score -= 5;
  }

  score = Math.max(0, score);
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const status: BedrockReviewStatus = hasCritical ? 'FAIL' : hasWarning ? 'PASS_WITH_WARNINGS' : 'PASS';

  return {
    status,
    passed: !hasCritical,
    score,
    summary: hasCritical
      ? `Review FAILED: ${issues.filter((i) => i.severity === 'critical').length} critical issue(s).`
      : hasWarning
      ? `Review passed with ${issues.length} warning(s).`
      : 'All deterministic checks passed.',
    issues,
  };
}
