/**
 * Open-Meteo Environmental Data Provider
 *
 * Implements data collection from Open-Meteo's official weather forecast API:
 * https://api.open-meteo.com/v1/forecast
 *
 * Collects:
 *  - Location metadata (resolved latitude, longitude, elevation, timezone)
 *  - Current conditions (temperature, humidity, pressure, wind speed, wind direction)
 *  - Hourly time-series (at least 24-48 hours of forecast conditions)
 *  - Solar radiation (shortwave, direct, diffuse irradiance in W/m²)
 *  - Solar and daylight timings (sunrise, sunset, daylight duration in seconds)
 *
 * Distinguishes current observations from forecast intervals and preserves raw units.
 */

import * as https from 'https';
import { URL } from 'url';
import {
  CurrentConditions,
  DataSourceProvenance,
  HourlyConditionRecord,
  LocationInput,
  NormalizedLocation,
  SolarData,
} from './environmental-types';
import {
  calculateWetBulbTemperature,
  degreesToCompass,
  validateCoordinates,
} from './meteorological-formulas';

export interface OpenMeteoRawResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  current_units?: Record<string, string>;
  current?: {
    time: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hourly_units?: Record<string, string>;
  hourly?: {
    time: string[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    surface_pressure?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    shortwave_radiation_instant?: (number | null)[];
    direct_radiation_instant?: (number | null)[];
    diffuse_radiation_instant?: (number | null)[];
  };
  daily_units?: Record<string, string>;
  daily?: {
    time: string[];
    sunrise?: string[];
    sunset?: string[];
    daylight_duration?: number[];
  };
  error?: boolean;
  reason?: string;
}

export interface OpenMeteoExtractionResult {
  location: NormalizedLocation;
  currentConditions: CurrentConditions;
  hourlyConditions: HourlyConditionRecord[];
  solarData: SolarData;
  provenance: DataSourceProvenance;
  rawResponse: OpenMeteoRawResponse;
}

function httpsGet(urlStr: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const req = https.get(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'BuildingThermalAnalysis/1.0 (EnvironmentalCollector; Open-Meteo Client)',
          Accept: 'application/json',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            return reject(
              new Error(`Open-Meteo API HTTP ${res.statusCode} ${res.statusMessage}: ${body.slice(0, 300)}`),
            );
          }
          resolve(body);
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Open-Meteo request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Normalizes Open-Meteo raw JSON response into structured domain entities.
 */
export function normalizeOpenMeteoResponse(
  raw: OpenMeteoRawResponse,
  input: LocationInput,
  retrievalTimestamp: string,
): OpenMeteoExtractionResult {
  if (raw.error || raw.reason) {
    throw new Error(`Open-Meteo returned error: ${raw.reason ?? 'Unknown reason'}`);
  }

  // 1. Normalized Location
  const location: NormalizedLocation = {
    latitude: raw.latitude,
    longitude: raw.longitude,
    elevationM: raw.elevation ?? null,
    timezone: raw.timezone ?? null,
    name: input.name ?? null,
  };

  // 2. Current Conditions
  const curr = raw.current;
  let currentConditions: CurrentConditions;

  if (curr && curr.time) {
    const temp = curr.temperature_2m ?? null;
    const rh = curr.relative_humidity_2m ?? null;
    const ws = curr.wind_speed_10m ?? null;
    const wd = curr.wind_direction_10m ?? null;
    const sp = curr.surface_pressure ?? null;

    const wbResult = calculateWetBulbTemperature(temp, rh);

    currentConditions = {
      timestamp: curr.time,
      dataType: 'forecast', // Open-Meteo current endpoint is short-range blended model forecast/analysis
      temperatureC: temp,
      relativeHumidityPercent: rh,
      wetBulbTemperatureC: wbResult ? wbResult.value : null,
      wetBulbMethod: wbResult ? wbResult.method : null,
      windDirectionDegrees: wd,
      windDirectionCompass: degreesToCompass(wd, ws),
      windSpeedMps: ws,
      surfacePressureHpa: sp,
    };
  } else {
    currentConditions = {
      timestamp: null,
      dataType: null,
      temperatureC: null,
      relativeHumidityPercent: null,
      wetBulbTemperatureC: null,
      wetBulbMethod: null,
      windDirectionDegrees: null,
      windDirectionCompass: null,
      windSpeedMps: null,
      surfacePressureHpa: null,
    };
  }

  // 3. Hourly Time Series
  const hourly = raw.hourly;
  const hourlyConditions: HourlyConditionRecord[] = [];

  if (hourly && Array.isArray(hourly.time)) {
    const times = hourly.time;
    const temps = hourly.temperature_2m ?? [];
    const rhs = hourly.relative_humidity_2m ?? [];
    const pressures = hourly.surface_pressure ?? [];
    const windSpeeds = hourly.wind_speed_10m ?? [];
    const windDirs = hourly.wind_direction_10m ?? [];
    const shortwave = hourly.shortwave_radiation_instant ?? [];
    const direct = hourly.direct_radiation_instant ?? [];
    const diffuse = hourly.diffuse_radiation_instant ?? [];

    // Start from the current hour or first forecast hour, taking exactly 24 hours
    let startIndex = 0;
    if (curr?.time) {
      const currentHourPrefix = curr.time.slice(0, 13); // 'YYYY-MM-DDTHH'
      const foundIdx = times.findIndex((t) => t.startsWith(currentHourPrefix));
      if (foundIdx >= 0) {
        startIndex = foundIdx;
      }
    }

    const endIndex = Math.min(startIndex + 24, times.length);

    for (let i = startIndex; i < endIndex; i++) {
      const timestamp = times[i];
      const t = temps[i] ?? null;
      const rh = rhs[i] ?? null;
      const ws = windSpeeds[i] ?? null;
      const wd = windDirs[i] ?? null;
      const sp = pressures[i] ?? null;
      const sw = shortwave[i] ?? null;
      const dir = direct[i] ?? null;
      const diff = diffuse[i] ?? null;

      const wb = calculateWetBulbTemperature(t, rh);

      hourlyConditions.push({
        timestamp,
        dataType: 'forecast',
        temperatureC: t,
        relativeHumidityPercent: rh,
        wetBulbTemperatureC: wb ? wb.value : null,
        wetBulbMethod: wb ? wb.method : null,
        windDirectionDegrees: wd,
        windDirectionCompass: degreesToCompass(wd, ws),
        windSpeedMps: ws,
        surfacePressureHpa: sp,
        shortwaveRadiationWm2: sw,
        directRadiationWm2: dir,
        diffuseRadiationWm2: diff,
      });
    }
  }

  // 4. Solar and Daylight Data
  const daily = raw.daily;
  const solarData: SolarData = {
    sunrise: daily?.sunrise?.[0] ?? null,
    sunset: daily?.sunset?.[0] ?? null,
    daylightDurationSeconds: daily?.daylight_duration?.[0] ?? null,
  };

  // 5. Provenance
  const provenance: DataSourceProvenance = {
    provider: 'Open-Meteo',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    retrievalTimestamp,
    coveragePeriod: hourlyConditions.length > 0
      ? `${hourlyConditions[0].timestamp} to ${hourlyConditions[hourlyConditions.length - 1].timestamp}`
      : 'none',
    units: {
      temperature_2m: '°C',
      relative_humidity_2m: '%',
      surface_pressure: 'hPa',
      wind_speed_10m: 'm/s',
      wind_direction_10m: 'degrees (meteorological)',
      solar_radiation: 'W/m²',
      daylight_duration: 'seconds',
    },
    attribution: 'Weather data by Open-Meteo.com under CC BY 4.0 license',
    requestedCoordinates: { latitude: input.latitude, longitude: input.longitude },
    resolvedCoordinates: {
      latitude: raw.latitude,
      longitude: raw.longitude,
      elevationM: raw.elevation,
    },
  };

  return {
    location,
    currentConditions,
    hourlyConditions,
    solarData,
    provenance,
    rawResponse: raw,
  };
}

/**
 * Fetches real-world environmental data from Open-Meteo for a given coordinate.
 */
export async function fetchOpenMeteoData(
  input: LocationInput,
  customFetch?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>,
): Promise<OpenMeteoExtractionResult> {
  validateCoordinates(input.latitude, input.longitude);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(input.latitude)}` +
    `&longitude=${encodeURIComponent(input.longitude)}` +
    `&wind_speed_unit=ms` +
    `&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant` +
    `&daily=sunrise,sunset,daylight_duration` +
    `&timezone=auto` +
    `&forecast_days=2`;

  const retrievalTimestamp = new Date().toISOString();
  let rawJson: string;

  if (customFetch) {
    const res = await customFetch(url);
    if (res.status < 200 || res.status >= 300) {
      const errText = await res.text();
      throw new Error(`Open-Meteo HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    rawJson = await res.text();
  } else {
    rawJson = await httpsGet(url);
  }

  let raw: OpenMeteoRawResponse;
  try {
    raw = JSON.parse(rawJson) as OpenMeteoRawResponse;
  } catch (err) {
    throw new Error(`Failed to parse Open-Meteo JSON response: ${(err as Error).message}`);
  }

  return normalizeOpenMeteoResponse(raw, input, retrievalTimestamp);
}
