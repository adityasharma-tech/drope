/**
 * Heat-Flow Physical Overlay Calculator
 *
 * Translates thermal simulation output + floor-plan geometry into
 * strongly-typed PhysicalOverlay records, one per physical phenomenon:
 *
 * 1. Conductive heat flux through each exterior wall segment (wall-normal arrows).
 * 2. Conductive heat flux through interior partitions between adjacent rooms.
 * 3. Solar radiation overlay at each window opening.
 *
 * Coordinates:
 * - All positions are in the same pixel space as FloorPlanModel.
 * - Arrow direction vectors are normalised wall-normals computed from
 *   (endPoint - startPoint) rotated 90°, pointing outward from the room.
 *
 * Physical relationships:
 * - Q̇_wall = U_wall × A_wall × (T_out – T_room)  [W]
 * - Q̇_partition = U_part × A_partition × (T_adj – T_room)  [W]
 * - Q̇_solar = A_window × I_vert × SHGC  [W]
 *
 * Sign convention: positive magnitude = heat entering the room.
 */

import { FloorPlanModel, Wall, Opening } from '../floorplan/geometry-extraction';
import { ThermalSimulationOutput, RoomHourlyThermalState, DEFAULT_CONSTRUCTION_ASSUMPTIONS } from '../thermal/thermal-types';
import {
  ConductiveHeatOverlay,
  SolarRadiationOverlay,
  DirectionVector,
  PhysicalOverlayCollection,
} from './overlay-types';

/**
 * Computes the normalised inward-facing wall-normal vector for a wall segment.
 * "Inward" means toward the interior of the building / room.
 *
 * In SVG pixel space: x→right, y→down.
 * Wall direction: d = end − start.
 * Left-hand perpendicular (90° CCW): n = (−dy, dx).
 * Right-hand perpendicular (90° CW): n = (dy, −dx).
 *
 * We compute both candidates, then pick the one whose dot product with the
 * vector from the wall midpoint to the room centroid is positive (inward).
 */
function computeWallNormal(
  wall: Wall,
  roomCentroidX: number,
  roomCentroidY: number,
  inward: boolean,
): DirectionVector {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return { dx: 0, dy: inward ? 1 : -1 };

  // Left-hand perpendicular (CCW 90°)
  const lx = -dy / len;
  const ly = dx / len;

  // Midpoint of wall
  const mx = (wall.startPoint.x + wall.endPoint.x) / 2;
  const my = (wall.startPoint.y + wall.endPoint.y) / 2;

  // Vector from midpoint to room centroid
  const toCx = roomCentroidX - mx;
  const toCy = roomCentroidY - my;

  // If left-perpendicular points toward centroid, it is the inward normal
  const leftInward = (lx * toCx + ly * toCy) > 0;

  let nx: number;
  let ny: number;

  if (inward) {
    // Return the normal pointing inward (toward room centroid)
    [nx, ny] = leftInward ? [lx, ly] : [dy / len, -dx / len];
  } else {
    // Outward
    [nx, ny] = leftInward ? [dy / len, -dx / len] : [lx, ly];
  }

  return { dx: nx, dy: ny };
}

/**
 * Computes room polygon centroid.
 */
function getRoomCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

/**
 * Returns wall midpoint.
 */
function wallMidpoint(wall: Wall): { x: number; y: number } {
  return {
    x: (wall.startPoint.x + wall.endPoint.x) / 2,
    y: (wall.startPoint.y + wall.endPoint.y) / 2,
  };
}

/**
 * Main function: generates all conductive and solar overlays for a given timestamp.
 */
export function calculateHeatFlowOverlays(
  geometry: FloorPlanModel,
  simulation: ThermalSimulationOutput,
  timestamp: string,
  /** Minimum absolute heat flow in W below which no overlay is generated */
  minMagnitudeW = 5,
): PhysicalOverlayCollection {
  const hourlyStates = simulation.hourlyRoomStates[timestamp] ?? [];
  const stateByRoomId = new Map<string, RoomHourlyThermalState>();
  for (const s of hourlyStates) stateByRoomId.set(s.roomId, s);

  const wallMap = new Map(geometry.walls.map((w) => [w.id, w]));
  const assumptions = simulation.buildingAssumptions ?? DEFAULT_CONSTRUCTION_ASSUMPTIONS;

  const overlays: (ConductiveHeatOverlay | SolarRadiationOverlay)[] = [];
  const warnings: string[] = [];
  const limitations: string[] = [
    'Heat flux magnitudes are room-level lumped values, not local surface measurements.',
    'Wall-normal arrows are placed at wall segment midpoints.',
    'Solar gain uses simplified vertical-surface irradiance model with approximate solar position.',
  ];

  // Track which walls have already received an overlay to avoid duplicates
  const processedWallRoomPairs = new Set<string>();

  for (const room of geometry.rooms) {
    const state = stateByRoomId.get(room.id);
    if (!state) continue;

    const hf = state.heatFlows;
    const pts = room.boundary?.points ?? [];
    if (pts.length < 3) continue;

    const centroid = getRoomCentroid(pts);
    const numExtWalls = (room.exteriorWallIds ?? []).length;

    // ── 1. Exterior Wall Conductive Heat Flux ────────────────────────────────
    const extWallIds = room.exteriorWallIds ?? [];
    if (extWallIds.length > 0 && Math.abs(hf.exteriorWallConductionW) >= minMagnitudeW) {
      // Distribute the total wall conduction across individual exterior walls
      const qPerWall = hf.exteriorWallConductionW / Math.max(1, extWallIds.length);

      for (const wallId of extWallIds) {
        const wall = wallMap.get(wallId);
        if (!wall) {
          warnings.push(`Wall ${wallId} referenced by room ${room.id} not found in geometry.walls.`);
          continue;
        }

        const pairKey = `${room.id}::${wallId}::ext`;
        if (processedWallRoomPairs.has(pairKey)) continue;
        processedWallRoomPairs.add(pairKey);

        const mid = wallMidpoint(wall);
        const isEntering = qPerWall > 0;
        // Arrow direction: inward if heat entering, outward if leaving
        const direction = computeWallNormal(wall, centroid.x, centroid.y, isEntering);

        // Estimate area and ΔT for annotation (from simulation geometry if available)
        const roomGeom = simulation.roomGeometries?.[room.id];
        const wallAreaM2 = roomGeom?.exteriorWallAreaM2 != null
          ? roomGeom.exteriorWallAreaM2 / Math.max(1, numExtWalls)
          : null;
        const deltaT = state.outdoorTempC - state.temperatureC; // ΔT = T_out - T_room

        overlays.push({
          overlayId: `COND_EXT_${room.id}_${wallId}`,
          overlayType: 'CONDUCTIVE_HEAT',
          timestamp,
          quantityLabel: 'Exterior Wall Conductive Heat Flux',
          unit: 'W',
          magnitude: Math.abs(qPerWall),
          method: 'Q = U_wall × A_wall × (T_out − T_room)',
          dataQuality: 'simulated',
          position: mid,
          direction,
          warnings: wallAreaM2 === null ? ['Wall area unknown; flux distributed equally across exterior walls.'] : [],
          severity: 'normal',
          roomId: room.id,
          elementId: wallId,
          elementType: 'exterior-wall',
          adjacentRoomId: null,
          isEnteringRoom: isEntering,
          uValueWm2K: assumptions.exteriorWallUValue,
          areaM2: wallAreaM2 ?? 0,
          deltaTemperatureK: deltaT,
        });
      }
    }

    // ── 2. Interior Partition Heat Transfer ─────────────────────────────────
    if (Math.abs(hf.internalPartitionTransferW) >= minMagnitudeW && room.adjacentRoomIds.length > 0) {
      const qPerPartition = hf.internalPartitionTransferW / Math.max(1, room.adjacentRoomIds.length);

      for (const adjId of room.adjacentRoomIds) {
        const pairKey = [room.id, adjId].sort().join('::') + '::partition';
        if (processedWallRoomPairs.has(pairKey)) continue;
        processedWallRoomPairs.add(pairKey);

        // Find shared wall between room and adjId
        const sharedWall = geometry.walls.find(
          (w) => !w.isExterior &&
            w.boundingRoomIds.includes(room.id) &&
            w.boundingRoomIds.includes(adjId),
        );

        if (!sharedWall) {
          // No explicit shared wall found: use room centroid midpoint as fallback position
          const adjRoom = geometry.rooms.find((r) => r.id === adjId);
          const adjPts = adjRoom?.boundary?.points ?? [];
          const adjCentroid = getRoomCentroid(adjPts.length > 0 ? adjPts : [centroid]);
          const mid = {
            x: (centroid.x + adjCentroid.x) / 2,
            y: (centroid.y + adjCentroid.y) / 2,
          };
          const dx = adjCentroid.x - centroid.x;
          const dy = adjCentroid.y - centroid.y;
          const len = Math.hypot(dx, dy) || 1;
          const isEntering = qPerPartition > 0;
          const direction: DirectionVector = isEntering
            ? { dx: dx / len, dy: dy / len } // from adj toward this room
            : { dx: -dx / len, dy: -dy / len }; // from this room toward adj

          overlays.push({
            overlayId: `COND_PART_${room.id}_${adjId}`,
            overlayType: 'CONDUCTIVE_HEAT',
            timestamp,
            quantityLabel: 'Interior Partition Conductive Heat Transfer',
            unit: 'W',
            magnitude: Math.abs(qPerPartition),
            method: 'Q = U_partition × A_partition × (T_adj − T_room)',
            dataQuality: 'simulated',
            position: mid,
            direction,
            warnings: ['Shared wall not found in geometry; position approximated from room centroids.'],
            severity: 'warning',
            roomId: room.id,
            elementId: adjId,
            elementType: 'interior-partition',
            adjacentRoomId: adjId,
            isEnteringRoom: isEntering,
            uValueWm2K: assumptions.interiorPartitionUValue,
            areaM2: 0,
            deltaTemperatureK: (stateByRoomId.get(adjId)?.temperatureC ?? state.temperatureC) - state.temperatureC,
          });
          continue;
        }

        const mid = wallMidpoint(sharedWall);
        const isEntering = qPerPartition > 0;
        const direction = computeWallNormal(sharedWall, centroid.x, centroid.y, isEntering);
        const roomGeom = simulation.roomGeometries?.[room.id];
        const areaM2 = roomGeom?.partitionAreasToAdjacentRooms?.[adjId] ?? 0;
        const adjTempC = stateByRoomId.get(adjId)?.temperatureC ?? state.temperatureC;

        overlays.push({
          overlayId: `COND_PART_${room.id}_${adjId}`,
          overlayType: 'CONDUCTIVE_HEAT',
          timestamp,
          quantityLabel: 'Interior Partition Conductive Heat Transfer',
          unit: 'W',
          magnitude: Math.abs(qPerPartition),
          method: 'Q = U_partition × A_partition × (T_adj − T_room)',
          dataQuality: 'simulated',
          position: mid,
          direction,
          warnings: [],
          severity: 'normal',
          roomId: room.id,
          elementId: sharedWall.id,
          elementType: 'interior-partition',
          adjacentRoomId: adjId,
          isEnteringRoom: isEntering,
          uValueWm2K: assumptions.interiorPartitionUValue,
          areaM2,
          deltaTemperatureK: adjTempC - state.temperatureC,
        });
      }
    }

    // ── 3. Solar Radiation Overlay at Windows ────────────────────────────────
    if (hf.solarGainW >= minMagnitudeW) {
      const windowOpenings = room.openingIds
        .map((id) => geometry.openings.find((o) => o.id === id))
        .filter((o): o is (typeof geometry.openings)[number] => !!o && o.type.toLowerCase().includes('window'));

      if (windowOpenings.length === 0 && hf.solarGainW > 0) {
        warnings.push(`Room ${room.id} has solar gain (${hf.solarGainW}W) but no window openings found in geometry.openings.`);
      }

      const solarPerWindow = hf.solarGainW / Math.max(1, windowOpenings.length);
      const roomGeom = simulation.roomGeometries?.[room.id];
      const totalGlazingAreaM2 = roomGeom?.exteriorWindowAreaM2 ?? 0;
      const glazingPerWindow = totalGlazingAreaM2 / Math.max(1, windowOpenings.length);

      for (const opening of windowOpenings) {
        // Approximate sun direction: simplified noon-position for now
        const hourStr = timestamp.split('T')[1]?.split(':')[0];
        const hour = hourStr ? parseInt(hourStr, 10) : 12;
        const sunAzimuthDeg = (hour - 6) * 15; // 06:00 = 0°(E), 12:00 = 90°(S), 18:00 = 180°(W)
        const sunAzimuthRad = (sunAzimuthDeg * Math.PI) / 180;
        const sunDir: DirectionVector = {
          dx: Math.sin(sunAzimuthRad),
          dy: Math.cos(sunAzimuthRad), // In SVG down = positive y
        };

        overlays.push({
          overlayId: `SOLAR_${room.id}_${opening.id}`,
          overlayType: 'SOLAR_RADIATION',
          timestamp,
          quantityLabel: 'Solar Heat Gain through Glazing',
          unit: 'W',
          magnitude: Math.abs(solarPerWindow),
          method: 'Q_solar = A_window × I_vert × SHGC (simplified solar position model)',
          dataQuality: 'simulated',
          position: opening.positionOnWall,
          warnings: [],
          severity: 'normal',
          roomId: room.id,
          openingId: opening.id,
          globalHorizontalIrradianceWm2: 0, // Populated by caller from environmental profile
          verticalIrradianceWm2: glazingPerWindow > 0 ? solarPerWindow / (glazingPerWindow * assumptions.windowSHGC) : 0,
          shgc: assumptions.windowSHGC,
          glazingAreaM2: glazingPerWindow,
          transmittedGainW: solarPerWindow,
          sunDirection: sunDir,
          orientationKnown: false, // Sample geometry has no northAngleDeg
        });
      }
    }
  }

  const overlaysByType: Record<string, number> = {};
  for (const o of overlays) {
    overlaysByType[o.overlayType] = (overlaysByType[o.overlayType] ?? 0) + 1;
  }

  return {
    timestamp,
    overlays,
    diagnostics: {
      totalOverlays: overlays.length,
      overlaysByType,
      warnings,
      limitations,
    },
  };
}
