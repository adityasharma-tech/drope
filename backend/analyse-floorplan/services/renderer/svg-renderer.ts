/**
 * SVG Thermal Floor-Plan Vector Renderer
 *
 * Implements deterministic vector rendering of building physics:
 * 1. Computes SVG viewBox preserving exact image/geometry coordinate space.
 * 2. Layer 1: Continuous spatial temperature gradients clipped strictly to room polygons.
 * 3. Layer 2: Architectural fixtures (beds, sanitary, counters).
 * 4. Layer 3: Opaque exterior walls (thick) and interior partitions.
 * 5. Layer 4: Openings (doors with swings, windows, and state indicators).
 * 6. Layer 5: Configured HVAC equipment and ceiling fans (never fabricated).
 * 7. Layer 6: Physical heat flux arrows (wall-normal, Watts-proportional, distinct inward/outward).
 * 8. Layer 7: Shared partition heat transfer vectors at partition boundaries.
 * 9. Layer 8: Solar incidence indicators & direct glazing heat gain at windows.
 * 10. Layer 9: Airflow streamlines through configured open apertures & HVAC supplies.
 * 11. Layer 10: Room labels, room IDs, and simulated temperature badges (°C).
 * 12. Layer 11: True North indicator.
 * 13. Layer 12: Comprehensive scientific legend explaining all physical quantities and units.
 */

import { FloorPlanModel, Room, Wall, Opening } from '../floorplan/geometry-extraction';
import { ThermalSimulationOutput } from '../thermal/thermal-types';
import {
  ColorScaleConfig,
  RenderedSvgResult,
  SvgRenderOptions,
  SvgRendererInput,
} from './renderer-types';
import {
  buildSvgGradientStops,
  temperatureToColor,
} from './temperature-colormap';
import { generateSpatialTemperatureField } from './spatial-temperature-field';
import { calculateHeatFlowOverlays } from './heat-flow-overlays';
import { calculateAirflowOverlays } from './airflow-overlays';
import {
  ConductiveHeatOverlay,
  SolarRadiationOverlay,
  VentilationOverlay,
  HvacAirflowOverlay,
  FanCirculationOverlay,
  PhysicalOverlayCollection,
} from './overlay-types';

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Resolves global color scale across the simulation window to guarantee
 * consistent colors across different timestamps.
 */
function resolveGlobalColorScale(
  sim: ThermalSimulationOutput,
  override?: Partial<ColorScaleConfig>,
): ColorScaleConfig {
  let minT = Infinity;
  let maxT = -Infinity;

  for (const summary of Object.values(sim.roomSummaries)) {
    if (summary.minTemperatureC < minT) minT = summary.minTemperatureC;
    if (summary.maxTemperatureC > maxT) maxT = summary.maxTemperatureC;
  }

  // Fallback if summaries are empty
  if (minT === Infinity) minT = 18.0;
  if (maxT === -Infinity) maxT = 32.0;

  // Add 0.5°C padding on each side and round to nearest 0.5°C
  const paddedMin = Math.floor((minT - 0.5) * 2) / 2;
  const paddedMax = Math.ceil((maxT + 0.5) * 2) / 2;

  return {
    minTempC: override?.minTempC ?? paddedMin,
    maxTempC: override?.maxTempC ?? paddedMax,
    missingDataColorHex: override?.missingDataColorHex ?? '#cbd5e1',
    customStops: override?.customStops,
  };
}

/**
 * Computes bounding box in pixel space to enclose image or extracted geometry.
 */
function computeCanvasBounds(
  geometry: FloorPlanModel,
): { minX: number; minY: number; width: number; height: number } {
  if (geometry.imageMetadata?.widthPixels && geometry.imageMetadata?.heightPixels) {
    return {
      minX: 0,
      minY: 0,
      width: geometry.imageMetadata.widthPixels,
      height: geometry.imageMetadata.heightPixels,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of geometry.rooms) {
    if (r.boundary?.points) {
      for (const p of r.boundary.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  for (const w of geometry.walls) {
    if (w.startPoint.x < minX) minX = w.startPoint.x;
    if (w.startPoint.x > maxX) maxX = w.startPoint.x;
    if (w.startPoint.y < minY) minY = w.startPoint.y;
    if (w.startPoint.y > maxY) maxY = w.startPoint.y;
    if (w.endPoint.x < minX) minX = w.endPoint.x;
    if (w.endPoint.x > maxX) maxX = w.endPoint.x;
    if (w.endPoint.y < minY) minY = w.endPoint.y;
    if (w.endPoint.y > maxY) maxY = w.endPoint.y;
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, width: 1200, height: 800 };
  }

  const margin = 50;
  return {
    minX: Math.max(0, minX - margin),
    minY: Math.max(0, minY - margin),
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}

/**
 * Computes polygon centroid for placing room temperature labels.
 */
function getRoomCenter(room: Room): { x: number; y: number } {
  if (room.boundingBox && room.boundingBox.width > 0) {
    return {
      x: room.boundingBox.x + room.boundingBox.width / 2,
      y: room.boundingBox.y + room.boundingBox.height / 2,
    };
  }
  if (room.boundary?.points && room.boundary.points.length > 0) {
    const pts = room.boundary.points;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumY = pts.reduce((s, p) => s + p.y, 0);
    return { x: sumX / pts.length, y: sumY / pts.length };
  }
  return { x: 0, y: 0 };
}

/**
 * Main SVG Thermal Renderer
 */
export function renderThermalFloorPlanSvg(input: SvgRendererInput): RenderedSvgResult {
  const { geometry, simulation, options = {} } = input;

  const showLabels = options.showLabels ?? true;
  const showWallsAndOpenings = options.showWallsAndOpenings ?? true;
  const showLegend = options.showLegend ?? true;
  const showNorthArrow = options.showNorthArrow ?? true;
  const showFixtures = options.showFixtures ?? true;
  const showHeatFluxVectors = options.showHeatFluxVectors ?? true;
  const showPhysicalOverlays = options.showPhysicalOverlays ?? true;
  const enableSpatialGradients = options.enableSpatialGradients ?? true;
  const bgHex = options.backgroundColorHex ?? '#f8fafc';
  const fontFamily = options.fontFamily ?? 'Inter, system-ui, -apple-system, sans-serif';

  // 1. Determine simulation timestamp to visualize
  const availableTimestamps = Object.keys(simulation.hourlyRoomStates);
  if (availableTimestamps.length === 0) {
    throw new Error('Renderer failed: Simulation output contains 0 hourly room states.');
  }

  let selectedTimestamp = options.timestamp;
  if (!selectedTimestamp || !simulation.hourlyRoomStates[selectedTimestamp]) {
    // Pick the peak thermal gradient frame (highest room temperature spread)
    let maxSpread = -1;
    selectedTimestamp = availableTimestamps[0];
    for (const ts of availableTimestamps) {
      const states = simulation.hourlyRoomStates[ts];
      const temps = states.map((s) => s.temperatureC);
      const spread = Math.max(...temps) - Math.min(...temps);
      if (spread > maxSpread) {
        maxSpread = spread;
        selectedTimestamp = ts;
      }
    }
  }

  const hourlyStates = simulation.hourlyRoomStates[selectedTimestamp] ?? [];
  const stateByRoomId = new Map(hourlyStates.map((s) => [s.roomId, s]));
  const outdoorTempC = hourlyStates[0]?.outdoorTempC ?? 25.0;

  // 2. Resolve persistent color scale
  const colorScale = resolveGlobalColorScale(simulation, options.colorScale);

  // 3. Optional Spatial Field calculation
  const spatialField = enableSpatialGradients
    ? generateSpatialTemperatureField(geometry, simulation, selectedTimestamp, 25)
    : null;

  // 4. Calculate Strongly-Typed Physical Overlays
  const heatOverlays = showHeatFluxVectors
    ? calculateHeatFlowOverlays(geometry, simulation, selectedTimestamp)
    : { timestamp: selectedTimestamp, overlays: [], diagnostics: { totalOverlays: 0, overlaysByType: {}, warnings: [], limitations: [] } };

  const airflowOverlays = showPhysicalOverlays
    ? calculateAirflowOverlays(geometry, simulation, selectedTimestamp, options.ventilationConfig)
    : [];

  const combinedOverlayCollection: PhysicalOverlayCollection = {
    timestamp: selectedTimestamp,
    overlays: [...heatOverlays.overlays, ...airflowOverlays],
    diagnostics: {
      totalOverlays: heatOverlays.overlays.length + airflowOverlays.length,
      overlaysByType: {
        ...heatOverlays.diagnostics.overlaysByType,
        VENTILATION: airflowOverlays.filter((o) => o.overlayType === 'VENTILATION').length,
        HVAC_AIRFLOW: airflowOverlays.filter((o) => o.overlayType === 'HVAC_AIRFLOW').length,
        FAN_CIRCULATION: airflowOverlays.filter((o) => o.overlayType === 'FAN_CIRCULATION').length,
      },
      warnings: [...heatOverlays.diagnostics.warnings],
      limitations: [...heatOverlays.diagnostics.limitations],
    },
  };

  // 5. Canvas bounds & viewbox
  const bounds = computeCanvasBounds(geometry);
  const legendHeight = showLegend ? 155 : 0;
  const totalSvgWidth = Math.max(900, bounds.width);
  const totalSvgHeight = bounds.height + legendHeight;

  // Diagnostics tracking
  const missingRoomTemps: string[] = [];
  const renderedRoomTemperatures: Record<string, number | null> = {};

  // Layer arrays
  const defsParts: string[] = [];
  const roomSvgParts: string[] = [];
  const fixtureSvgParts: string[] = [];
  const wallSvgParts: string[] = [];
  const openingSvgParts: string[] = [];
  const equipmentSvgParts: string[] = [];
  const heatVectorSvgParts: string[] = [];
  const airflowSvgParts: string[] = [];
  const labelSvgParts: string[] = [];

  // Arrow markers and patterns
  defsParts.push(
    `    <!-- Arrowhead markers for physical heat-flux vectors (Conduction) -->` +
    `\n    <marker id="heatArrowIn" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">` +
    `\n      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#ea580c" />` +
    `\n    </marker>` +
    `\n    <marker id="heatArrowOut" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">` +
    `\n      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284c7" />` +
    `\n    </marker>` +
    `\n    <!-- Arrowhead markers for airflow streamlines -->` +
    `\n    <marker id="airStreamArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">` +
    `\n      <path d="M 0 2 L 8 5 L 0 8 z" fill="#06b6d4" />` +
    `\n    </marker>` +
    `\n    <!-- Marker for partition transfer -->` +
    `\n    <marker id="partitionArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">` +
    `\n      <path d="M 0 2 L 8 5 L 0 8 z" fill="#8b5cf6" />` +
    `\n    </marker>`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 1: Room Thermal Fills & Gradients (Clipped per polygon)
  // ─────────────────────────────────────────────────────────────────────────
  for (const room of geometry.rooms) {
    const state = stateByRoomId.get(room.id);
    const meanTemp = state?.temperatureC ?? null;
    renderedRoomTemperatures[room.id] = meanTemp;

    if (meanTemp === null) {
      missingRoomTemps.push(room.id);
    }

    const baseColor = temperatureToColor(meanTemp, colorScale);
    const hasPoints = room.boundary?.points && room.boundary.points.length >= 3;
    const clipId = `clip-${room.id}`;

    if (hasPoints) {
      const pointsAttr = room.boundary.points.map((p) => `${p.x},${p.y}`).join(' ');

      // Register clipPath
      defsParts.push(
        `    <clipPath id="${clipId}">\n      <polygon points="${pointsAttr}" />\n    </clipPath>`,
      );

      if (enableSpatialGradients && spatialField?.roomFields[room.id]) {
        const rf = spatialField.roomFields[room.id];
        const gradId = `thermalGrad-${room.id}`;
        const centerColor = temperatureToColor(rf.meanTemperatureC, colorScale);
        const perimeterColor = temperatureToColor(
          outdoorTempC > rf.meanTemperatureC ? rf.maxPointTempC : rf.minPointTempC,
          colorScale,
        );

        // SVG Radial Gradient matching physical room center to perimeter heat flux
        defsParts.push(
          `    <radialGradient id="${gradId}" cx="${rf.svgGradient?.cx.toFixed(1)}" cy="${rf.svgGradient?.cy.toFixed(1)}" r="${rf.svgGradient?.r.toFixed(1)}" gradientUnits="userSpaceOnUse">` +
            `\n      <stop offset="0%" stop-color="${centerColor}" stop-opacity="0.95" />` +
            `\n      <stop offset="80%" stop-color="${perimeterColor}" stop-opacity="0.90" />` +
            `\n      <stop offset="100%" stop-color="${perimeterColor}" stop-opacity="0.85" />` +
            `\n    </radialGradient>`,
        );

        roomSvgParts.push(
          `    <polygon id="room-${escapeXml(room.id)}" points="${pointsAttr}" fill="url(#${gradId})" clip-path="url(#${clipId})" stroke="#475569" stroke-width="1.5">` +
            `\n      <title>${escapeXml(room.label ?? room.id)}: ${meanTemp !== null ? `${meanTemp.toFixed(1)}°C (Simulated Range: ${rf.minPointTempC.toFixed(1)} - ${rf.maxPointTempC.toFixed(1)}°C)` : 'No Data'}</title>` +
            `\n    </polygon>`,
        );
      } else {
        // Flat room-level fallback
        const strokeStyle = meanTemp === null ? 'stroke="#94a3b8" stroke-dasharray="4,4"' : 'stroke="#475569" stroke-width="1.5"';
        roomSvgParts.push(
          `    <polygon id="room-${escapeXml(room.id)}" points="${pointsAttr}" fill="${baseColor}" fill-opacity="0.88" ${strokeStyle}>` +
            `\n      <title>${escapeXml(room.label ?? room.id)}: ${meanTemp !== null ? `${meanTemp.toFixed(1)}°C` : 'No temperature data'}</title>` +
            `\n    </polygon>`,
        );
      }
    } else if (room.boundingBox) {
      roomSvgParts.push(
        `    <rect id="room-${escapeXml(room.id)}" x="${room.boundingBox.x}" y="${room.boundingBox.y}" width="${room.boundingBox.width}" height="${room.boundingBox.height}" fill="${baseColor}" fill-opacity="0.88" stroke="#475569" stroke-width="1.5">` +
          `\n      <title>${escapeXml(room.label ?? room.id)}: ${meanTemp !== null ? `${meanTemp.toFixed(1)}°C` : 'No temperature data'}</title>` +
          `\n    </rect>`,
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Layer 2: Architectural Fixtures (Beds, Counters, Sinks)
    // ───────────────────────────────────────────────────────────────────────
    if (showFixtures && room.fixtures && room.fixtures.length > 0) {
      for (const fix of room.fixtures) {
        if (!fix.boundingBox) continue;
        const b = fix.boundingBox;
        const cat = fix.category?.toLowerCase() ?? 'fixture';

        let fixtureColor = '#94a3b8';
        if (cat.includes('bed')) {
          fixtureColor = '#64748b';
        } else if (cat.includes('sink') || cat.includes('toilet') || cat.includes('bath')) {
          fixtureColor = '#38bdf8';
        } else if (cat.includes('stove') || cat.includes('oven')) {
          fixtureColor = '#f97316';
        }

        fixtureSvgParts.push(
          `    <rect id="fix-${escapeXml(fix.id)}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="3" fill="#ffffff" fill-opacity="0.4" stroke="${fixtureColor}" stroke-width="1.2">` +
            `\n      <title>${escapeXml(fix.label ?? fix.category)}</title>` +
            `\n    </rect>`,
        );
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Layer 10: Room Labels & Temperature Badges
    // ───────────────────────────────────────────────────────────────────────
    if (showLabels) {
      const center = getRoomCenter(room);
      const roomLabelText = room.label ? room.label.toUpperCase() : room.id;
      const tempText = meanTemp !== null ? `${meanTemp.toFixed(1)}°C` : 'N/A';
      const hf = state?.heatFlows;
      const netText = hf ? `Net: ${hf.netHeatFlowW > 0 ? '+' : ''}${hf.netHeatFlowW.toFixed(0)}W` : '';

      labelSvgParts.push(
        `    <g class="room-label" transform="translate(${center.x.toFixed(1)}, ${center.y.toFixed(1)})" text-anchor="middle" pointer-events="none">` +
          `\n      <rect x="-52" y="-22" width="104" height="42" rx="4" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="1" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))" />` +
          `\n      <text y="-7" font-family="${escapeXml(fontFamily)}" font-size="9.5" font-weight="600" fill="#0f172a">${escapeXml(roomLabelText)}</text>` +
          `\n      <text y="7" font-family="${escapeXml(fontFamily)}" font-size="11" font-weight="700" fill="#1e293b">${escapeXml(tempText)}</text>` +
          `\n      <text y="17" font-family="${escapeXml(fontFamily)}" font-size="7.5" font-weight="500" fill="#64748b">${escapeXml(netText)}</text>` +
          `\n    </g>`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 3: Walls & Partitions Layer
  // ─────────────────────────────────────────────────────────────────────────
  if (showWallsAndOpenings) {
    for (const wall of geometry.walls) {
      const isExt = wall.isExterior;
      const strokeColor = isExt ? '#0f172a' : '#475569';
      const strokeWidth = isExt ? 6.0 : 3.0;
      wallSvgParts.push(
        `    <line id="wall-${escapeXml(wall.id)}" x1="${wall.startPoint.x}" y1="${wall.startPoint.y}" x2="${wall.endPoint.x}" y2="${wall.endPoint.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`,
      );
    }

    // Layer 4: Openings (Windows and Doors)
    for (const op of geometry.openings) {
      const isWin = op.type.toLowerCase().includes('window');
      const px = op.positionOnWall.x;
      const py = op.positionOnWall.y;
      const widthPx = op.widthPixels ?? 40;
      const opConfig = options.ventilationConfig?.openingStates?.[op.id];
      const stateBadge = opConfig?.state ? ` [${opConfig.state.toUpperCase()}]` : '';

      if (isWin) {
        openingSvgParts.push(
          `    <g id="opening-${escapeXml(op.id)}" transform="translate(${px}, ${py})">` +
            `\n      <line x1="-${(widthPx / 2).toFixed(1)}" y1="0" x2="${(widthPx / 2).toFixed(1)}" y2="0" stroke="#0284c7" stroke-width="4" stroke-linecap="square" />` +
            `\n      <line x1="-${(widthPx / 2).toFixed(1)}" y1="-2" x2="${(widthPx / 2).toFixed(1)}" y2="-2" stroke="#38bdf8" stroke-width="1.5" />` +
            `\n      <title>Window ${escapeXml(op.id)}${stateBadge}</title>` +
            `\n    </g>`,
        );
      } else {
        const hx = op.hingePoint ? op.hingePoint.x - px : -widthPx / 2;
        const hy = op.hingePoint ? op.hingePoint.y - py : 0;
        openingSvgParts.push(
          `    <g id="opening-${escapeXml(op.id)}" transform="translate(${px}, ${py})">` +
            `\n      <line x1="${hx}" y1="${hy}" x2="${widthPx / 2}" y2="0" stroke="#d97706" stroke-width="2.5" />` +
            `\n      <circle cx="${hx}" cy="${hy}" r="2" fill="#d97706" />` +
            `\n      <title>Door ${escapeXml(op.id)}${stateBadge}</title>` +
            `\n    </g>`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 5: Configured Equipment (HVAC Units & Fans)
  // ─────────────────────────────────────────────────────────────────────────
  if (options.ventilationConfig) {
    if (options.ventilationConfig.hvacUnits) {
      for (const unit of options.ventilationConfig.hvacUnits) {
        if (!unit.supplyOutletPosition) continue;
        const sp = unit.supplyOutletPosition;
        equipmentSvgParts.push(
          `    <g id="equip-${escapeXml(unit.equipmentId)}" transform="translate(${sp.x}, ${sp.y})">` +
            `\n      <rect x="-16" y="-8" width="32" height="16" rx="2" fill="#0284c7" fill-opacity="0.8" stroke="#0369a1" stroke-width="1.5" />` +
            `\n      <text y="4" font-family="${escapeXml(fontFamily)}" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">AC</text>` +
            `\n      <title>HVAC Unit ${escapeXml(unit.equipmentId)} (${unit.equipmentType}): ${unit.isOperating ? 'ON' : 'OFF'}</title>` +
            `\n    </g>`,
        );
      }
    }

    if (options.ventilationConfig.fans) {
      for (const fan of options.ventilationConfig.fans) {
        const fp = fan.position;
        equipmentSvgParts.push(
          `    <g id="equip-${escapeXml(fan.equipmentId)}" transform="translate(${fp.x}, ${fp.y})">` +
            `\n      <circle r="12" fill="#ffffff" fill-opacity="0.8" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3,2" />` +
            `\n      <circle r="3" fill="#0f172a" />` +
            `\n      <text y="3" font-family="${escapeXml(fontFamily)}" font-size="7.5" font-weight="700" fill="#0f172a" text-anchor="middle">FAN</text>` +
            `\n      <title>Fan ${escapeXml(fan.equipmentId)}: ${fan.isOperating ? 'ON' : 'OFF'}</title>` +
            `\n    </g>`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 6 & 7 & 8: Physical Heat Flux Overlays (Conduction, Partition, Solar)
  // ─────────────────────────────────────────────────────────────────────────
  if (showHeatFluxVectors) {
    for (const ov of combinedOverlayCollection.overlays) {
      if (ov.overlayType === 'CONDUCTIVE_HEAT') {
        const cond = ov as ConductiveHeatOverlay;
        const px = cond.position.x;
        const py = cond.position.y;
        const isExt = cond.elementType === 'exterior-wall';
        const isEntering = cond.isEnteringRoom;

        const arrowColor = isExt ? (isEntering ? '#ea580c' : '#0284c7') : '#8b5cf6';
        const marker = isExt ? (isEntering ? 'url(#heatArrowIn)' : 'url(#heatArrowOut)') : 'url(#partitionArrow)';
        const arrowLen = Math.min(32, Math.max(16, 14 + (cond.magnitude / 20)));
        const dx = cond.direction.dx * arrowLen;
        const dy = cond.direction.dy * arrowLen;

        heatVectorSvgParts.push(
          `    <g class="heat-vector" transform="translate(${px.toFixed(1)}, ${py.toFixed(1)})">` +
            `\n      <line x1="${(-dx / 2).toFixed(1)}" y1="${(-dy / 2).toFixed(1)}" x2="${(dx / 2).toFixed(1)}" y2="${(dy / 2).toFixed(1)}" stroke="${arrowColor}" stroke-width="2.5" marker-end="${marker}" />` +
            `\n      <text x="${(dx / 2 + 5).toFixed(1)}" y="${(dy / 2 + 3).toFixed(1)}" font-family="${escapeXml(fontFamily)}" font-size="8.5" font-weight="600" fill="${arrowColor}">${cond.magnitude.toFixed(0)}W</text>` +
            `\n      <title>${escapeXml(cond.quantityLabel)}: ${cond.magnitude.toFixed(1)}W (${isEntering ? 'Entering' : 'Leaving'})</title>` +
            `\n    </g>`,
        );
      } else if (ov.overlayType === 'SOLAR_RADIATION') {
        const sol = ov as SolarRadiationOverlay;
        const sx = sol.position.x;
        const sy = sol.position.y;

        heatVectorSvgParts.push(
          `    <g class="solar-indicator" transform="translate(${sx.toFixed(1)}, ${sy.toFixed(1)})">` +
            `\n      <circle r="7.5" fill="#fbbf24" fill-opacity="0.85" stroke="#d97706" stroke-width="1.2" />` +
            `\n      <text y="3" font-family="${escapeXml(fontFamily)}" font-size="8.5" font-weight="700" fill="#78350f" text-anchor="middle">☀</text>` +
            `\n      <text x="11" y="3" font-family="${escapeXml(fontFamily)}" font-size="8" font-weight="600" fill="#d97706">+${sol.magnitude.toFixed(0)}W</text>` +
            `\n      <title>Solar Gain: +${sol.magnitude.toFixed(0)}W (SHGC=${sol.shgc.toFixed(2)})</title>` +
            `\n    </g>`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 9: Airflow Overlays (Ventilation & HVAC Supply Streamlines)
  // ─────────────────────────────────────────────────────────────────────────
  if (showPhysicalOverlays) {
    for (const ov of combinedOverlayCollection.overlays) {
      if (ov.overlayType === 'VENTILATION') {
        const vent = ov as VentilationOverlay;
        const x1 = vent.pathStart.x;
        const y1 = vent.pathStart.y;
        const x2 = vent.pathEnd.x;
        const y2 = vent.pathEnd.y;

        airflowSvgParts.push(
          `    <g class="airflow-stream" transform="translate(0, 0)">` +
            `\n      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="4,3" marker-end="url(#airStreamArrow)" />` +
            `\n      <text x="${((x1 + x2) / 2 + 5).toFixed(1)}" y="${((y1 + y2) / 2).toFixed(1)}" font-family="${escapeXml(fontFamily)}" font-size="8" font-weight="600" fill="#0891b2">${vent.magnitude.toFixed(2)} m³/s</text>` +
            `\n      <title>${escapeXml(vent.quantityLabel)}: ${vent.magnitude.toFixed(2)} m³/s (${vent.airflowDirection})</title>` +
            `\n    </g>`,
        );
      } else if (ov.overlayType === 'HVAC_AIRFLOW') {
        const hvac = ov as HvacAirflowOverlay;
        const sx = hvac.supplyPosition.x;
        const sy = hvac.supplyPosition.y;

        airflowSvgParts.push(
          `    <g class="hvac-stream" transform="translate(${sx.toFixed(1)}, ${sy.toFixed(1)})">` +
            `\n      <path d="M 0 0 C 15 10, 30 15, 45 25" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="3,2" marker-end="url(#airStreamArrow)" />` +
            `\n      <text x="15" y="32" font-family="${escapeXml(fontFamily)}" font-size="8" font-weight="600" fill="#0284c7">${hvac.airflowM3s?.toFixed(2)} m³/s (${hvac.supplyAirTemperatureC}°C)</text>` +
            `\n      <title>HVAC Supply: ${hvac.airflowM3s} m³/s @ ${hvac.supplyAirTemperatureC}°C (Cooling: ${hvac.hvacHeatW}W)</title>` +
            `\n    </g>`,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 11: True North Indicator
  // ─────────────────────────────────────────────────────────────────────────
  let northArrowSvg = '';
  if (showNorthArrow && geometry.orientation?.northAngleDeg !== null && geometry.orientation?.northAngleDeg !== undefined) {
    const northDeg = geometry.orientation.northAngleDeg;
    const arrowX = bounds.minX + bounds.width - 50;
    const arrowY = bounds.minY + 50;

    northArrowSvg =
      `  <g id="north-arrow" transform="translate(${arrowX}, ${arrowY}) rotate(${northDeg})">` +
      `\n    <circle r="22" fill="#ffffff" fill-opacity="0.9" stroke="#94a3b8" stroke-width="1.5" />` +
      `\n    <polygon points="0,-18 5,0 0,-4 -5,0" fill="#dc2626" />` +
      `\n    <polygon points="0,18 5,0 0,4 -5,0" fill="#64748b" />` +
      `\n    <text y="-8" font-family="${escapeXml(fontFamily)}" font-size="9" font-weight="700" fill="#dc2626" text-anchor="middle">N</text>` +
      `\n    <title>True North (${northDeg}°)</title>` +
      `\n  </g>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Layer 12: Comprehensive Scientific Legend & Metadata Bar
  // ─────────────────────────────────────────────────────────────────────────
  let legendSvg = '';
  if (showLegend) {
    const legendY = bounds.height + 15;
    const barWidth = 340;
    const barHeight = 14;
    const barX = 40;
    const barY = legendY + 56;

    const outdoorText = outdoorTempC !== null ? `${outdoorTempC.toFixed(1)}°C` : 'N/A';
    const gradientStops = buildSvgGradientStops(colorScale);

    const validTemps = Object.values(renderedRoomTemperatures).filter((t): t is number => t !== null);
    const statMin = validTemps.length > 0 ? Math.min(...validTemps).toFixed(1) : 'N/A';
    const statMax = validTemps.length > 0 ? Math.max(...validTemps).toFixed(1) : 'N/A';
    const statAvg = validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1) : 'N/A';

    legendSvg =
      `  <!-- Metadata and Scientific Temperature & Physical Overlays Legend -->` +
      `\n  <g id="thermal-legend" transform="translate(0, 0)">` +
      `\n    <rect x="0" y="${legendY}" width="${totalSvgWidth}" height="${legendHeight}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />` +
      `\n    <!-- Header and Timestamp -->` +
      `\n    <text x="40" y="${legendY + 22}" font-family="${escapeXml(fontFamily)}" font-size="13" font-weight="700" fill="#0f172a">BUILDING THERMAL &amp; AIRFLOW SIMULATION</text>` +
      `\n    <text x="40" y="${legendY + 39}" font-family="${escapeXml(fontFamily)}" font-size="10" fill="#64748b">Timestamp: <tspan font-weight="600" fill="#1e293b">${escapeXml(selectedTimestamp)}</tspan> | Outdoor: <tspan font-weight="600" fill="#1e293b">${escapeXml(outdoorText)}</tspan> | Room Mean: <tspan font-weight="600" fill="#1e293b">${statAvg}°C</tspan> (Min: ${statMin}°C, Max: ${statMax}°C)</text>` +
      `\n    <!-- Colorbar Gradient -->` +
      `\n    <defs>` +
      `\n      <linearGradient id="tempGradient" x1="0%" y1="0%" x2="100%" y2="0%">\n${gradientStops}\n      </linearGradient>` +
      `\n    </defs>` +
      `\n    <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="url(#tempGradient)" stroke="#94a3b8" stroke-width="1" />` +
      `\n    <!-- Legend Scale Tick Marks -->` +
      `\n    <text x="${barX}" y="${barY + barHeight + 14}" font-family="${escapeXml(fontFamily)}" font-size="9.5" fill="#475569" text-anchor="middle">${colorScale.minTempC.toFixed(1)}°C</text>` +
      `\n    <text x="${barX + barWidth / 2}" y="${barY + barHeight + 14}" font-family="${escapeXml(fontFamily)}" font-size="9.5" fill="#475569" text-anchor="middle">${(((colorScale.minTempC + colorScale.maxTempC) / 2)).toFixed(1)}°C</text>` +
      `\n    <text x="${barX + barWidth}" y="${barY + barHeight + 14}" font-family="${escapeXml(fontFamily)}" font-size="9.5" fill="#475569" text-anchor="middle">${colorScale.maxTempC.toFixed(1)}°C</text>` +
      `\n    <!-- Physical Heat & Airflow Legends Row 1 -->` +
      `\n    <g transform="translate(${barX + barWidth + 25}, ${barY - 4})">` +
      `\n      <line x1="0" y1="8" x2="16" y2="8" stroke="#ea580c" stroke-width="2.5" marker-end="url(#heatArrowIn)" />` +
      `\n      <text x="22" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#475569">Heat Gain (W)</text>` +
      `\n      <line x1="90" y1="8" x2="106" y2="8" stroke="#0284c7" stroke-width="2.5" marker-end="url(#heatArrowOut)" />` +
      `\n      <text x="112" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#475569">Heat Loss (W)</text>` +
      `\n      <circle cx="185" cy="8" r="6" fill="#fbbf24" stroke="#d97706" stroke-width="1" />` +
      `\n      <text x="196" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#475569">Solar Gain (W)</text>` +
      `\n      <rect x="270" y="2" width="12" height="12" fill="${colorScale.missingDataColorHex}" stroke="#94a3b8" stroke-width="1" />` +
      `\n      <text x="288" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#64748b">No Data</text>` +
      `\n    </g>` +
      `\n    <!-- Physical Heat & Airflow Legends Row 2 -->` +
      `\n    <g transform="translate(${barX + barWidth + 25}, ${barY + 16})">` +
      `\n      <line x1="0" y1="8" x2="16" y2="8" stroke="#8b5cf6" stroke-width="2" marker-end="url(#partitionArrow)" />` +
      `\n      <text x="22" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#475569">Partition (W)</text>` +
      `\n      <line x1="90" y1="8" x2="106" y2="8" stroke="#06b6d4" stroke-width="2" stroke-dasharray="3,2" marker-end="url(#airStreamArrow)" />` +
      `\n      <text x="112" y="11" font-family="${escapeXml(fontFamily)}" font-size="8.5" fill="#475569">Airflow (m³/s)</text>` +
      `\n      <rect x="180" y="2" width="14" height="10" rx="2" fill="#0284c7" />` +
      `\n      <text x="198" y="10" font-family="${escapeXml(fontFamily)}" font-size="8" fill="#475569">HVAC Supply</text>` +
      `\n    </g>` +
      `\n    <!-- Disclaimer & Governance Notes -->` +
      `\n    <text x="40" y="${legendY + 112}" font-family="${escapeXml(fontFamily)}" font-size="8" fill="#94a3b8">GOVERNANCE: Deterministic transient room heat balance (ISO 13790 / ASHRAE fundamentals). Wall conduction calculated via Q=U·A·ΔT. Solar via incident angle and SHGC.</text>` +
      `\n    <text x="40" y="${legendY + 125}" font-family="${escapeXml(fontFamily)}" font-size="8" fill="#94a3b8">LIMITATION: Not a CFD (Computational Fluid Dynamics) velocity field. Airflow streamlines represent configured orifice paths and mechanical flows.</text>` +
      `\n  </g>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Complete Standalone SVG Assembly
  // ─────────────────────────────────────────────────────────────────────────
  const svgDoc = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSvgWidth} ${totalSvgHeight}" width="${totalSvgWidth}" height="${totalSvgHeight}">`,
    `  <desc>Scientific Thermal and Airflow Simulation for ${escapeXml(geometry.buildingMetadata?.title ?? 'Floor Plan')}</desc>`,
    `  <defs>\n${defsParts.join('\n')}\n  </defs>`,
    `  <!-- Layer 0: Background -->`,
    `  <rect width="${totalSvgWidth}" height="${totalSvgHeight}" fill="${bgHex}" />`,
    `  <!-- Layer 1: Thermal Temperature Fills & Spatial Gradients -->`,
    `  <g id="layer-rooms">\n${roomSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 2: Architectural Fixtures -->`,
    `  <g id="layer-fixtures">\n${fixtureSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 3: Walls and Partitions -->`,
    `  <g id="layer-walls">\n${wallSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 4: Openings (Doors and Windows) -->`,
    `  <g id="layer-openings">\n${openingSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 5: Configured HVAC and Fans -->`,
    `  <g id="layer-equipment">\n${equipmentSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 6: Physical Heat Flux Vectors & Solar Indicators -->`,
    `  <g id="layer-heat-vectors">\n${heatVectorSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 7: Airflow Streamlines & Ventilation -->`,
    `  <g id="layer-airflow">\n${airflowSvgParts.join('\n')}\n  </g>`,
    `  <!-- Layer 8: Room Labels and Temperature Readouts -->`,
    `  <g id="layer-labels">\n${labelSvgParts.join('\n')}\n  </g>`,
    northArrowSvg,
    legendSvg,
    `</svg>`,
  ].join('\n');

  return {
    svg: svgDoc,
    selectedTimestamp,
    colorScale,
    renderedRoomTemperatures,
    physicalOverlays: combinedOverlayCollection,
    diagnostics: {
      warnings: [
        ...(geometry.validationWarnings?.map((w) => `[Geometry] ${w.code}: ${w.message}`) ?? []),
        ...(simulation.diagnostics?.geometryWarnings ?? []),
        ...combinedOverlayCollection.diagnostics.warnings,
      ],
      limitations: [
        ...(simulation.diagnostics?.notes ?? []),
        ...(spatialField?.diagnostics.limitations ?? []),
        ...combinedOverlayCollection.diagnostics.limitations,
      ],
      missingRoomTemperatures: missingRoomTemps,
    },
  };
}
