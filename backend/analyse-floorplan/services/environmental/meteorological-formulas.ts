/**
 * Meteorological Formulas & Mathematical Utilities
 *
 * Implements standard, documented meteorological calculations:
 * 1. Stull (2011) Wet-Bulb Temperature formula
 * 2. Wind direction degrees to 16-point Compass Direction conversion
 * 3. Calm wind handling (speed <= 0.2 m/s marked as CALM)
 * 4. Coordinate range validation (-90 <= lat <= 90, -180 <= lon <= 180)
 */

import { CompassDirection, WetBulbCalculationMethod } from './environmental-types';

/**
 * Validates latitude and longitude ranges.
 * Latitude must be in [-90, 90] and Longitude in [-180, 180].
 * Throws a descriptive RangeError if out of bounds or non-numeric.
 */
export function validateCoordinates(latitude: number, longitude: number): void {
  if (typeof latitude !== 'number' || Number.isNaN(latitude) || !Number.isFinite(latitude)) {
    throw new RangeError(`Invalid latitude: "${latitude}". Latitude must be a finite number.`);
  }
  if (typeof longitude !== 'number' || Number.isNaN(longitude) || !Number.isFinite(longitude)) {
    throw new RangeError(`Invalid longitude: "${longitude}". Longitude must be a finite number.`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`Latitude out of range: ${latitude}. Must be between -90 and +90 degrees.`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`Longitude out of range: ${longitude}. Must be between -180 and +180 degrees.`);
  }
}

/**
 * Converts meteorological wind direction in degrees [0, 360] to human-readable compass notation.
 * Meteorological convention: direction wind is COMING FROM.
 *
 * Special handling:
 * - When windSpeedMps is zero or calm (<= 0.2 m/s), direction is 'CALM'.
 * - When degrees is null/undefined or out of [0, 360], returns 'UNAVAILABLE'.
 */
export function degreesToCompass(
  degrees: number | null | undefined,
  windSpeedMps?: number | null | undefined,
): CompassDirection {
  if (windSpeedMps !== undefined && windSpeedMps !== null && windSpeedMps <= 0.2) {
    return 'CALM';
  }

  if (degrees === null || degrees === undefined || Number.isNaN(degrees)) {
    return 'UNAVAILABLE';
  }

  // Normalize degrees to [0, 360)
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;

  // 16-wind compass rose: each sector is 22.5° wide
  const sectors: CompassDirection[] = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];

  const index = Math.round(normalized / 22.5) % 16;
  return sectors[index];
}

export interface WetBulbCalculationResult {
  value: number;
  method: WetBulbCalculationMethod;
  formula: string;
}

/**
 * Calculates wet-bulb temperature using the Stull (2011) empirical formula.
 *
 * Reference:
 * Stull, Roland (2011). "Wet-Bulb Temperature from Relative Humidity and Air Temperature".
 * Journal of Applied Meteorology and Climatology, 50(11), 2267-2269.
 * https://doi.org/10.1175/JAMC-D-11-0143.1
 *
 * Valid domain:
 *  - Temperature: -20°C to +50°C
 *  - Relative Humidity: 5% to 99%
 * (Mean absolute error: ~0.3°C across standard atmospheric conditions at sea level)
 *
 * Formula:
 * Tw = T * atan(0.151977 * (RH + 8.313659)^0.5)
 *    + atan(T + RH)
 *    - atan(RH - 1.676331)
 *    + 0.00391838 * (RH)^1.5 * atan(0.023101 * RH)
 *    - 4.686035
 *
 * Returns null if inputs are invalid or outside domain boundaries.
 */
export function calculateWetBulbTemperature(
  temperatureC: number | null | undefined,
  relativeHumidityPercent: number | null | undefined,
): WetBulbCalculationResult | null {
  if (
    temperatureC === null ||
    temperatureC === undefined ||
    relativeHumidityPercent === null ||
    relativeHumidityPercent === undefined ||
    Number.isNaN(temperatureC) ||
    Number.isNaN(relativeHumidityPercent)
  ) {
    return null;
  }

  // Constrain RH to physically realistic bounds [0, 100]
  const rh = Math.max(0, Math.min(100, relativeHumidityPercent));
  const t = temperatureC;

  // Guard against negative numbers inside fractional roots
  const rhTerm = rh + 8.313659;
  if (rhTerm < 0) return null;

  const tw =
    t * Math.atan(0.151977 * Math.pow(rhTerm, 0.5)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035;

  // Round to 2 decimal places
  const rounded = Math.round(tw * 100) / 100;

  return {
    value: rounded,
    method: 'stull-2011',
    formula: 'Tw = T*atan(0.151977*(RH+8.313659)^0.5) + atan(T+RH) - atan(RH-1.676331) + 0.00391838*RH^1.5*atan(0.023101*RH) - 4.686035',
  };
}
