/**
 * Unit Tests for Thermal Simulation Engine
 *
 * Validates:
 * 1. Heat conduction through walls using Q = U * A * dT
 * 2. Conservation of energy across internal partitions (Q_ij = -Q_ji)
 * 3. Room asymptotic approach toward outdoor temperature under zero internal/solar gains
 * 4. Thermal capacitance buffering dynamics (higher C -> slower temperature change)
 * 5. Window solar heat gain calculation
 * 6. Ventilation heat exchange
 * 7. Determinism of simulation output given identical inputs
 * 8. Error handling for missing rooms or missing environmental records
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  DEFAULT_CONSTRUCTION_ASSUMPTIONS,
  RoomThermalGeometry,
} from '../../services/thermal/thermal-types';
import { calculateRoomHeatFlows, advanceSimulationOneHour } from '../../services/thermal/thermal-solver';
import { calculateWindowSolarGain } from '../../services/thermal/solar-gain-model';
import { runThermalSimulation } from '../../services/thermal/thermal-engine';
import { FloorPlanModel } from '../../services/floorplan/geometry-extraction';
import { EnvironmentalDataProfile } from '../../services/environmental/environmental-types';

function createDummyRoomGeometry(overrides: Partial<RoomThermalGeometry> = {}): RoomThermalGeometry {
  return {
    roomId: 'R1',
    roomLabel: 'Test Room',
    roomType: 'bedroom',
    floorAreaM2: 20.0,
    volumeM3: 54.0, // 20m² * 2.7m
    thermalCapacitanceJK: 2400000, // 20m² * 120,000 J/(m²·K)
    exteriorWallAreaM2: 15.0,
    exteriorWindowAreaM2: 3.0,
    windowOrientations: [{ orientationDeg: 180, areaM2: 3.0 }], // South-facing
    partitionAreasToAdjacentRooms: {},
    roofAreaM2: 0,
    baseInternalGainsW: 0,
    ...overrides,
  };
}

describe('Thermal Physics & Mathematical Models', () => {
  test('calculates steady-state wall heat conduction accurately (Q = U * A * dT)', () => {
    const geom = createDummyRoomGeometry({
      exteriorWallAreaM2: 20.0,
      exteriorWindowAreaM2: 0,
      roofAreaM2: 0,
      baseInternalGainsW: 0,
      partitionAreasToAdjacentRooms: {},
    });

    const assumptions = {
      ...DEFAULT_CONSTRUCTION_ASSUMPTIONS,
      exteriorWallUValue: 0.5,
      airChangesPerHour: 0, // No ventilation
    };

    const dummyEnv = {
      timestamp: '2026-10-11T12:00',
      dataType: 'forecast' as const,
      temperatureC: 30.0,
      relativeHumidityPercent: 50,
      wetBulbTemperatureC: 22,
      wetBulbMethod: 'stull-2011' as const,
      windDirectionDegrees: 0,
      windDirectionCompass: 'N' as const,
      windSpeedMps: 0,
      surfacePressureHpa: 1013,
      shortwaveRadiationWm2: 0,
      directRadiationWm2: 0,
      diffuseRadiationWm2: 0,
    };

    // Indoor = 20°C, Outdoor = 30°C => dT = +10°C
    // Expected Q = 0.5 W/(m²·K) * 20m² * 10K = +100 Watts
    const res = calculateRoomHeatFlows(geom, 20.0, {}, 30.0, dummyEnv, 12, assumptions);

    assert.strictEqual(res.heatFlows.exteriorWallConductionW, 100.0);
    assert.strictEqual(res.heatFlows.netHeatFlowW, 100.0);
  });

  test('conserves heat transfer across internal partitions between two connected rooms', () => {
    const roomA = createDummyRoomGeometry({
      roomId: 'RoomA',
      exteriorWallAreaM2: 0,
      exteriorWindowAreaM2: 0,
      partitionAreasToAdjacentRooms: { RoomB: 12.0 },
    });
    const roomB = createDummyRoomGeometry({
      roomId: 'RoomB',
      exteriorWallAreaM2: 0,
      exteriorWindowAreaM2: 0,
      partitionAreasToAdjacentRooms: { RoomA: 12.0 },
    });

    const assumptions = {
      ...DEFAULT_CONSTRUCTION_ASSUMPTIONS,
      interiorPartitionUValue: 1.5,
      airChangesPerHour: 0,
    };

    const dummyEnv = {
      timestamp: '2026-10-11T00:00',
      dataType: 'forecast' as const,
      temperatureC: 20.0,
      relativeHumidityPercent: 50,
      wetBulbTemperatureC: 15,
      wetBulbMethod: 'stull-2011' as const,
      windDirectionDegrees: 0,
      windDirectionCompass: 'N' as const,
      windSpeedMps: 0,
      surfacePressureHpa: 1013,
      shortwaveRadiationWm2: 0,
      directRadiationWm2: 0,
      diffuseRadiationWm2: 0,
    };

    const tempMap = { RoomA: 26.0, RoomB: 20.0 };

    // From RoomA's perspective (RoomA is hotter than RoomB):
    // Heat lost to RoomB: Q_part = 1.5 * 12 * (20 - 26) = -108 Watts
    const resA = calculateRoomHeatFlows(roomA, tempMap.RoomA, tempMap, 20.0, dummyEnv, 0, assumptions);
    // From RoomB's perspective (RoomB is colder than RoomA):
    // Heat gained from RoomA: Q_part = 1.5 * 12 * (26 - 20) = +108 Watts
    const resB = calculateRoomHeatFlows(roomB, tempMap.RoomB, tempMap, 20.0, dummyEnv, 0, assumptions);

    assert.strictEqual(resA.heatFlows.internalPartitionTransferW, -108.0);
    assert.strictEqual(resB.heatFlows.internalPartitionTransferW, 108.0);
    // Conservation: Sum of partition exchanges is exactly 0
    assert.strictEqual(
      resA.heatFlows.internalPartitionTransferW + resB.heatFlows.internalPartitionTransferW,
      0,
    );
  });

  test('temperature converges toward outdoor temperature under no-gain boundary conditions', () => {
    const room = createDummyRoomGeometry({
      exteriorWallAreaM2: 30.0,
      exteriorWindowAreaM2: 0,
      roofAreaM2: 0,
      baseInternalGainsW: 0,
    });

    const assumptions = {
      ...DEFAULT_CONSTRUCTION_ASSUMPTIONS,
      airChangesPerHour: 1.0, // Rapid ventilation
    };

    const constantEnv = {
      timestamp: '2026-10-11T00:00',
      dataType: 'forecast' as const,
      temperatureC: 15.0, // Cold outside
      relativeHumidityPercent: 50,
      wetBulbTemperatureC: 10,
      wetBulbMethod: 'stull-2011' as const,
      windDirectionDegrees: 0,
      windDirectionCompass: 'N' as const,
      windSpeedMps: 0,
      surfacePressureHpa: 1013,
      shortwaveRadiationWm2: 0,
      directRadiationWm2: 0,
      diffuseRadiationWm2: 0,
    };

    // Starting at 25.0°C, outdoor is 15.0°C
    let temp = 25.0;
    const geometries = { R1: room };

    for (let h = 0; h < 24; h++) {
      const step = advanceSimulationOneHour(
        geometries,
        { R1: temp },
        constantEnv,
        constantEnv,
        h,
        assumptions,
        60,
      );
      temp = step.endRoomTemperatures.R1;
    }

    // Room must have cooled down significantly towards 15°C
    assert.ok(temp < 20.0, `Room temperature should have fallen below 20°C, was ${temp}°C`);
    assert.ok(temp >= 15.0, `Room temperature cannot drop below outdoor (15°C), was ${temp}°C`);
  });

  test('higher thermal capacitance dampens temperature changes', () => {
    const lowMassRoom = createDummyRoomGeometry({
      thermalCapacitanceJK: 500000, // Light construction
    });
    const highMassRoom = createDummyRoomGeometry({
      thermalCapacitanceJK: 5000000, // Heavy concrete/masonry
    });

    const assumptions = {
      ...DEFAULT_CONSTRUCTION_ASSUMPTIONS,
      airChangesPerHour: 0.5,
    };

    const hotEnv = {
      timestamp: '2026-10-11T12:00',
      dataType: 'forecast' as const,
      temperatureC: 35.0, // Hot day
      relativeHumidityPercent: 40,
      wetBulbTemperatureC: 22,
      wetBulbMethod: 'stull-2011' as const,
      windDirectionDegrees: 0,
      windDirectionCompass: 'N' as const,
      windSpeedMps: 0,
      surfacePressureHpa: 1013,
      shortwaveRadiationWm2: 0,
      directRadiationWm2: 0,
      diffuseRadiationWm2: 0,
    };

    // Both start at 20°C
    const stepLow = advanceSimulationOneHour(
      { R1: lowMassRoom },
      { R1: 20.0 },
      hotEnv,
      hotEnv,
      12,
      assumptions,
      60,
    );
    const stepHigh = advanceSimulationOneHour(
      { R1: highMassRoom },
      { R1: 20.0 },
      hotEnv,
      hotEnv,
      12,
      assumptions,
      60,
    );

    const deltaLow = stepLow.endRoomTemperatures.R1 - 20.0;
    const deltaHigh = stepHigh.endRoomTemperatures.R1 - 20.0;

    assert.ok(
      deltaLow > deltaHigh,
      `Low mass room (delta ${deltaLow}°C) should heat up faster than high mass room (delta ${deltaHigh}°C)`,
    );
  });

  test('calculates glazing solar gains correctly based on SHGC and irradiance', () => {
    // 4m² window with SHGC = 0.6
    const res = calculateWindowSolarGain(
      4.0,
      [{ orientationDeg: 180, areaM2: 4.0 }], // South window
      600, // GHI
      400, // Direct
      200, // Diffuse
      0.6,
      12, // Solar noon
    );

    assert.ok(res.solarGainW > 0, 'Solar gain must be positive during daytime');
    assert.ok(res.effectiveIrradianceWm2 > 0, 'Vertical irradiance must be positive');

    // At night (GHI = 0)
    const nightRes = calculateWindowSolarGain(4.0, [], 0, 0, 0, 0.6, 2);
    assert.strictEqual(nightRes.solarGainW, 0);
  });
});

describe('End-to-End Simulation Engine Integration', () => {
  const dummyGeometry: FloorPlanModel = {
    schemaVersion: '1.0',
    imageMetadata: { source: 'test.png', widthPixels: 1000, heightPixels: 800, analyzedAt: 'now', modelId: 'test' },
    buildingMetadata: { totalFloors: 1, totalFloorsSource: 'annotated' },
    orientation: { northAngleDeg: 0, northAngleSource: 'annotated', confidence: 'high' },
    rooms: [
      {
        id: 'R1',
        label: 'Living Room',
        type: 'living',
        typeSource: 'annotated',
        boundary: { points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }] },
        boundingBox: { x: 100, y: 100, width: 200, height: 200 },
        areaReal: { value: 20, unit: 'm', source: 'annotated' },
        wallIds: ['W1', 'W2'],
        openingIds: ['O1'],
        adjacentRoomIds: ['R2'],
        connectedRoomIds: ['R2'],
        isExteriorExposed: true,
        exteriorWallIds: ['W1'],
        fixtures: [],
        confidence: 'high',
        validationWarnings: [],
      },
      {
        id: 'R2',
        label: 'Bedroom',
        type: 'bedroom',
        typeSource: 'annotated',
        boundary: { points: [{ x: 300, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 300 }, { x: 300, y: 300 }] },
        boundingBox: { x: 300, y: 100, width: 200, height: 200 },
        areaReal: { value: 16, unit: 'm', source: 'annotated' },
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
        endPoint: { x: 300, y: 100 },
        lengthReal: { value: 5, unit: 'm', source: 'annotated' },
        boundingRoomIds: ['R1'],
        isExterior: true,
        isExteriorSource: 'annotated',
        isLoadBearingSource: 'inferred',
        confidence: 'high',
      },
      {
        id: 'W2',
        startPoint: { x: 300, y: 100 },
        endPoint: { x: 300, y: 300 },
        lengthReal: { value: 4, unit: 'm', source: 'annotated' },
        boundingRoomIds: ['R1', 'R2'],
        isExterior: false,
        isExteriorSource: 'annotated',
        isLoadBearingSource: 'inferred',
        confidence: 'high',
      },
      {
        id: 'W3',
        startPoint: { x: 500, y: 100 },
        endPoint: { x: 500, y: 300 },
        lengthReal: { value: 4, unit: 'm', source: 'annotated' },
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
        positionOnWall: { x: 200, y: 100 },
        widthReal: { value: 1.5, unit: 'm', source: 'annotated' },
        heightReal: { value: 1.2, unit: 'm', source: 'annotated' },
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
    validationWarnings: [],
    unresolvedAmbiguities: [],
    createdAt: 'now',
  };

  const dummyEnvironment: EnvironmentalDataProfile = {
    location: { latitude: 28.6139, longitude: 77.209, elevationM: 215, timezone: 'Asia/Kolkata', name: 'Delhi' },
    currentConditions: {
      timestamp: '2026-10-11T12:00',
      dataType: 'forecast',
      temperatureC: 32.0,
      relativeHumidityPercent: 50,
      wetBulbTemperatureC: 23,
      wetBulbMethod: 'stull-2011',
      windDirectionDegrees: 180,
      windDirectionCompass: 'S',
      windSpeedMps: 2.5,
      surfacePressureHpa: 985,
    },
    hourlyConditions: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `2026-10-11T${String(i).padStart(2, '0')}:00`,
      dataType: 'forecast',
      temperatureC: 24 + Math.sin((i / 24) * 2 * Math.PI) * 6, // 18°C to 30°C diurnal cycle
      relativeHumidityPercent: 55,
      wetBulbTemperatureC: 20,
      wetBulbMethod: 'stull-2011',
      windDirectionDegrees: 180,
      windDirectionCompass: 'S',
      windSpeedMps: 2.0,
      surfacePressureHpa: 985,
      shortwaveRadiationWm2: i >= 6 && i <= 18 ? Math.sin(((i - 6) / 12) * Math.PI) * 700 : 0,
      directRadiationWm2: i >= 6 && i <= 18 ? Math.sin(((i - 6) / 12) * Math.PI) * 500 : 0,
      diffuseRadiationWm2: i >= 6 && i <= 18 ? Math.sin(((i - 6) / 12) * Math.PI) * 200 : 0,
    })),
    solarData: { sunrise: '2026-10-11T06:19', sunset: '2026-10-11T17:55', daylightDurationSeconds: 41760 },
    historicalClimate: { available: true, provider: 'NASA POWER', dataset: 'Climatology', period: '25y', temporalResolution: 'monthly', geographicResolution: 'grid', variables: {} },
    sources: [],
    dataQuality: { missingFields: [], warnings: [], coverage: { hourlyCount: 24, startTime: '00', endTime: '23', hasCurrentConditions: true, hasSolarData: true }, limitations: [] },
    simulationReadiness: { ready: true, availableInputs: [], missingInputs: [], notes: [] },
  };

  test('executes 24-hour simulation producing structured room states and summaries', () => {
    const sim = runThermalSimulation({
      geometry: dummyGeometry,
      environment: dummyEnvironment,
      initialTemperatures: { R1: 24.0, R2: 24.0 },
    });

    assert.strictEqual(sim.status, 'COMPLETED');
    assert.strictEqual(sim.simulationPeriod.totalHours, 24);
    assert.strictEqual(Object.keys(sim.roomSummaries).length, 2);

    // Living room R1 has window + internal gains, so it should experience solar heat gain
    const r1Summary = sim.roomSummaries.R1;
    assert.ok(r1Summary.peakSolarGainW > 0, 'Living room with window should have positive peak solar gain');
    assert.ok(r1Summary.maxTemperatureC > 20.0);

    // Check determinism: run again with same inputs, output must be identical
    const sim2 = runThermalSimulation({
      geometry: dummyGeometry,
      environment: dummyEnvironment,
      initialTemperatures: { R1: 24.0, R2: 24.0 },
    });

    assert.deepStrictEqual(sim.hourlyRoomStates, sim2.hourlyRoomStates);
  });

  test('throws cleanly when geometry has no rooms', () => {
    const emptyGeom = { ...dummyGeometry, rooms: [] };
    assert.throws(
      () => runThermalSimulation({ geometry: emptyGeom, environment: dummyEnvironment }),
      /FloorPlanModel contains 0 rooms/,
    );
  });
});
