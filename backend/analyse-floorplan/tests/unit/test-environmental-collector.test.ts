/**
 * Unit Tests for Environmental Data Collection Service
 *
 * Verifies:
 * - Coordinate boundary validation
 * - Stull (2011) wet-bulb temperature formula precision
 * - 16-point wind direction and calm conditions
 * - Open-Meteo response normalization
 * - NASA POWER climatology normalization
 * - Data quality auditing and simulation readiness checks
 * - Error and failure handling
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  validateCoordinates,
  degreesToCompass,
  calculateWetBulbTemperature,
} from '../../services/environmental/meteorological-formulas';
import {
  normalizeOpenMeteoResponse,
  OpenMeteoRawResponse,
} from '../../services/environmental/open-meteo-provider';
import {
  normalizeNasaPowerResponse,
  NasaPowerRawResponse,
} from '../../services/environmental/nasa-power-provider';
import { collectEnvironmentalData } from '../../services/environmental/environmental-service';

describe('Meteorological Formulas & Validation', () => {
  test('validates coordinates within standard ranges', () => {
    assert.doesNotThrow(() => validateCoordinates(0, 0));
    assert.doesNotThrow(() => validateCoordinates(28.6139, 77.2090));
    assert.doesNotThrow(() => validateCoordinates(-90, 180));
    assert.doesNotThrow(() => validateCoordinates(90, -180));

    assert.throws(() => validateCoordinates(91, 0), RangeError);
    assert.throws(() => validateCoordinates(-90.1, 0), RangeError);
    assert.throws(() => validateCoordinates(0, 180.5), RangeError);
    assert.throws(() => validateCoordinates(0, -181), RangeError);
    assert.throws(() => validateCoordinates(NaN, 0), RangeError);
    assert.throws(() => validateCoordinates(0, Infinity), RangeError);
  });

  test('converts wind degrees to 16-point compass accurately', () => {
    assert.strictEqual(degreesToCompass(0, 5), 'N');
    assert.strictEqual(degreesToCompass(360, 5), 'N');
    assert.strictEqual(degreesToCompass(90, 5), 'E');
    assert.strictEqual(degreesToCompass(180, 5), 'S');
    assert.strictEqual(degreesToCompass(270, 5), 'W');
    assert.strictEqual(degreesToCompass(45, 5), 'NE');
    assert.strictEqual(degreesToCompass(225, 5), 'SW');
    assert.strictEqual(degreesToCompass(315, 5), 'NW');
  });

  test('marks calm wind (speed <= 0.2 m/s) as CALM', () => {
    assert.strictEqual(degreesToCompass(90, 0.0), 'CALM');
    assert.strictEqual(degreesToCompass(180, 0.1), 'CALM');
    assert.strictEqual(degreesToCompass(270, 0.2), 'CALM');
    assert.strictEqual(degreesToCompass(270, 0.3), 'W');
  });

  test('handles null or invalid wind degrees as UNAVAILABLE', () => {
    assert.strictEqual(degreesToCompass(null, 5), 'UNAVAILABLE');
    assert.strictEqual(degreesToCompass(undefined, 5), 'UNAVAILABLE');
    assert.strictEqual(degreesToCompass(NaN, 5), 'UNAVAILABLE');
  });

  test('calculates Stull (2011) wet-bulb temperature with meteorological accuracy', () => {
    // Known benchmark: at T = 20°C and RH = 50%, Stull (2011) yields ~13.7°C
    const res1 = calculateWetBulbTemperature(20, 50);
    assert.ok(res1 !== null);
    assert.strictEqual(res1.method, 'stull-2011');
    assert.ok(Math.abs(res1.value - 13.7) < 0.2, `Expected ~13.7°C, got ${res1.value}`);

    // High humidity: at RH = 100%, wet-bulb equals air temperature
    const res100 = calculateWetBulbTemperature(30, 100);
    assert.ok(res100 !== null);
    assert.ok(Math.abs(res100.value - 30.0) < 0.5, `At 100% RH, Tw should be ~30°C, got ${res100.value}`);

    // Missing inputs return null
    assert.strictEqual(calculateWetBulbTemperature(null, 50), null);
    assert.strictEqual(calculateWetBulbTemperature(25, null), null);
  });
});

describe('Open-Meteo Normalization', () => {
  const sampleOpenMeteoPayload: OpenMeteoRawResponse = {
    latitude: 28.58,
    longitude: 77.19,
    elevation: 214,
    utc_offset_seconds: 19800,
    timezone: 'Asia/Kolkata',
    timezone_abbreviation: 'GMT+5:30',
    current_units: {
      temperature_2m: '°C',
      relative_humidity_2m: '%',
      surface_pressure: 'hPa',
      wind_speed_10m: 'm/s',
      wind_direction_10m: '°',
    },
    current: {
      time: '2026-10-11T16:30',
      temperature_2m: 30.4,
      relative_humidity_2m: 52,
      surface_pressure: 985.2,
      wind_speed_10m: 2.1,
      wind_direction_10m: 110,
    },
    hourly_units: {
      time: 'iso8601',
      temperature_2m: '°C',
      relative_humidity_2m: '%',
      surface_pressure: 'hPa',
      wind_speed_10m: 'm/s',
      wind_direction_10m: '°',
      shortwave_radiation_instant: 'W/m²',
    },
    hourly: {
      time: ['2026-10-11T00:00', '2026-10-11T01:00', '2026-10-11T02:00'],
      temperature_2m: [24.1, 23.5, 23.0],
      relative_humidity_2m: [65, 68, 70],
      surface_pressure: [986.0, 985.8, 985.5],
      wind_speed_10m: [1.5, 1.2, 0.0],
      wind_direction_10m: [95, 90, 0],
      shortwave_radiation_instant: [0, 0, 0],
      direct_radiation_instant: [0, 0, 0],
      diffuse_radiation_instant: [0, 0, 0],
    },
    daily_units: {
      sunrise: 'iso8601',
      sunset: 'iso8601',
      daylight_duration: 's',
    },
    daily: {
      time: ['2026-10-11'],
      sunrise: ['2026-10-11T06:19'],
      sunset: ['2026-10-11T17:55'],
      daylight_duration: [41760],
    },
  };

  test('normalizes raw Open-Meteo response into domain structure', () => {
    const norm = normalizeOpenMeteoResponse(
      sampleOpenMeteoPayload,
      { latitude: 28.6139, longitude: 77.2090, name: 'Delhi Building' },
      '2026-10-11T16:35:00Z',
    );

    assert.strictEqual(norm.location.name, 'Delhi Building');
    assert.strictEqual(norm.location.elevationM, 214);
    assert.strictEqual(norm.location.timezone, 'Asia/Kolkata');

    // Current conditions
    assert.strictEqual(norm.currentConditions.temperatureC, 30.4);
    assert.strictEqual(norm.currentConditions.relativeHumidityPercent, 52);
    assert.strictEqual(norm.currentConditions.windSpeedMps, 2.1);
    assert.strictEqual(norm.currentConditions.windDirectionDegrees, 110);
    assert.strictEqual(norm.currentConditions.windDirectionCompass, 'ESE');
    assert.ok(norm.currentConditions.wetBulbTemperatureC !== null);
    assert.strictEqual(norm.currentConditions.wetBulbMethod, 'stull-2011');

    // Hourly
    assert.strictEqual(norm.hourlyConditions.length, 3);
    assert.strictEqual(norm.hourlyConditions[2].windSpeedMps, 0.0);
    assert.strictEqual(norm.hourlyConditions[2].windDirectionCompass, 'CALM');

    // Solar
    assert.strictEqual(norm.solarData.sunrise, '2026-10-11T06:19');
    assert.strictEqual(norm.solarData.sunset, '2026-10-11T17:55');
    assert.strictEqual(norm.solarData.daylightDurationSeconds, 41760);

    // Provenance
    assert.strictEqual(norm.provenance.provider, 'Open-Meteo');
  });

  test('throws when Open-Meteo reports error', () => {
    assert.throws(
      () =>
        normalizeOpenMeteoResponse(
          { latitude: 0, longitude: 0, elevation: 0, utc_offset_seconds: 0, timezone: '', timezone_abbreviation: '', error: true, reason: 'Latitude invalid' },
          { latitude: 95, longitude: 0 },
          'now',
        ),
      /Open-Meteo returned error: Latitude invalid/,
    );
  });
});

describe('NASA POWER Climatology Normalization', () => {
  const sampleNasaPowerPayload: NasaPowerRawResponse = {
    geometry: {
      type: 'Point',
      coordinates: [77.209, 28.614, 206.37],
    },
    header: {
      title: 'NASA/POWER Climatology',
      range: '25-year Climatology (2001-2025)',
    },
    properties: {
      parameter: {
        T2M: { JAN: 14.2, FEB: 17.5, MAR: 23.4, ANN: 25.1 },
        RH2M: { JAN: 55.0, FEB: 48.0, MAR: 40.0, ANN: 52.0 },
        ALLSKY_SFC_SW_DWN: { JAN: 128.7, FEB: 181.1, ANN: 203.7 },
        WS10M: { JAN: 2.1, FEB: 2.4, ANN: 2.6 },
        PS: { JAN: 99.25, FEB: 99.04, ANN: 98.39 }, // in kPa
      },
    },
  };

  test('normalizes NASA POWER response and converts pressure kPa to hPa', () => {
    const norm = normalizeNasaPowerResponse(
      sampleNasaPowerPayload,
      { latitude: 28.6139, longitude: 77.2090 },
      '2026-10-11T16:35:00Z',
    );

    assert.strictEqual(norm.historicalClimate.available, true);
    assert.strictEqual(norm.historicalClimate.provider, 'NASA POWER');
    assert.strictEqual(norm.historicalClimate.variables.temperature2m.annualAverage, 25.1);

    // Pressure converted from kPa to hPa: 98.39 * 10 = 983.9 hPa
    assert.strictEqual(norm.historicalClimate.variables.surfacePressure.annualAverage, 983.9);
    assert.strictEqual(norm.historicalClimate.variables.surfacePressure.unit, 'hPa');
  });
});

describe('End-to-End Environmental Service (Mocked Fetch)', () => {
  test('collects environmental profile with quality and readiness reports', async () => {
    const mockFetch = async (url: string) => {
      if (url.includes('open-meteo.com')) {
        // Generate 48 hours of hourly records to provide next 24 hours from current midday
        const hours = Array.from({ length: 48 }, (_, i) => {
          const day = i < 24 ? '11' : '12';
          const hour = String(i % 24).padStart(2, '0');
          return `2026-10-${day}T${hour}:00`;
        });
        const temps = hours.map((_, i) => 20 + (i % 24) * 0.5);
        const rhs = hours.map(() => 50);

        return {
          status: 200,
          text: async () =>
            JSON.stringify({
              latitude: 28.61,
              longitude: 77.21,
              elevation: 215,
              utc_offset_seconds: 19800,
              timezone: 'Asia/Kolkata',
              timezone_abbreviation: 'GMT+5:30',
              current: {
                time: '2026-10-11T12:00',
                temperature_2m: 28.5,
                relative_humidity_2m: 55,
                surface_pressure: 985.0,
                wind_speed_10m: 3.0,
                wind_direction_10m: 135,
              },
              hourly: {
                time: hours,
                temperature_2m: temps,
                relative_humidity_2m: rhs,
                surface_pressure: hours.map(() => 985),
                wind_speed_10m: hours.map(() => 2.5),
                wind_direction_10m: hours.map(() => 120),
                shortwave_radiation_instant: hours.map(() => 450),
                direct_radiation_instant: hours.map(() => 300),
                diffuse_radiation_instant: hours.map(() => 150),
              },
              daily: {
                time: ['2026-10-11'],
                sunrise: ['2026-10-11T06:19'],
                sunset: ['2026-10-11T17:55'],
                daylight_duration: [41760],
              },
            }),
        };
      } else if (url.includes('power.larc.nasa.gov')) {
        return {
          status: 200,
          text: async () =>
            JSON.stringify({
              geometry: { type: 'Point', coordinates: [77.21, 28.61, 215] },
              header: { title: 'NASA POWER Climatology' },
              properties: {
                parameter: {
                  T2M: { ANN: 24.5 },
                  RH2M: { ANN: 55.0 },
                  ALLSKY_SFC_SW_DWN: { ANN: 200.0 },
                  WS10M: { ANN: 2.5 },
                  PS: { ANN: 98.5 },
                },
              },
            }),
        };
      }
      throw new Error(`Unhandled mock url: ${url}`);
    };

    const profile = await collectEnvironmentalData(
      { latitude: 28.6139, longitude: 77.2090, name: 'Delhi Building Site' },
      { customFetch: mockFetch, retainRawResponses: true },
    );

    assert.strictEqual(profile.location.name, 'Delhi Building Site');
    assert.strictEqual(profile.location.timezone, 'Asia/Kolkata');
    assert.strictEqual(profile.hourlyConditions.length, 24);
    assert.strictEqual(profile.sources.length, 2);
    assert.strictEqual(profile.simulationReadiness.ready, true);
    assert.ok(profile.rawResponses?.openMeteo !== undefined);
  });
});
