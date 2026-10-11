/**
 * Unit Tests for SVG Thermal Floor-Plan Vector Renderer
 *
 * Validates:
 * 1. Valid standalone SVG document markup generation.
 * 2. Proper polygon coordinate representation in room layers.
 * 3. Temperature-to-color mapping and colorbar gradient stops.
 * 4. Missing room temperature visual handling (neutral fallback and diagnostics reporting).
 * 5. Deterministic color consistency across multiple simulation hours.
 * 6. Aspect ratio and viewBox bounds preservation.
 * 7. XML / SVG string escaping of room labels and titles.
 * 8. Preservation of geometry warnings and simulation limitations.
 * 9. True North orientation arrow inclusion when orientation data is present.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { renderThermalFloorPlanSvg } from '../../services/renderer/svg-renderer';
import { temperatureToColor } from '../../services/renderer/temperature-colormap';
import { FloorPlanModel } from '../../services/floorplan/geometry-extraction';
import { ThermalSimulationOutput } from '../../services/thermal/thermal-types';

const sampleGeometry: FloorPlanModel = {
  schemaVersion: '1.0',
  imageMetadata: {
    source: 'sample_floor.png',
    widthPixels: 1000,
    heightPixels: 800,
    analyzedAt: '2026-10-11T12:00:00Z',
    modelId: 'gemini-2.5-flash',
  },
  buildingMetadata: {
    title: 'Modern House <Ground Floor> & "Annex"', // XML characters to test escaping
    totalFloors: 1,
    totalFloorsSource: 'annotated',
  },
  orientation: {
    northAngleDeg: 45,
    northAngleSource: 'annotated',
    confidence: 'high',
  },
  rooms: [
    {
      id: 'R1',
      label: 'Living Room & Kitchen',
      type: 'living',
      typeSource: 'annotated',
      boundary: {
        points: [
          { x: 100, y: 100 },
          { x: 400, y: 100 },
          { x: 400, y: 350 },
          { x: 100, y: 350 },
        ],
      },
      boundingBox: { x: 100, y: 100, width: 300, height: 250 },
      wallIds: ['W1', 'W2'],
      openingIds: ['O1'],
      adjacentRoomIds: ['R2'],
      connectedRoomIds: ['R2'],
      isExteriorExposed: true,
      exteriorWallIds: ['W1'],
      fixtures: [],
      confidence: 'high',
      validationWarnings: ['SCALE_INCONSISTENCY: Slight distortion detected'],
    },
    {
      id: 'R2',
      label: 'Bedroom',
      type: 'bedroom',
      typeSource: 'annotated',
      boundary: {
        points: [
          { x: 400, y: 100 },
          { x: 700, y: 100 },
          { x: 700, y: 350 },
          { x: 400, y: 350 },
        ],
      },
      boundingBox: { x: 400, y: 100, width: 300, height: 250 },
      wallIds: ['W2', 'W3'],
      openingIds: [],
      adjacentRoomIds: ['R1'],
      connectedRoomIds: ['R1'],
      isExteriorExposed: true,
      exteriorWallIds: ['W3'],
      fixtures: [],
      confidence: 'high',
      validationWarnings: [],
    },
  ],
  walls: [
    {
      id: 'W1',
      startPoint: { x: 100, y: 100 },
      endPoint: { x: 400, y: 100 },
      boundingRoomIds: ['R1'],
      isExterior: true,
      isExteriorSource: 'annotated',
      isLoadBearingSource: 'inferred',
      confidence: 'high',
    },
    {
      id: 'W2',
      startPoint: { x: 400, y: 100 },
      endPoint: { x: 400, y: 350 },
      boundingRoomIds: ['R1', 'R2'],
      isExterior: false,
      isExteriorSource: 'annotated',
      isLoadBearingSource: 'inferred',
      confidence: 'high',
    },
    {
      id: 'W3',
      startPoint: { x: 700, y: 100 },
      endPoint: { x: 700, y: 350 },
      boundingRoomIds: ['R2'],
      isExterior: true,
      isExteriorSource: 'annotated',
      isLoadBearingSource: 'inferred',
      confidence: 'high',
    },
  ],
  openings: [
    {
      id: 'O1',
      type: 'window-casement',
      wallId: 'W1',
      positionOnWall: { x: 250, y: 100 },
      connectsSpaceIds: ['R1'],
      isExterior: true,
      confidence: 'high',
      source: 'annotated',
    },
  ],
  annotations: [],
  adjacencyGraph: { R1: ['R2'], R2: ['R1'] },
  connectivityGraph: { R1: ['R2'], R2: ['R1'] },
  exteriorExposedRoomIds: ['R1', 'R2'],
  incompleteBoundaryRoomIds: [],
  validationWarnings: [{ severity: 'warning', code: 'SCALE_INCONSISTENCY', message: 'Slight distortion detected' }],
  unresolvedAmbiguities: [],
  createdAt: '2026-10-11T12:00:00Z',
};

const sampleSimulation: ThermalSimulationOutput = {
  simulationId: 'sim_test_123',
  status: 'COMPLETED',
  modelMetadata: {
    modelName: 'Lumped Capacitance',
    version: '1.0.0',
    numericalMethod: 'Explicit Euler (dt = 60s)',
    subTimestepSeconds: 60,
    description: 'Dynamic room heat balance',
  },
  simulationPeriod: {
    startTimestamp: '2026-10-11T12:00:00Z',
    endTimestamp: '2026-10-11T13:00:00Z',
    totalHours: 2,
  },
  environmentalProvenance: {
    locationName: 'Delhi Site',
    latitude: 28.61,
    longitude: 77.21,
    elevationM: 215,
    timezone: 'Asia/Kolkata',
    provider: 'Open-Meteo',
  },
  buildingAssumptions: {} as any,
  roomGeometries: {} as any,
  initialRoomTemperatures: { R1: 24.0, R2: 24.0 },
  hourlyRoomStates: {
    '2026-10-11T12:00:00Z': [
      {
        roomId: 'R1',
        roomLabel: 'Living Room & Kitchen',
        timestamp: '2026-10-11T12:00:00Z',
        temperatureC: 28.5,
        outdoorTempC: 32.0,
        temperatureDeltaC: -3.5,
        heatFlows: {
          exteriorWallConductionW: 50,
          windowConductionW: 20,
          roofConductionW: 30,
          internalPartitionTransferW: -10,
          solarGainW: 150,
          ventilationLossOrGainW: 40,
          internalGainsW: 80,
          hvacHeatW: 0,
          netHeatFlowW: 360,
        },
      },
      {
        roomId: 'R2',
        roomLabel: 'Bedroom',
        timestamp: '2026-10-11T12:00:00Z',
        temperatureC: 22.0,
        outdoorTempC: 32.0,
        temperatureDeltaC: -10.0,
        heatFlows: {
          exteriorWallConductionW: 30,
          windowConductionW: 0,
          roofConductionW: 20,
          internalPartitionTransferW: 10,
          solarGainW: 0,
          ventilationLossOrGainW: 20,
          internalGainsW: 30,
          hvacHeatW: 0,
          netHeatFlowW: 110,
        },
      },
    ],
    '2026-10-11T13:00:00Z': [
      {
        roomId: 'R1',
        roomLabel: 'Living Room & Kitchen',
        timestamp: '2026-10-11T13:00:00Z',
        temperatureC: 29.2,
        outdoorTempC: 33.0,
        temperatureDeltaC: -3.8,
        heatFlows: {} as any,
      },
      // Note: R2 is omitted here to test missing room temperature behavior
    ],
  },
  roomSummaries: {
    R1: { roomId: 'R1', label: 'Living Room', minTemperatureC: 28.5, maxTemperatureC: 29.2, meanTemperatureC: 28.85, peakSolarGainW: 150, totalHeatGainedKWh: 0.5 },
    R2: { roomId: 'R2', label: 'Bedroom', minTemperatureC: 22.0, maxTemperatureC: 22.0, meanTemperatureC: 22.0, peakSolarGainW: 0, totalHeatGainedKWh: 0.1 },
  },
  diagnostics: {
    geometryWarnings: ['SCALE_INCONSISTENCY: Slight distortion detected'],
    environmentalWarnings: [],
    missingInputs: [],
    approximationsUsed: ['Assumed standard window height'],
    confidence: 'medium',
    confidenceRationale: 'Prototype thermal model',
    notes: ['Not CFD'],
  },
  createdAt: '2026-10-11T12:00:00Z',
};

describe('SVG Thermal Renderer Suite', () => {
  test('generates valid standalone SVG XML markup with viewBox', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    assert.ok(res.svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Must include XML declaration');
    assert.ok(res.svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'Must define SVG namespace');
    assert.ok(res.svg.includes('viewBox="0 0 1000 930"'), 'Must have correct aspect ratio viewBox (1000 x (800 + 130 legend))');
    assert.ok(res.svg.endsWith('</svg>'), 'Must terminate with </svg>');
  });

  test('renders room polygon coordinates matching geometry inputs', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    // Room 1 points: 100,100 400,100 400,350 100,350
    assert.ok(res.svg.includes('id="room-R1" points="100,100 400,100 400,350 100,350"'));
    assert.ok(res.svg.includes('id="room-R2" points="400,100 700,100 700,350 400,350"'));
  });

  test('escapes special characters in XML and text labels', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    assert.ok(res.svg.includes('LIVING ROOM &amp; KITCHEN'), 'Ampersand must be escaped to &amp;');
    assert.ok(!res.svg.includes('LIVING ROOM & KITCHEN'), 'Unescaped ampersand must not appear in text');
    assert.ok(res.svg.includes('&lt;Ground Floor&gt;'), 'Angle brackets must be escaped');
  });

  test('renders true north indicator rotated to specified angle', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    assert.ok(res.svg.includes('id="north-arrow"'), 'North arrow element must be present');
    assert.ok(res.svg.includes('rotate(45)'), 'North arrow must rotate to northAngleDeg (45°)');
  });

  test('handles missing room temperature explicitly with fallback color and diagnostic reporting', () => {
    // Hour 2 omits R2
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      options: { timestamp: '2026-10-11T13:00:00Z' },
    });

    assert.strictEqual(res.renderedRoomTemperatures.R1, 29.2);
    assert.strictEqual(res.renderedRoomTemperatures.R2, null);
    assert.ok(res.diagnostics.missingRoomTemperatures.includes('R2'));

    // R2 polygon must use missingDataColorHex and dashed border
    assert.ok(res.svg.includes('id="room-R2"'));
    assert.ok(res.svg.includes('stroke-dasharray="4,4"'), 'Missing room temperature must render dashed border');
  });

  test('maintains persistent global color mapping across different hours', () => {
    const colorScale = { minTempC: 20.0, maxTempC: 30.0, missingDataColorHex: '#ccc' };

    // 25.0°C mapped at hour 1
    const colorAt25 = temperatureToColor(25.0, colorScale);
    // 25.0°C mapped at hour 2
    const colorAt25Again = temperatureToColor(25.0, colorScale);

    assert.strictEqual(colorAt25, colorAt25Again, 'Identical temperature must produce identical hex color');

    // 22°C (cooler) should have different hex than 29°C (warmer)
    const coolColor = temperatureToColor(22.0, colorScale);
    const warmColor = temperatureToColor(29.0, colorScale);
    assert.notStrictEqual(coolColor, warmColor);
  });

  test('preserves geometry warnings and simulation limitations in diagnostics', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    assert.ok(res.diagnostics.warnings.some((w) => w.includes('SCALE_INCONSISTENCY')));
    assert.ok(res.diagnostics.limitations.some((l) => l.includes('Not CFD')));
  });

  test('renders spatial gradients with clipPath preventing wall bleed', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      options: { enableSpatialGradients: true },
    });

    assert.ok(res.svg.includes('<clipPath id="clip-R1">'), 'Must include clipPath for Room 1');
    assert.ok(res.svg.includes('<radialGradient id="grad-R1"'), 'Must define radialGradient for Room 1');
    assert.ok(res.svg.includes('clip-path="url(#clip-R1)"'), 'Must reference clipPath on thermal gradient rect');
  });

  test('renders physically grounded heat flux arrows when heat flow exceeds threshold', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      options: { showHeatFluxVectors: true },
    });

    // R1 has netHeatFlowW = 360W, exteriorWallConductionW = 50W, solarGainW = 150W
    assert.ok(res.svg.includes('id="heat-flux-arrows"'), 'Must include heat-flux-arrows layer');
    assert.ok(res.svg.includes('marker-end="url(#heatArrowIn)"') || res.svg.includes('marker-end="url(#heatArrowOut)"'), 'Must include heat flow marker');
    assert.ok(res.svg.includes('+50 W') || res.svg.includes('50 W'), 'Must include heat conduction magnitude label');
  });

  test('runs automated quality review and passes valid visualization', () => {
    const { reviewThermalVisualization } = require('../../services/renderer/quality-reviewer');
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    const review = reviewThermalVisualization({
      svg: res.svg,
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      renderedRoomTemperatures: res.renderedRoomTemperatures,
    });

    assert.ok(review.passed, 'Quality review should pass for valid geometry & simulation');
    assert.ok(review.score >= 80, `Expected score >= 80, got ${review.score}`);
    assert.ok(['PASS', 'PASS_WITH_WARNINGS'].includes(review.status));
  });

  test('calculates typed physical overlays with wall-normal direction and Watts magnitude', () => {
    const { calculateHeatFlowOverlays } = require('../../services/renderer/heat-flow-overlays');
    const overlayCol = calculateHeatFlowOverlays(
      sampleGeometry,
      sampleSimulation,
      '2026-10-11T12:00:00Z',
    );

    assert.ok(overlayCol.overlays.length > 0, 'Must produce physical overlays');
    const condExt = overlayCol.overlays.find(
      (o: any) => o.overlayType === 'CONDUCTIVE_HEAT' && o.elementType === 'exterior-wall',
    );
    assert.ok(condExt, 'Must produce exterior wall conductive overlay');
    assert.strictEqual(condExt.unit, 'W');
    assert.ok(condExt.magnitude > 0);
    assert.ok('dx' in condExt.direction && 'dy' in condExt.direction);

    // Direction vector must be normalized (length approximately 1.0)
    const len = Math.hypot(condExt.direction.dx, condExt.direction.dy);
    assert.ok(Math.abs(len - 1.0) < 0.05, `Direction vector should be normalized: ${len}`);
  });

  test('generates airflow overlays only for configured open openings and never fabricates unconfigured equipment', () => {
    const { calculateAirflowOverlays } = require('../../services/renderer/airflow-overlays');

    // 1. Without configuration: 0 airflow overlays
    const emptyOverlays = calculateAirflowOverlays(
      sampleGeometry,
      sampleSimulation,
      '2026-10-11T12:00:00Z',
    );
    assert.strictEqual(emptyOverlays.length, 0, 'Must not fabricate airflow without configuration');

    // 2. With open window configuration
    const withOpenWindow = calculateAirflowOverlays(
      sampleGeometry,
      sampleSimulation,
      '2026-10-11T12:00:00Z',
      {
        openingStates: {
          O1: { openingId: 'O1', state: 'open' },
        },
      },
    );
    assert.strictEqual(withOpenWindow.length, 1);
    assert.strictEqual(withOpenWindow[0].overlayType, 'VENTILATION');
    assert.strictEqual(withOpenWindow[0].unit, 'm³/s');
  });

  test('runs deterministic quality checks detecting missing rooms and out-of-range temperatures', () => {
    const { runDeterministicQualityChecks } = require('../../services/renderer/quality-reviewer');
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    const findings = runDeterministicQualityChecks(sampleGeometry, sampleSimulation, res);
    const criticals = findings.filter((f: any) => f.severity === 'CRITICAL');
    assert.strictEqual(criticals.length, 0, 'Valid rendering must have zero critical deterministic findings');
  });

  test('gracefully skips Amazon Bedrock review when AWS credentials or flags are disabled', async () => {
    const { runBedrockReview } = require('../../services/renderer/bedrock-reviewer');
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
    });

    // Default: enableAiReview = false
    const reviewResult = await runBedrockReview({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      rendered: res,
    });

    assert.strictEqual(reviewResult.skipped, true);
    assert.ok(reviewResult.skipReason?.includes('enableAiReview = false'));
    assert.strictEqual(reviewResult.report.status, 'PASS_WITH_WARNINGS');
  });

  test('renders separate visual markers for heat conduction, partition transfer, and airflow', () => {
    const res = renderThermalFloorPlanSvg({
      geometry: sampleGeometry,
      simulation: sampleSimulation,
      options: {
        showHeatFluxVectors: true,
        showPhysicalOverlays: true,
        ventilationConfig: {
          openingStates: { O1: { openingId: 'O1', state: 'open' } },
        },
      },
    });

    assert.ok(res.svg.includes('id="heatArrowIn"'), 'Must define inward heat arrow marker');
    assert.ok(res.svg.includes('id="heatArrowOut"'), 'Must define outward heat arrow marker');
    assert.ok(res.svg.includes('id="airStreamArrow"'), 'Must define airflow stream marker');
    assert.ok(res.svg.includes('id="partitionArrow"'), 'Must define partition transfer marker');
    assert.ok(res.svg.includes('layer-airflow'), 'Must render separate layer-airflow group');
    assert.ok(res.svg.includes('layer-heat-vectors'), 'Must render separate layer-heat-vectors group');
  });
});
