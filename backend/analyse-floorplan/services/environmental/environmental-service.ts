/**
 * Environmental Data Collection Service
 *
 * Primary coordinator that:
 * 1. Validates input location coordinates.
 * 2. Fetches weather, atmospheric conditions, and solar profile from primary provider (Open-Meteo).
 * 3. Fetches regional climatology context from secondary provider (NASA POWER) if enabled.
 * 4. Derives physically consistent variables (Stull wet-bulb temperature, 16-point wind direction).
 * 5. Compiles data quality audits (coverage, missing fields, limitations).
 * 6. Generates simulation readiness assessments for downstream building thermal engines.
 */

import {
  DataQualityReport,
  EnvironmentalCollectionOptions,
  EnvironmentalDataProfile,
  HistoricalClimateData,
  LocationInput,
  SimulationReadinessReport,
} from './environmental-types';
import { validateCoordinates } from './meteorological-formulas';
import { fetchNasaPowerClimatology } from './nasa-power-provider';
import { fetchOpenMeteoData } from './open-meteo-provider';

/**
 * Evaluates completeness and quality of the collected dataset.
 */
function evaluateDataQuality(profile: Partial<EnvironmentalDataProfile>): DataQualityReport {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const limitations: string[] = [
    'Regional numerical weather prediction models provide gridded estimates; microclimate near building facades or urban street canyons may vary.',
    'Wind speed and direction are measured/modeled at 10m open-terrain elevation; local building roughness and surrounding obstructions modify surface wind exposure.',
  ];

  const curr = profile.currentConditions;
  if (!curr || curr.temperatureC === null) missingFields.push('currentConditions.temperatureC');
  if (!curr || curr.relativeHumidityPercent === null) missingFields.push('currentConditions.relativeHumidityPercent');
  if (!curr || curr.wetBulbTemperatureC === null) missingFields.push('currentConditions.wetBulbTemperatureC');
  if (!curr || curr.windSpeedMps === null) missingFields.push('currentConditions.windSpeedMps');
  if (!curr || curr.windDirectionDegrees === null) missingFields.push('currentConditions.windDirectionDegrees');
  if (!curr || curr.surfacePressureHpa === null) missingFields.push('currentConditions.surfacePressureHpa');

  const hourly = profile.hourlyConditions ?? [];
  if (hourly.length === 0) {
    warnings.push('No hourly forecast records were returned by the weather provider.');
  } else if (hourly.length < 24) {
    warnings.push(`Incomplete hourly coverage: received ${hourly.length} hours (expected at least 24).`);
  }

  const solar = profile.solarData;
  if (!solar || !solar.sunrise || !solar.sunset) {
    warnings.push('Sunrise/sunset daily solar timings are incomplete.');
  }

  return {
    missingFields,
    warnings,
    coverage: {
      hourlyCount: hourly.length,
      startTime: hourly.length > 0 ? hourly[0].timestamp : null,
      endTime: hourly.length > 0 ? hourly[hourly.length - 1].timestamp : null,
      hasCurrentConditions: Boolean(curr && curr.timestamp),
      hasSolarData: Boolean(solar && solar.sunrise && solar.sunset),
    },
    limitations,
  };
}

/**
 * Assesses whether the collected dataset fulfills the physical boundary requirements
 * for building thermal simulation engines.
 */
function evaluateSimulationReadiness(
  profile: Partial<EnvironmentalDataProfile>,
  quality: DataQualityReport,
): SimulationReadinessReport {
  const availableInputs: string[] = [];
  const missingInputs: string[] = [];
  const notes: string[] = [];

  const curr = profile.currentConditions;
  const hourly = profile.hourlyConditions ?? [];

  // Check required outdoor thermal boundary variables across hourly profile
  const hasHourlyTemp = hourly.length >= 24 && hourly.some((h) => h.temperatureC !== null);
  const hasHourlyRh = hourly.length >= 24 && hourly.some((h) => h.relativeHumidityPercent !== null);
  const hasHourlySolar = hourly.length >= 24 && hourly.some((h) => h.shortwaveRadiationWm2 !== null);
  const hasHourlyWind = hourly.length >= 24 && hourly.some((h) => h.windSpeedMps !== null);
  const hasHourlyPressure = hourly.length >= 24 && hourly.some((h) => h.surfacePressureHpa !== null);

  if (curr?.temperatureC !== null) availableInputs.push('outdoor_air_temperature_current');
  if (hasHourlyTemp) availableInputs.push('outdoor_air_temperature_hourly_24h');
  else missingInputs.push('outdoor_air_temperature_hourly_24h');

  if (curr?.relativeHumidityPercent !== null) availableInputs.push('relative_humidity_current');
  if (hasHourlyRh) availableInputs.push('relative_humidity_hourly_24h');
  else missingInputs.push('relative_humidity_hourly_24h');

  if (curr?.wetBulbTemperatureC !== null) availableInputs.push('wet_bulb_temperature_current');
  if (hourly.some((h) => h.wetBulbTemperatureC !== null)) availableInputs.push('wet_bulb_temperature_hourly');

  if (hasHourlySolar) availableInputs.push('solar_shortwave_irradiance_hourly');
  else missingInputs.push('solar_shortwave_irradiance_hourly');

  if (hasHourlyWind) availableInputs.push('wind_speed_and_direction_hourly');
  else missingInputs.push('wind_speed_and_direction_hourly');

  if (hasHourlyPressure) availableInputs.push('surface_pressure_hourly');
  else missingInputs.push('surface_pressure_hourly');

  if (profile.historicalClimate?.available) {
    availableInputs.push('regional_climatology_monthly');
    notes.push('NASA POWER 25-year monthly climatology available for seasonal context.');
  }

  const isReady = missingInputs.length === 0 && quality.warnings.length === 0;

  if (isReady) {
    notes.push('Essential outdoor environmental boundary conditions are available for 24h+ simulation.');
  } else {
    notes.push(`Simulation readiness pending resolution of missing inputs: ${missingInputs.join(', ')}`);
  }

  return {
    ready: isReady,
    availableInputs,
    missingInputs,
    notes,
  };
}

/**
 * Collects and normalizes environmental data for a given building location.
 *
 * @param input Latitude and Longitude of the target building
 * @param options Configuration options (climatology, raw data retention, mocking fetch)
 * @returns Fully validated and normalized EnvironmentalDataProfile
 */
export async function collectEnvironmentalData(
  input: LocationInput,
  options: EnvironmentalCollectionOptions = {},
): Promise<EnvironmentalDataProfile> {
  // 1. Validate coordinates
  validateCoordinates(input.latitude, input.longitude);

  const includeHistorical = options.includeHistoricalClimate ?? true;
  const retainRaw = options.retainRawResponses ?? false;

  // 2. Fetch primary provider data (Open-Meteo)
  const openMeteoResult = await fetchOpenMeteoData(input, options.customFetch);

  // 3. Fetch secondary provider data (NASA POWER) if requested
  let historicalClimate: HistoricalClimateData = {
    available: false,
    provider: null,
    dataset: null,
    period: null,
    temporalResolution: null,
    geographicResolution: null,
    variables: {},
  };

  const sources = [openMeteoResult.provenance];
  let nasaRawResponse: unknown = undefined;

  if (includeHistorical) {
    try {
      const nasaResult = await fetchNasaPowerClimatology(input, options.customFetch);
      historicalClimate = nasaResult.historicalClimate;
      sources.push(nasaResult.provenance);
      nasaRawResponse = nasaResult.rawResponse;
    } catch (nasaErr) {
      // Climatology failure does not block current/hourly weather collection
      console.warn(
        `[environmental-collection] Secondary provider NASA POWER failed: ${(nasaErr as Error).message}. Continuing with primary data.`,
      );
    }
  }

  // 4. Assemble intermediate profile
  const partialProfile: Partial<EnvironmentalDataProfile> = {
    location: openMeteoResult.location,
    currentConditions: openMeteoResult.currentConditions,
    hourlyConditions: openMeteoResult.hourlyConditions,
    solarData: openMeteoResult.solarData,
    historicalClimate,
    sources,
  };

  // 5. Audit data quality and simulation readiness
  const dataQuality = evaluateDataQuality(partialProfile);
  const simulationReadiness = evaluateSimulationReadiness(partialProfile, dataQuality);

  const profile: EnvironmentalDataProfile = {
    location: openMeteoResult.location,
    currentConditions: openMeteoResult.currentConditions,
    hourlyConditions: openMeteoResult.hourlyConditions,
    solarData: openMeteoResult.solarData,
    historicalClimate,
    sources,
    dataQuality,
    simulationReadiness,
    ...(retainRaw
      ? {
          rawResponses: {
            openMeteo: openMeteoResult.rawResponse,
            nasaPower: nasaRawResponse,
          },
        }
      : {}),
  };

  return profile;
}
