#!/usr/bin/env ts-node
/**
 * CLI Runner for Environmental Data Collection
 *
 * Usage:
 *   cd backend/analyse-floorplan
 *   npx ts-node run-environmental.ts [latitude] [longitude] [locationName] [output.json]
 *
 * Examples:
 *   npx ts-node run-environmental.ts 28.6139 77.2090 "New Delhi" env-delhi.json
 *   npx ts-node run-environmental.ts 19.0760 72.8777 "Mumbai" env-mumbai.json
 *   npx ts-node run-environmental.ts 37.7749 -122.4194 "San Francisco" env-sf.json
 *
 * Defaults:
 *   latitude  → 28.6139 (Delhi)
 *   longitude → 77.2090
 *   name      → "Site Location"
 *   output    → ./environmental-profile.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { collectEnvironmentalData } from './services/environmental';

async function main(): Promise<void> {
  const latArg = process.argv[2] ?? '28.6139';
  const lonArg = process.argv[3] ?? '77.2090';
  const nameArg = process.argv[4] ?? 'Site Location';
  const outputArg = process.argv[5] ?? 'environmental-profile.json';

  const latitude = parseFloat(latArg);
  const longitude = parseFloat(lonArg);
  const outputPath = path.resolve(outputArg);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    console.error('Error: Latitude and Longitude must be valid numbers.');
    console.error('Usage: npx ts-node run-environmental.ts <latitude> <longitude> [name] [output.json]');
    process.exit(1);
  }

  console.log('──────────────────────────────────────────────');
  console.log('Building Environmental Data Collection');
  console.log('──────────────────────────────────────────────');
  console.log(`  Coordinates : ${latitude}, ${longitude}`);
  console.log(`  Name        : ${nameArg}`);
  console.log(`  Output File : ${outputPath}`);
  console.log(`  Providers   : Primary: Open-Meteo | Secondary: NASA POWER`);
  console.log('──────────────────────────────────────────────\n');

  console.log('Fetching environmental & solar profile… (takes 1–3s)\n');
  const startMs = Date.now();

  const profile = await collectEnvironmentalData(
    { latitude, longitude, name: nameArg },
    { retainRawResponses: false },
  );

  const elapsedMs = Date.now() - startMs;
  fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2), 'utf-8');

  console.log(`✓ Data collection complete in ${(elapsedMs / 1000).toFixed(2)} s`);
  console.log(`✓ Written to: ${outputPath}\n`);

  console.log('================ SUMMARY ================');
  console.log(`Resolved Elevation : ${profile.location.elevationM} m`);
  console.log(`Resolved Timezone  : ${profile.location.timezone}`);
  console.log();
  console.log('CURRENT CONDITIONS:');
  console.log(`  Timestamp        : ${profile.currentConditions.timestamp}`);
  console.log(`  Air Temperature  : ${profile.currentConditions.temperatureC} °C`);
  console.log(`  Relative Humidity: ${profile.currentConditions.relativeHumidityPercent} %`);
  console.log(`  Wet-Bulb Temp    : ${profile.currentConditions.wetBulbTemperatureC} °C (${profile.currentConditions.wetBulbMethod})`);
  console.log(`  Wind Speed       : ${profile.currentConditions.windSpeedMps} m/s`);
  console.log(`  Wind Direction   : ${profile.currentConditions.windDirectionDegrees}° (${profile.currentConditions.windDirectionCompass})`);
  console.log(`  Surface Pressure : ${profile.currentConditions.surfacePressureHpa} hPa`);
  console.log();
  console.log('HOURLY TIME SERIES:');
  console.log(`  Coverage Count   : ${profile.hourlyConditions.length} hours`);
  if (profile.hourlyConditions.length > 0) {
    console.log(`  Period           : ${profile.hourlyConditions[0].timestamp} → ${profile.hourlyConditions[profile.hourlyConditions.length - 1].timestamp}`);
    const nextHour = profile.hourlyConditions[0];
    console.log(`  Next Hour Solar  : ${nextHour.shortwaveRadiationWm2} W/m² (Global), ${nextHour.directRadiationWm2} W/m² (Direct), ${nextHour.diffuseRadiationWm2} W/m² (Diffuse)`);
  }
  console.log();
  console.log('SOLAR & DAYLIGHT:');
  console.log(`  Sunrise          : ${profile.solarData.sunrise}`);
  console.log(`  Sunset           : ${profile.solarData.sunset}`);
  console.log(`  Daylight Duration: ${((profile.solarData.daylightDurationSeconds ?? 0) / 3600).toFixed(2)} hours`);
  console.log();
  console.log('NASA POWER 25-YEAR REGIONAL CLIMATOLOGY:');
  console.log(`  Available        : ${profile.historicalClimate.available}`);
  console.log(`  Annual Avg Temp  : ${profile.historicalClimate.variables.temperature2m?.annualAverage} °C`);
  console.log(`  Annual Avg Solar : ${profile.historicalClimate.variables.allSkyShortwaveSolarRadiation?.annualAverage} W/m²`);
  console.log();
  console.log('SIMULATION READINESS:');
  console.log(`  Ready for Thermal Engine : ${profile.simulationReadiness.ready ? 'YES (✓)' : 'NO (✗)'}`);
  console.log(`  Available Inputs         : ${profile.simulationReadiness.availableInputs.length} parameters`);
  console.log('=========================================');
}

main().catch((err) => {
  console.error('\nEnvironmental collection failed:', err.message ?? err);
  process.exit(1);
});
