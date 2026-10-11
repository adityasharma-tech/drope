/**
 * Geometry to Thermal Property Adapter
 *
 * Translates raw extracted floor-plan geometry into thermal boundary inputs:
 * 1. Unit conversions: Feet/Inches/Pixels to SI Meters (m, m²)
 * 2. Net exterior wall areas (subtracting window and door openings)
 * 3. Shared partition area calculations between adjacent rooms
 * 4. Window area and solar facade orientation
 * 5. Room volume and thermal capacitance
 */

import { FloorPlanModel, Room, Wall, Opening } from '../floorplan/geometry-extraction';
import { ConstructionAssumptions, RoomThermalGeometry } from './thermal-types';

const SQFT_TO_M2 = 0.092903;
const FT_TO_M = 0.3048;

export interface ExtractedThermalProperties {
  roomGeometries: Record<string, RoomThermalGeometry>;
  warnings: string[];
  approximations: string[];
}

/**
 * Calculates pixel-to-meter scale factor from geometry scale calibrations.
 */
function determineScaleMPerPixel(model: FloorPlanModel, warnings: string[]): number {
  if (model.scale && model.scale.pixelsPerUnit && model.scale.realLength) {
    const unit = model.scale.realLength.unit.toLowerCase();
    const ppu = model.scale.pixelsPerUnit;
    if (ppu > 0) {
      if (unit === 'ft' || unit === 'feet') {
        return FT_TO_M / ppu;
      } else if (unit === 'm' || unit === 'meters' || unit === 'meter') {
        return 1.0 / ppu;
      } else if (unit === 'mm') {
        return 0.001 / ppu;
      } else if (unit === 'cm') {
        return 0.01 / ppu;
      } else if (unit === 'in' || unit === 'inches') {
        return 0.0254 / ppu;
      }
    }
  }

  // Fallback: estimate from building footprint and annotated width if available
  if (model.buildingMetadata?.buildingWidthReal && model.buildingFootprint) {
    const widthVal = model.buildingMetadata.buildingWidthReal.value;
    const unit = model.buildingMetadata.buildingWidthReal.unit.toLowerCase();
    const widthM = (unit === 'ft' || unit === 'feet') ? widthVal * FT_TO_M : widthVal;

    const xs = model.buildingFootprint.points.map((p) => p.x);
    const pixelWidth = Math.max(...xs) - Math.min(...xs);
    if (pixelWidth > 0 && widthM > 0) {
      warnings.push(`Scale calibrated from building footprint width (${widthM.toFixed(1)}m / ${pixelWidth}px).`);
      return widthM / pixelWidth;
    }
  }

  // Conservative default: assume typical 1200px image represents ~15m building width
  warnings.push('Scale calibration unavailable or invalid. Defaulting to 15m / 1200px (0.0125 m/px).');
  return 0.0125;
}

/**
 * Calculates net floor area of a room in square meters (m²).
 */
function resolveRoomAreaM2(room: Room, mPerPixel: number, approximations: string[]): number {
  if (room.areaReal && room.areaReal.value && room.areaReal.value > 0) {
    const unit = room.areaReal.unit.toLowerCase();
    if (unit === 'sqft' || unit === 'ft²' || unit === 'ft2') {
      return room.areaReal.value * SQFT_TO_M2;
    } else if (unit === 'm²' || unit === 'sqm' || unit === 'm2') {
      return room.areaReal.value;
    }
  }

  // Next fallback: annotated dimensions (Width x Depth)
  if (room.annotatedWidth?.value && room.annotatedDepth?.value) {
    const wUnit = room.annotatedWidth.unit.toLowerCase();
    const dUnit = room.annotatedDepth.unit.toLowerCase();
    const wM = (wUnit === 'ft' || wUnit === 'feet') ? room.annotatedWidth.value * FT_TO_M : room.annotatedWidth.value;
    const dM = (dUnit === 'ft' || dUnit === 'feet') ? room.annotatedDepth.value * FT_TO_M : room.annotatedDepth.value;
    return wM * dM;
  }

  // Geometry pixel fallback (Shoelace formula or bounding box)
  if (room.boundary && room.boundary.points && room.boundary.points.length >= 3) {
    const pts = room.boundary.points;
    let areaPixels = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      areaPixels += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const polygonAreaPixels = Math.abs(areaPixels) / 2.0;
    approximations.push(`Room ${room.id} (${room.label ?? room.type}) area calculated from pixel polygon.`);
    return polygonAreaPixels * mPerPixel * mPerPixel;
  }

  if (room.boundingBox && room.boundingBox.width > 0 && room.boundingBox.height > 0) {
    const boxAreaPixels = room.boundingBox.width * room.boundingBox.height;
    approximations.push(`Room ${room.id} area estimated from bounding box.`);
    return boxAreaPixels * mPerPixel * mPerPixel;
  }

  // Safety fallback for empty/undefined rooms
  approximations.push(`Room ${room.id} area unavailable. Using 12.0 m² fallback.`);
  return 12.0;
}

/**
 * Calculates wall length in meters.
 */
function calculateWallLengthM(wall: Wall, mPerPixel: number): number {
  if (wall.lengthReal && wall.lengthReal.value && wall.lengthReal.value > 0) {
    const unit = wall.lengthReal.unit.toLowerCase();
    return (unit === 'ft' || unit === 'feet') ? wall.lengthReal.value * FT_TO_M : wall.lengthReal.value;
  }

  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  const lenPx = Math.sqrt(dx * dx + dy * dy);
  return lenPx * mPerPixel;
}

/**
 * Calculates opening width in meters.
 */
function calculateOpeningWidthM(opening: Opening, mPerPixel: number): number {
  if (opening.widthReal && opening.widthReal.value && opening.widthReal.value > 0) {
    const unit = opening.widthReal.unit.toLowerCase();
    return (unit === 'ft' || unit === 'feet') ? opening.widthReal.value * FT_TO_M : opening.widthReal.value;
  }
  if (opening.widthPixels && opening.widthPixels > 0) {
    return opening.widthPixels * mPerPixel;
  }
  return 0.9; // Standard 90cm door or window width fallback
}

/**
 * Determines orientation of a wall segment relative to true North in degrees [0, 360).
 * In image space: +x is Right, +y is Down.
 * Default (northAngleDeg = 0) means image top is North:
 * - Top exterior wall faces North (0°)
 * - Right wall faces East (90°)
 * - Bottom wall faces South (180°)
 * - Left wall faces West (270°)
 */
function calculateWallNormalDeg(wall: Wall, northAngleDeg: number): number {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;

  // Normal vector points perpendicular to wall segment
  // If wall is horizontal (dy = 0), normal points up (-y -> North) or down (+y -> South)
  const angleRad = Math.atan2(dy, dx);
  let normalDeg = (angleRad * (180 / Math.PI) + 90) % 360;
  if (normalDeg < 0) normalDeg += 360;

  // Rotate by building North offset
  return (normalDeg + northAngleDeg) % 360;
}

/**
 * Extracts and prepares RoomThermalGeometry instances from a FloorPlanModel.
 */
export function extractThermalGeometry(
  model: FloorPlanModel,
  assumptions: ConstructionAssumptions,
): ExtractedThermalProperties {
  const warnings: string[] = [];
  const approximations: string[] = [];

  // Pass through any existing extraction warnings
  if (model.validationWarnings && model.validationWarnings.length > 0) {
    for (const w of model.validationWarnings) {
      warnings.push(`[Geometry warning] ${w.code}: ${w.message}`);
    }
  }

  const mPerPixel = determineScaleMPerPixel(model, warnings);
  const ceilingHeightM = assumptions.ceilingHeightM;
  const northAngleDeg = model.orientation?.northAngleDeg ?? 0;

  if (model.orientation?.northAngleDeg === null || model.orientation?.northAngleDeg === undefined) {
    approximations.push('Building North orientation is unspecified. Assuming drawing top is North (0°).');
  }

  // Index walls and openings
  const wallMap = new Map<string, Wall>();
  for (const w of model.walls) {
    wallMap.set(w.id, w);
  }

  const openingMap = new Map<string, Opening>();
  for (const o of model.openings) {
    openingMap.set(o.id, o);
  }

  const roomGeometries: Record<string, RoomThermalGeometry> = {};

  for (const room of model.rooms) {
    const areaM2 = resolveRoomAreaM2(room, mPerPixel, approximations);
    const volumeM3 = areaM2 * ceilingHeightM;
    const thermalCapacitanceJK = areaM2 * assumptions.effectiveThermalCapacitancePerM2;

    // Internal gains by normalized room type
    const normalizedType = room.type ? room.type.toLowerCase().replace(/\s+/g, '-') : 'default';
    const gainRateWPerM2 =
      assumptions.internalGainsByRoomTypeWPerM2[normalizedType] ??
      assumptions.internalGainsByRoomTypeWPerM2.default ??
      4.0;
    const baseInternalGainsW = areaM2 * gainRateWPerM2;

    // Collect exterior wall and window areas
    let grossExteriorWallAreaM2 = 0;
    let exteriorWindowAreaM2 = 0;
    const windowOrientations: { orientationDeg: number; areaM2: number }[] = [];

    // Openings belonging to room
    for (const oid of room.openingIds) {
      const opening = openingMap.get(oid);
      if (opening && opening.isExterior) {
        const isWindow = opening.type.toLowerCase().includes('window');
        const openWidthM = calculateOpeningWidthM(opening, mPerPixel);
        // Window height: typical 1.2m if not annotated
        const openHeightM = opening.heightReal?.value
          ? ((opening.heightReal.unit === 'ft' ? opening.heightReal.value * FT_TO_M : opening.heightReal.value))
          : 1.2;
        const openAreaM2 = openWidthM * openHeightM;

        if (isWindow) {
          exteriorWindowAreaM2 += openAreaM2;
          // Determine facade orientation
          let orientationDeg = 0;
          if (opening.wallId && wallMap.has(opening.wallId)) {
            orientationDeg = calculateWallNormalDeg(wallMap.get(opening.wallId)!, northAngleDeg);
          }
          windowOrientations.push({ orientationDeg, areaM2: openAreaM2 });
        }
      }
    }

    // Walls associated with room
    const partitionAreasToAdjacentRooms: Record<string, number> = {};

    for (const wid of room.wallIds) {
      const wall = wallMap.get(wid);
      if (!wall) continue;

      const wallLengthM = calculateWallLengthM(wall, mPerPixel);
      const grossWallAreaM2 = wallLengthM * ceilingHeightM;

      if (wall.isExterior) {
        grossExteriorWallAreaM2 += grossWallAreaM2;
      } else {
        // Interior partition
        for (const otherRoomId of wall.boundingRoomIds) {
          if (otherRoomId !== room.id) {
            partitionAreasToAdjacentRooms[otherRoomId] =
              (partitionAreasToAdjacentRooms[otherRoomId] ?? 0) + grossWallAreaM2;
          }
        }
      }
    }

    // Also verify rooms listed in adjacentRoomIds
    for (const adjId of room.adjacentRoomIds) {
      if (!partitionAreasToAdjacentRooms[adjId]) {
        // Shared partition area approximation: estimate from bounding box overlap or 3m baseline
        const approxSharedWallLength = 3.0; // 3 meters plausible contact length
        partitionAreasToAdjacentRooms[adjId] = approxSharedWallLength * ceilingHeightM;
        approximations.push(
          `Estimated shared partition between room ${room.id} and ${adjId} (${partitionAreasToAdjacentRooms[adjId].toFixed(1)} m²).`,
        );
      }
    }

    // Net opaque exterior wall area (gross wall minus window openings)
    const netExteriorWallAreaM2 = Math.max(0, grossExteriorWallAreaM2 - exteriorWindowAreaM2);

    // Single-story roof exposure equals room floor area
    const roofAreaM2 = (model.buildingMetadata?.totalFloors === 1 || !model.buildingMetadata?.totalFloors)
      ? areaM2
      : (room.isExteriorExposed ? areaM2 * 0.5 : 0);

    roomGeometries[room.id] = {
      roomId: room.id,
      roomLabel: room.label ?? room.id,
      roomType: room.type,
      floorAreaM2: Math.round(areaM2 * 100) / 100,
      volumeM3: Math.round(volumeM3 * 100) / 100,
      thermalCapacitanceJK: Math.round(thermalCapacitanceJK),
      exteriorWallAreaM2: Math.round(netExteriorWallAreaM2 * 100) / 100,
      exteriorWindowAreaM2: Math.round(exteriorWindowAreaM2 * 100) / 100,
      windowOrientations,
      partitionAreasToAdjacentRooms,
      roofAreaM2: Math.round(roofAreaM2 * 100) / 100,
      baseInternalGainsW: Math.round(baseInternalGainsW * 10) / 10,
    };
  }

  // Symmetrize shared partition areas so energy exchange strictly conserves (Q_i_j = -Q_j_i)
  const roomIds = Object.keys(roomGeometries);
  for (const rId of roomIds) {
    const rGeom = roomGeometries[rId];
    for (const adjId of Object.keys(rGeom.partitionAreasToAdjacentRooms)) {
      if (roomGeometries[adjId]) {
        const area1 = rGeom.partitionAreasToAdjacentRooms[adjId];
        const area2 = roomGeometries[adjId].partitionAreasToAdjacentRooms[rId] ?? area1;
        const avgArea = Math.round(((area1 + area2) / 2.0) * 100) / 100;
        rGeom.partitionAreasToAdjacentRooms[adjId] = avgArea;
        roomGeometries[adjId].partitionAreasToAdjacentRooms[rId] = avgArea;
      }
    }
  }

  return {
    roomGeometries,
    warnings,
    approximations,
  };
}
