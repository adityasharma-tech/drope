/**
 * Room Heat Balance & Transient Numerical Solver
 *
 * Implements the lumped-capacitance transient heat balance differential equation:
 *   C_i * (dT_i / dt) = Q_envelope + Q_partitions + Q_solar + Q_ventilation + Q_internal + Q_hvac
 *
 * Where:
 *   - Q_envelope   = (U_wall * A_wall + U_win * A_win + U_roof * A_roof) * (T_out - T_i)
 *   - Q_partitions = SUM_j [ U_part * A_ij * (T_j - T_i) ]
 *   - Q_solar      = A_win * I_vert * SHGC
 *   - Q_ventilation= ACH * V_i / 3600 * rho_air * c_p,air * (T_out - T_i)
 *   - Q_internal   = A_floor * gainRate(roomType)
 *
 * Numerical Scheme:
 *   Explicit Euler numerical integration using fine sub-timesteps (dt = 60s)
 *   over each 1-hour environmental interval (3600s = 60 sub-steps).
 *   Sub-stepping ensures numerical stability for typical room thermal capacitance
 *   (Courant/von Neumann stability: dt < C_i / SUM(U*A) ≈ 120,000 / 100 ≈ 1200s).
 */

import {
  ConstructionAssumptions,
  RoomHeatFlowBreakdown,
  RoomHourlyThermalState,
  RoomThermalGeometry,
} from './thermal-types';
import { calculateWindowSolarGain } from './solar-gain-model';
import { HourlyConditionRecord } from '../environmental/environmental-types';

export interface RoomStepDerivatives {
  dTdt: number; // Rate of temperature change in °C/s
  heatFlows: RoomHeatFlowBreakdown;
}

/**
 * Calculates instantaneous heat flows and dT/dt for a room at a given point in time.
 */
export function calculateRoomHeatFlows(
  geom: RoomThermalGeometry,
  currentRoomTempC: number,
  allRoomTemperatures: Record<string, number>,
  outdoorTempC: number,
  hourlyEnv: HourlyConditionRecord,
  hourOfDay: number,
  assumptions: ConstructionAssumptions,
): RoomStepDerivatives {
  // 1. Exterior Envelope Conduction (W)
  const wallCondW = geom.exteriorWallAreaM2 * assumptions.exteriorWallUValue * (outdoorTempC - currentRoomTempC);
  const winCondW = geom.exteriorWindowAreaM2 * assumptions.windowUValue * (outdoorTempC - currentRoomTempC);
  const roofCondW = geom.roofAreaM2 * assumptions.roofUValue * (outdoorTempC - currentRoomTempC);

  // 2. Interior Partition Heat Exchange with Neighboring Rooms (W)
  let partitionTransferW = 0;
  for (const [adjId, areaM2] of Object.entries(geom.partitionAreasToAdjacentRooms)) {
    const adjTempC = allRoomTemperatures[adjId] ?? currentRoomTempC;
    // Energy flows from adjRoom into this room: Q = U * A * (T_adj - T_room)
    const qPart = assumptions.interiorPartitionUValue * areaM2 * (adjTempC - currentRoomTempC);
    partitionTransferW += qPart;
  }

  // 3. Solar Gain through Glazing (W)
  const solarResult = calculateWindowSolarGain(
    geom.exteriorWindowAreaM2,
    geom.windowOrientations,
    hourlyEnv.shortwaveRadiationWm2,
    hourlyEnv.directRadiationWm2,
    hourlyEnv.diffuseRadiationWm2,
    assumptions.windowSHGC,
    hourOfDay,
  );
  const solarGainW = solarResult.solarGainW;

  // 4. Ventilation & Infiltration Heat Exchange (W)
  // m_dot = ACH * Volume / 3600 * rho_air (kg/s)
  const airVolumeFlowRateM3s = (assumptions.airChangesPerHour * geom.volumeM3) / 3600.0;
  const airMassFlowRateKgs = airVolumeFlowRateM3s * assumptions.airDensityKgM3;
  const ventW = airMassFlowRateKgs * assumptions.airSpecificHeatJPkgK * (outdoorTempC - currentRoomTempC);

  // 5. Internal Heat Gains (W)
  const internalGainsW = geom.baseInternalGainsW;

  // 6. Optional HVAC regulation (if active)
  let hvacHeatW = 0;
  if (assumptions.hvacConfig?.enabled) {
    if (assumptions.hvacConfig.coolingSetpointC && currentRoomTempC > assumptions.hvacConfig.coolingSetpointC) {
      // Cooling demand
      const maxCoolingW = (assumptions.hvacConfig.maxCoolingCapacityWPerM2 ?? 80.0) * geom.floorAreaM2;
      const desiredCoolingW = (currentRoomTempC - assumptions.hvacConfig.coolingSetpointC) * 500;
      hvacHeatW = -Math.min(maxCoolingW, desiredCoolingW);
    } else if (assumptions.hvacConfig.heatingSetpointC && currentRoomTempC < assumptions.hvacConfig.heatingSetpointC) {
      // Heating demand
      const maxHeatingW = (assumptions.hvacConfig.maxHeatingCapacityWPerM2 ?? 80.0) * geom.floorAreaM2;
      const desiredHeatingW = (assumptions.hvacConfig.heatingSetpointC - currentRoomTempC) * 500;
      hvacHeatW = Math.min(maxHeatingW, desiredHeatingW);
    }
  }

  // Net Rate of Heat Accumulation: dQ/dt (Watts = J/s)
  const netHeatFlowW =
    wallCondW +
    winCondW +
    roofCondW +
    partitionTransferW +
    solarGainW +
    ventW +
    internalGainsW +
    hvacHeatW;

  // dT/dt = (dQ/dt) / C_thermal
  const capacitanceJK = Math.max(1000, geom.thermalCapacitanceJK);
  const dTdt = netHeatFlowW / capacitanceJK;

  const heatFlows: RoomHeatFlowBreakdown = {
    exteriorWallConductionW: Math.round(wallCondW * 10) / 10,
    windowConductionW: Math.round(winCondW * 10) / 10,
    roofConductionW: Math.round(roofCondW * 10) / 10,
    internalPartitionTransferW: Math.round(partitionTransferW * 10) / 10,
    solarGainW: Math.round(solarGainW * 10) / 10,
    ventilationLossOrGainW: Math.round(ventW * 10) / 10,
    internalGainsW: Math.round(internalGainsW * 10) / 10,
    hvacHeatW: Math.round(hvacHeatW * 10) / 10,
    netHeatFlowW: Math.round(netHeatFlowW * 10) / 10,
  };

  return { dTdt, heatFlows };
}

/**
 * Advances the multi-room thermal network by one full 1-hour timestep
 * using sub-stepped numerical integration (dt = 60s, 60 substeps).
 */
export function advanceSimulationOneHour(
  roomGeometries: Record<string, RoomThermalGeometry>,
  startRoomTemperatures: Record<string, number>,
  hourlyEnv: HourlyConditionRecord,
  nextHourlyEnv: HourlyConditionRecord | null,
  hourOfDay: number,
  assumptions: ConstructionAssumptions,
  subTimestepSeconds = 60,
): { endRoomTemperatures: Record<string, number>; roomStates: RoomHourlyThermalState[] } {
  const roomIds = Object.keys(roomGeometries);
  const currentTemps: Record<string, number> = { ...startRoomTemperatures };

  const totalHourSeconds = 3600;
  const numSteps = Math.max(1, Math.floor(totalHourSeconds / subTimestepSeconds));
  const dt = totalHourSeconds / numSteps;

  const startOutdoorTemp = hourlyEnv.temperatureC ?? 20.0;
  const endOutdoorTemp = nextHourlyEnv?.temperatureC ?? startOutdoorTemp;

  // Track integrated / snapshot heat flows
  const lastStepHeatFlows: Record<string, RoomHeatFlowBreakdown> = {};

  for (let step = 0; step < numSteps; step++) {
    // Linear interpolation of outdoor temperature across the hour
    const fraction = (step + 0.5) / numSteps;
    const interpolatedOutdoorTemp = startOutdoorTemp + fraction * (endOutdoorTemp - startOutdoorTemp);

    // Compute simultaneous derivatives for all rooms
    const dTdts: Record<string, number> = {};

    for (const rId of roomIds) {
      const geom = roomGeometries[rId];
      const res = calculateRoomHeatFlows(
        geom,
        currentTemps[rId],
        currentTemps,
        interpolatedOutdoorTemp,
        hourlyEnv,
        hourOfDay,
        assumptions,
      );
      dTdts[rId] = res.dTdt;
      lastStepHeatFlows[rId] = res.heatFlows;
    }

    // Simultaneous Explicit Euler update
    for (const rId of roomIds) {
      currentTemps[rId] += dTdts[rId] * dt;
    }
  }

  // Construct hourly room states
  const roomStates: RoomHourlyThermalState[] = [];
  const outdoorTempC = Math.round(startOutdoorTemp * 10) / 10;

  for (const rId of roomIds) {
    const roundedTemp = Math.round(currentTemps[rId] * 100) / 100;
    const geom = roomGeometries[rId];
    roomStates.push({
      roomId: rId,
      roomLabel: geom.roomLabel,
      timestamp: hourlyEnv.timestamp,
      temperatureC: roundedTemp,
      outdoorTempC,
      temperatureDeltaC: Math.round((roundedTemp - outdoorTempC) * 100) / 100,
      heatFlows: lastStepHeatFlows[rId],
    });
  }

  return {
    endRoomTemperatures: currentTemps,
    roomStates,
  };
}
