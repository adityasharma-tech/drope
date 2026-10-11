#!/usr/bin/env ts-node
/**
 * CLI Runner for Environmental Collection, Thermal Simulation, and SVG Visualization
 *
 * Runs the end-to-end pipeline:
 * 1. Collects live environmental data (Open-Meteo & NASA POWER)
 * 2. Runs the transient thermal simulation across all building rooms
 * 3. Generates the standalone thermal floor-plan SVG visualization
 *
 * Usage:
 *   cd backend/analyse-floorplan
 *   npx ts-node run-environmental.ts [latitude] [longitude] [locationName] [geometryJsonPath]
 *
 * Examples:
 *   npx ts-node run-environmental.ts
 *   npx ts-node run-environmental.ts 28.6139 77.2090 "New Delhi" samples/sample-geometry-result.json
 *   npx ts-node run-environmental.ts 19.0760 72.8777 "Mumbai"
 */

import * as fs from 'fs';
import * as path from 'path';
import { collectEnvironmentalData } from './services/environmental';
import { runThermalSimulation } from './services/thermal';
import { renderThermalFloorPlanSvg } from './services/renderer';
import { FloorPlanModel } from './services/floorplan/geometry-extraction';

async function main(): Promise<void> {
  const latArg = process.argv[2] ?? '28.6139';
  const lonArg = process.argv[3] ?? '77.2090';
  const nameArg = process.argv[4] ?? 'Site Location';
  const geomPathArg = process.argv[5] ?? path.join(__dirname, 'samples', 'sample-geometry-result.json');

  const latitude = parseFloat(latArg);
  const longitude = parseFloat(lonArg);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    console.error('Error: Latitude and Longitude must be valid numbers.');
    console.error('Usage: npx ts-node run-environmental.ts <latitude> <longitude> [name] [geometryJsonPath]');
    process.exit(1);
  }

  const geometryPath = path.resolve(geomPathArg);
  const outputEnvJsonPath = path.resolve('environmental-profile.json');
  const outputThermalJsonPath = path.resolve('thermal-simulation-result.json');
  const outputSvgPath = path.resolve('thermal-floorplan.svg');

  console.log('────────────────────────────────────────────────────────');
  console.log('End-to-End Thermal Pipeline (Weather → Simulation → SVG)');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Coordinates   : ${latitude}, ${longitude}`);
  console.log(`  Location Name : ${nameArg}`);
  console.log(`  Geometry File : ${geometryPath}`);
  console.log('────────────────────────────────────────────────────────\n');

  // 1. Environmental Data Collection
  console.log('Step 1/3: Collecting live environmental data (Open-Meteo + NASA POWER)…');
  const startEnvMs = Date.now();
  const environment = await collectEnvironmentalData(
    { latitude, longitude, name: nameArg },
    { retainRawResponses: false },
  );
  const envElapsed = ((Date.now() - startEnvMs) / 1000).toFixed(2);
  fs.writeFileSync(outputEnvJsonPath, JSON.stringify(environment, null, 2), 'utf-8');
  console.log(`✓ Weather collected in ${envElapsed}s → ${outputEnvJsonPath}\n`);

  // 2. Thermal Simulation
  if (!fs.existsSync(geometryPath)) {
    console.warn(`Geometry file not found at ${geometryPath}. Skipping simulation & SVG steps.`);
    return;
  }

  console.log('Step 2/3: Running transient physics thermal simulation across rooms…');
  const geomRaw = fs.readFileSync(geometryPath, 'utf-8');
  const geometry = JSON.parse(geomRaw) as FloorPlanModel;

  const startSimMs = Date.now();
  const simulation = runThermalSimulation({ geometry, environment });
  const simElapsed = ((Date.now() - startSimMs) / 1000).toFixed(2);
  fs.writeFileSync(outputThermalJsonPath, JSON.stringify(simulation, null, 2), 'utf-8');
  console.log(`✓ 24-hour simulation completed in ${simElapsed}s → ${outputThermalJsonPath}\n`);

  // 3. SVG Thermal Rendering with Spatial Gradients & Physics Overlays
  console.log('Step 3/3: Rendering vector thermal floor-plan SVG with spatial gradients…');
  const startSvgMs = Date.now();

  // Pick the peak thermal gradient frame (highest temperature spread or peak outdoor heat)
  const timestamps = Object.keys(simulation.hourlyRoomStates);
  let peakTimestamp = timestamps[0];
  let maxSpread = -1;
  for (const ts of timestamps) {
    const states = simulation.hourlyRoomStates[ts];
    const temps = states.map((s) => s.temperatureC);
    const spread = Math.max(...temps) - Math.min(...temps);
    if (spread > maxSpread) {
      maxSpread = spread;
      peakTimestamp = ts;
    }
  }

  const renderResult = renderThermalFloorPlanSvg({
    geometry,
    simulation,
    options: {
      timestamp: peakTimestamp,
      enableSpatialGradients: true,
      showHeatFluxVectors: true,
      showFixtures: true,
    },
  });
  fs.writeFileSync(outputSvgPath, renderResult.svg, 'utf-8');
  const svgElapsed = ((Date.now() - startSvgMs) / 1000).toFixed(2);
  console.log(`✓ Vector SVG rendered in ${svgElapsed}s → ${outputSvgPath}\n`);

  // 4. Automated AI / Physics Quality Review
  const { reviewThermalVisualization } = require('./services/renderer/quality-reviewer');
  const review = reviewThermalVisualization({
    svg: renderResult.svg,
    geometry,
    simulation,
    renderedRoomTemperatures: renderResult.renderedRoomTemperatures,
    options: { timestamp: peakTimestamp },
  });

  const outputOverlaysJsonPath = path.resolve('thermal-overlays.json');
  if (renderResult.physicalOverlays) {
    fs.writeFileSync(outputOverlaysJsonPath, JSON.stringify(renderResult.physicalOverlays, null, 2), 'utf-8');
  }

  // 5. Detailed Summary Report
  console.log('========================================================');
  console.log('                    PIPELINE SUMMARY                    ');
  console.log('========================================================');
  console.log(`Location           : ${environment.location.name} (${environment.location.latitude}, ${environment.location.longitude})`);
  console.log(`Elevation / Timezone: ${environment.location.elevationM}m / ${environment.location.timezone}`);
  console.log();
  console.log('OUTDOOR CURRENT WEATHER:');
  console.log(`  Timestamp        : ${environment.currentConditions.timestamp}`);
  console.log(`  Air Temperature  : ${environment.currentConditions.temperatureC} °C`);
  console.log(`  Relative Humidity: ${environment.currentConditions.relativeHumidityPercent} %`);
  console.log(`  Wet-Bulb Temp    : ${environment.currentConditions.wetBulbTemperatureC} °C (${environment.currentConditions.wetBulbMethod})`);
  console.log(`  Wind             : ${environment.currentConditions.windSpeedMps} m/s from ${environment.currentConditions.windDirectionDegrees}° (${environment.currentConditions.windDirectionCompass})`);
  console.log(`  Surface Pressure : ${environment.currentConditions.surfacePressureHpa} hPa`);
  console.log();
  console.log('SIMULATION & SVG RENDER FRAME:');
  console.log(`  Rendered Frame   : ${renderResult.selectedTimestamp} (Peak Temperature Spread: ${maxSpread.toFixed(1)}°C)`);
  console.log(`  Color Range      : ${renderResult.colorScale.minTempC.toFixed(1)}°C (Cool) → ${renderResult.colorScale.maxTempC.toFixed(1)}°C (Warm)`);
  console.log(`  Spatial Gradients: ENABLED (clipped to room boundaries)`);
  console.log(`  Heat Flux Vectors: ENABLED (wall-normal conduction & solar flux in Watts)`);
  if (renderResult.physicalOverlays) {
    console.log(`  Total Overlays   : ${renderResult.physicalOverlays.diagnostics.totalOverlays} (by type: ${JSON.stringify(renderResult.physicalOverlays.diagnostics.overlaysByType)})`);
  }
  console.log();
  console.log('AI QUALITY REVIEW RESULT:');
  console.log(`  Status           : [${review.status}] (Score: ${review.score}/100)`);
  console.log(`  Summary          : ${review.summary}`);
  if (review.issues.length > 0) {
    console.log(`  Issues / Notes   :`);
    for (const issue of review.issues) {
      console.log(`    - [${issue.severity.toUpperCase()}] (${issue.code}) ${issue.message}`);
    }
  }
  console.log();
  console.log('ROOM TEMPERATURES IN GENERATED SVG:');
  for (const [rId, temp] of Object.entries(renderResult.renderedRoomTemperatures)) {
    const label = geometry.rooms.find((r) => r.id === rId)?.label ?? rId;
    const tempStr = temp !== null ? `${temp.toFixed(1)} °C` : 'NO DATA';
    console.log(`  ${rId.padEnd(5)} | ${label.padEnd(20)} : ${tempStr}`);
  }
  console.log();
  console.log('GENERATED ARTIFACTS:');
  console.log(`  1. Weather JSON    : ${outputEnvJsonPath}`);
  console.log(`  2. Simulation JSON : ${outputThermalJsonPath}`);
  console.log(`  3. Overlays JSON   : ${outputOverlaysJsonPath}`);
  console.log(`  4. Thermal SVG     : ${outputSvgPath} (${(fs.statSync(outputSvgPath).size / 1024).toFixed(1)} KB)`);
  console.log('========================================================');
  console.log('\nYou can open "thermal-floorplan.svg" in your browser or any SVG viewer to view the rendered floor plan.');
}

main().catch((err) => {
  console.error('\nPipeline execution failed:', err.message ?? err);
  process.exit(1);
});
