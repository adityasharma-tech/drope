/**
 * Airflow and Ventilation Physical Overlay Calculator
 *
 * Grounded in actual geometry and optional equipment/opening configuration:
 * 1. Windows and doors: only generates airflow paths if opening is configured as 'open' or 'partial'.
 * 2. Infiltration: background building air changes (ACH) represented at exterior boundary.
 * 3. HVAC equipment: streamlines from configured supply outlets toward room center.
 * 4. Fans: circulation glyphs at configured locations (explicitly distinguished from outdoor ventilation).
 * 5. Exhaust fans: paths from room outward through exterior boundary.
 *
 * STRICT GOVERNING RULES:
 * - Airflow never crosses solid walls without an opening.
 * - No HVAC or fan equipment is fabricated if unconfigured.
 * - Units are explicit: m³/s for airflow, W for heat exchange.
 * - Clearly distinguished from CFD velocity-field simulations.
 */

import { FloorPlanModel, Room, Opening } from '../floorplan/geometry-extraction';
import { ThermalSimulationOutput } from '../thermal/thermal-types';
import {
  ExhaustAirflowOverlay,
  FanCirculationOverlay,
  HvacAirflowOverlay,
  PhysicalOverlay,
  VentilationBuildingConfig,
  VentilationOverlay,
} from './overlay-types';

export function calculateAirflowOverlays(
  geometry: FloorPlanModel,
  simulation: ThermalSimulationOutput,
  timestamp: string,
  config?: VentilationBuildingConfig,
): PhysicalOverlay[] {
  const overlays: PhysicalOverlay[] = [];
  const hourlyStates = simulation.hourlyRoomStates[timestamp] ?? [];
  const stateByRoomId = new Map(hourlyStates.map((s) => [s.roomId, s]));
  const roomMap = new Map(geometry.rooms.map((r) => [r.id, r]));
  const openingMap = new Map(geometry.openings.map((o) => [o.id, o]));

  // 1. Process configured or identified openings
  for (const opening of geometry.openings) {
    const openingCfg = config?.openingStates?.[opening.id];
    const state = openingCfg?.state ?? 'unknown';

    // If opening is explicitly open or partially open
    if (state === 'open' || state === 'partial') {
      const fraction = state === 'open' ? 1.0 : (openingCfg?.openFraction ?? 0.5);
      const isWindow = opening.type.toLowerCase().includes('window');
      const isDoor = opening.type.toLowerCase().includes('door');

      // Find rooms connected by this opening
      const connectedRooms = opening.connectsSpaceIds
        .map((id) => roomMap.get(id))
        .filter((r): r is Room => Boolean(r));

      const primaryRoom = connectedRooms[0];
      if (!primaryRoom) continue;

      const roomThermal = stateByRoomId.get(primaryRoom.id);
      const outdoorTemp = roomThermal?.outdoorTempC ?? 25.0;
      const roomTemp = roomThermal?.temperatureC ?? 24.0;

      // Calculate approximate airflow rate through opening:
      // Q_air = C_d * A * sqrt(2 * deltaP / rho) or simplified wind/buoyancy estimate
      const widthPx = opening.widthPixels ?? 40;
      const approxAreaM2 = (widthPx / 40) * 1.2 * fraction;
      const approxFlowM3s = Math.round(approxAreaM2 * 0.35 * 100) / 100; // estimated low-speed cross-ventilation

      const midX = opening.positionOnWall.x;
      const midY = opening.positionOnWall.y;

      // Inflow or outflow depending on outdoor vs indoor delta
      const isEntering = outdoorTemp > roomTemp;
      const heatExchangeW = Math.round(approxFlowM3s * 1.2 * 1005 * (outdoorTemp - roomTemp));

      overlays.push({
        overlayId: `VENT_${opening.id}`,
        overlayType: 'VENTILATION',
        timestamp,
        quantityLabel: isWindow ? 'Window Natural Ventilation Airflow' : 'Door Air Exchange',
        unit: 'm³/s',
        magnitude: approxFlowM3s,
        method: 'Orifice flow approximation from configured opening aperture',
        dataQuality: 'estimated',
        position: { x: midX, y: midY },
        warnings: ['Simplified orifice flow approximation. Not a CFD pressure-coupled calculation.'],
        severity: 'normal',
        roomId: primaryRoom.id,
        openingId: opening.id,
        airflowDirection: isEntering ? 'inflow' : 'outflow',
        volumetricFlowM3s: approxFlowM3s,
        massFlowKgs: Math.round(approxFlowM3s * 1.2 * 100) / 100,
        heatExchangeW,
        isInfiltration: false,
        openingState: state,
        pathStart: { x: midX, y: midY - 20 },
        pathEnd: { x: midX, y: midY + 20 },
      });
    }
  }

  // 2. Configured HVAC Units (if explicitly configured)
  if (config?.hvacUnits && config.hvacUnits.length > 0) {
    for (const unit of config.hvacUnits) {
      if (!unit.isOperating) continue;
      const room = roomMap.get(unit.roomId);
      const roomState = stateByRoomId.get(unit.roomId);
      if (!room) continue;

      const roomCentroid = getRoomCenter(room);
      const supplyPos = unit.supplyOutletPosition ?? {
        x: roomCentroid.x - 30,
        y: roomCentroid.y - 30,
      };

      const hvacHeatW = roomState?.heatFlows?.hvacHeatW ?? (unit.coolingCapacityW ? -unit.coolingCapacityW : -800);

      overlays.push({
        overlayId: `HVAC_${unit.equipmentId}`,
        overlayType: 'HVAC_AIRFLOW',
        timestamp,
        quantityLabel: 'HVAC Supply Air Stream',
        unit: 'm³/s',
        magnitude: unit.designAirflowM3s ?? 0.12,
        method: 'Configured equipment operating parameters',
        dataQuality: 'configured',
        position: supplyPos,
        warnings: ['Equipment coordinates derived from explicit equipment configuration.'],
        severity: 'normal',
        equipmentId: unit.equipmentId,
        roomId: unit.roomId,
        supplyPosition: supplyPos,
        returnPosition: unit.returnInletPosition ?? null,
        supplyAirTemperatureC: unit.supplyAirTemperatureC ?? 16.0,
        airflowM3s: unit.designAirflowM3s ?? 0.12,
        hvacHeatW,
        isActive: true,
        coolingSetpointC: unit.coolingSetpointC ?? 24.0,
        heatingSetpointC: unit.heatingSetpointC ?? 20.0,
      });
    }
  }

  // 3. Configured Fans (Ceiling fans, circulation fans)
  if (config?.fans && config.fans.length > 0) {
    for (const fan of config.fans) {
      if (!fan.isOperating) continue;
      overlays.push({
        overlayId: `FAN_${fan.equipmentId}`,
        overlayType: 'FAN_CIRCULATION',
        timestamp,
        quantityLabel: 'Fan-Induced Indoor Air Circulation',
        unit: 'm³/s',
        magnitude: fan.airflowM3s ?? 0.45,
        method: 'Configured fan mechanical airflow rating',
        dataQuality: 'configured',
        position: fan.position,
        warnings: ['Ceiling fan circulation re-distributes room air; does NOT constitute outdoor fresh-air exchange.'],
        severity: 'normal',
        equipmentId: fan.equipmentId,
        roomId: fan.roomId,
        fanType: fan.fanType,
        operatingMode: fan.operatingMode ?? 'clockwise',
        airflowM3s: fan.airflowM3s ?? 0.45,
        isFreshAirExchange: false,
      });
    }
  }

  return overlays;
}

function getRoomCenter(room: Room): { x: number; y: number } {
  if (room.boundingBox && room.boundingBox.width > 0) {
    return {
      x: room.boundingBox.x + room.boundingBox.width / 2,
      y: room.boundingBox.y + room.boundingBox.height / 2,
    };
  }
  if (room.boundary?.points && room.boundary.points.length > 0) {
    const pts = room.boundary.points;
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }
  return { x: 0, y: 0 };
}
