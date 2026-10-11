/**
 * Thermal Simulation Engine Coordinator
 *
 * Coordinates full building thermal simulation:
 * 1. Merges building construction assumptions.
 * 2. Translates floor-plan geometry into thermal boundary inputs.
 * 3. Initializes room temperatures.
 * 4. Iterates hourly environmental boundary conditions using sub-stepped numerical solver.
 * 5. Compiles summary statistics, heat flow breakdowns, diagnostics, and confidence rankings.
 */

import {
  ConstructionAssumptions,
  DEFAULT_CONSTRUCTION_ASSUMPTIONS,
  RoomHourlyThermalState,
  ThermalSimulationInput,
  ThermalSimulationOutput,
} from './thermal-types';
import { extractThermalGeometry } from './geometry-thermal-adapter';
import { advanceSimulationOneHour } from './thermal-solver';

export function runThermalSimulation(input: ThermalSimulationInput): ThermalSimulationOutput {
  const { geometry, environment, customAssumptions, initialTemperatures } = input;

  const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const assumptions: ConstructionAssumptions = {
    ...DEFAULT_CONSTRUCTION_ASSUMPTIONS,
    ...customAssumptions,
    internalGainsByRoomTypeWPerM2: {
      ...DEFAULT_CONSTRUCTION_ASSUMPTIONS.internalGainsByRoomTypeWPerM2,
      ...customAssumptions?.internalGainsByRoomTypeWPerM2,
    },
  };

  // 1. Adapter: Extract thermal properties from geometry
  const { roomGeometries, warnings: geomWarnings, approximations } = extractThermalGeometry(
    geometry,
    assumptions,
  );

  const roomIds = Object.keys(roomGeometries);
  if (roomIds.length === 0) {
    throw new Error('Simulation failed: FloorPlanModel contains 0 rooms to simulate.');
  }

  // 2. Initial room temperatures
  const currentTemps: Record<string, number> = {};
  const initialTempsRecord: Record<string, number> = {};

  for (const rId of roomIds) {
    const initTemp = initialTemperatures?.[rId] ?? assumptions.defaultInitialTempC;
    currentTemps[rId] = initTemp;
    initialTempsRecord[rId] = initTemp;
  }

  // 3. Hourly Environmental Time-Series
  const hourlyEnv = environment.hourlyConditions;
  if (!hourlyEnv || hourlyEnv.length === 0) {
    throw new Error('Simulation failed: Environmental profile contains 0 hourly records.');
  }

  const hourlyRoomStates: Record<string, RoomHourlyThermalState[]> = {};
  const subTimestepSeconds = 60; // 60s numerical sub-step

  for (let i = 0; i < hourlyEnv.length; i++) {
    const currentHourEnv = hourlyEnv[i];
    const nextHourEnv = i + 1 < hourlyEnv.length ? hourlyEnv[i + 1] : null;

    // Parse hour of day for solar position
    const dateObj = new Date(currentHourEnv.timestamp);
    const hourOfDay = Number.isNaN(dateObj.getHours()) ? (i % 24) : dateObj.getHours();

    const { endRoomTemperatures, roomStates } = advanceSimulationOneHour(
      roomGeometries,
      currentTemps,
      currentHourEnv,
      nextHourEnv,
      hourOfDay,
      assumptions,
      subTimestepSeconds,
    );

    // Update temperatures for next hour
    for (const rId of roomIds) {
      currentTemps[rId] = endRoomTemperatures[rId];
    }

    hourlyRoomStates[currentHourEnv.timestamp] = roomStates;
  }

  // 4. Summarize statistics per room across the simulation window
  const roomSummaries: ThermalSimulationOutput['roomSummaries'] = {};

  for (const rId of roomIds) {
    const geom = roomGeometries[rId];
    let minT = Infinity;
    let maxT = -Infinity;
    let sumT = 0;
    let count = 0;
    let peakSolarW = 0;
    let totalHeatGainedJoules = 0;

    for (const states of Object.values(hourlyRoomStates)) {
      const state = states.find((s) => s.roomId === rId);
      if (state) {
        if (state.temperatureC < minT) minT = state.temperatureC;
        if (state.temperatureC > maxT) maxT = state.temperatureC;
        sumT += state.temperatureC;
        count++;

        if (state.heatFlows.solarGainW > peakSolarW) {
          peakSolarW = state.heatFlows.solarGainW;
        }
        // Integrate net heat in Joules: W * 3600s
        totalHeatGainedJoules += Math.max(0, state.heatFlows.netHeatFlowW) * 3600;
      }
    }

    const totalHeatKWh = Math.round((totalHeatGainedJoules / 3600000) * 100) / 100;

    roomSummaries[rId] = {
      roomId: rId,
      label: geom.roomLabel,
      minTemperatureC: count > 0 ? minT : assumptions.defaultInitialTempC,
      maxTemperatureC: count > 0 ? maxT : assumptions.defaultInitialTempC,
      meanTemperatureC: count > 0 ? Math.round((sumT / count) * 100) / 100 : assumptions.defaultInitialTempC,
      peakSolarGainW: Math.round(peakSolarW * 10) / 10,
      totalHeatGainedKWh: totalHeatKWh,
    };
  }

  // 5. Diagnostics & Confidence Assessment
  const missingInputs: string[] = [];
  if (geometry.orientation?.northAngleDeg === null || geometry.orientation?.northAngleDeg === undefined) {
    missingInputs.push('building_north_orientation');
  }
  if (!geometry.scale?.pixelsPerUnit) {
    missingInputs.push('reliable_scale_calibration');
  }

  const envWarnings: string[] = environment.dataQuality?.warnings ?? [];

  // Determine overall simulation confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let confidenceRationale = 'Reliable geometry and comprehensive hourly environmental data available.';

  if (missingInputs.length > 0 || geomWarnings.length > 3 || envWarnings.length > 0) {
    confidence = 'medium';
    confidenceRationale =
      `Simulation relies on geometric approximations: ${approximations.slice(0, 2).join('; ')}.`;
  }
  if (missingInputs.includes('reliable_scale_calibration')) {
    confidence = 'low';
    confidenceRationale = 'Low geometric scale confidence significantly influences absolute heat transfer rates.';
  }

  const output: ThermalSimulationOutput = {
    simulationId,
    status: 'COMPLETED',
    modelMetadata: {
      modelName: 'Room-Level Lumped-Capacitance Transient Heat Balance',
      version: '1.0.0',
      numericalMethod: 'Explicit Euler with 60s numerical sub-stepping',
      subTimestepSeconds,
      description:
        'Computes dynamic room temperature trajectories from envelope conduction, partition coupling, glazing solar gains, natural ventilation, and internal gains.',
    },
    simulationPeriod: {
      startTimestamp: hourlyEnv[0].timestamp,
      endTimestamp: hourlyEnv[hourlyEnv.length - 1].timestamp,
      totalHours: hourlyEnv.length,
    },
    environmentalProvenance: {
      locationName: environment.location.name,
      latitude: environment.location.latitude,
      longitude: environment.location.longitude,
      elevationM: environment.location.elevationM,
      timezone: environment.location.timezone,
      provider: environment.sources[0]?.provider ?? 'Open-Meteo',
    },
    buildingAssumptions: assumptions,
    roomGeometries,
    initialRoomTemperatures: initialTempsRecord,
    hourlyRoomStates,
    roomSummaries,
    diagnostics: {
      geometryWarnings: geomWarnings,
      environmentalWarnings: envWarnings,
      missingInputs,
      approximationsUsed: approximations,
      confidence,
      confidenceRationale,
      notes: [
        'Room temperatures are deterministic prototype estimates for relative thermal comparisons.',
        'Not a substitute for CFD or accredited ASHRAE 140 / EnergyPlus building energy validation.',
      ],
    },
    createdAt: new Date().toISOString(),
  };

  return output;
}
