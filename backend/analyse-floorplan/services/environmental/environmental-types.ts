/**
 * Environmental Data Collection Models & Types
 *
 * Provides domain models and strict normalized contracts for real-world
 * outdoor environmental data, including:
 *  - Location metadata (coordinates, elevation, timezone, reverse-geocoded name)
 *  - Current conditions (temperature, humidity, wet-bulb, wind, pressure)
 *  - Hourly time-series (at least 24 hours of atmospheric & solar irradiance data)
 *  - Solar and daylight data (sunrise, sunset, daylight duration)
 *  - Historical climatology (from NASA POWER or similar reanalysis datasets)
 *  - Data quality and simulation readiness indicators
 */

export type DataSourceType =
  | 'measured'
  | 'forecast'
  | 'reanalysis'
  | 'historical'
  | 'calculated';

export type WetBulbCalculationMethod =
  | 'provider-supplied'
  | 'stull-2011'
  | 'normand-psychrometric'
  | 'unknown';

export type CompassDirection =
  | 'N'
  | 'NNE'
  | 'NE'
  | 'ENE'
  | 'E'
  | 'ESE'
  | 'SE'
  | 'SSE'
  | 'S'
  | 'SSW'
  | 'SW'
  | 'WSW'
  | 'W'
  | 'WNW'
  | 'NW'
  | 'NNW'
  | 'CALM'
  | 'VARIABLE'
  | 'UNAVAILABLE';

export interface LocationInput {
  latitude: number;
  longitude: number;
  /** Optional user-specified name or label */
  name?: string;
}

export interface NormalizedLocation {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  timezone: string | null;
  name: string | null;
}

export interface CurrentConditions {
  timestamp: string | null;
  dataType: DataSourceType | null;
  /** Temperature at ~2m above ground in °C */
  temperatureC: number | null;
  /** Relative humidity at ~2m in % (0 - 100) */
  relativeHumidityPercent: number | null;
  /** Wet-bulb temperature at ~2m in °C */
  wetBulbTemperatureC: number | null;
  /** Method used for wet-bulb determination */
  wetBulbMethod: WetBulbCalculationMethod | null;
  /** Meteorological wind direction in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
  windDirectionDegrees: number | null;
  /** Compass direction (e.g. 'N', 'NE', 'CALM') */
  windDirectionCompass: CompassDirection | null;
  /** Wind speed at ~10m in m/s */
  windSpeedMps: number | null;
  /** Surface atmospheric pressure in hPa */
  surfacePressureHpa: number | null;
}

export interface HourlyConditionRecord {
  timestamp: string;
  dataType: DataSourceType;
  /** Temperature at ~2m in °C */
  temperatureC: number | null;
  /** Relative humidity at ~2m in % (0 - 100) */
  relativeHumidityPercent: number | null;
  /** Wet-bulb temperature at ~2m in °C */
  wetBulbTemperatureC: number | null;
  /** Wet-bulb derivation method */
  wetBulbMethod: WetBulbCalculationMethod | null;
  /** Wind direction at ~10m in degrees (0-360) */
  windDirectionDegrees: number | null;
  /** Compass direction */
  windDirectionCompass: CompassDirection | null;
  /** Wind speed at ~10m in m/s */
  windSpeedMps: number | null;
  /** Surface atmospheric pressure in hPa */
  surfacePressureHpa: number | null;
  /** Global horizontal / shortwave solar radiation in W/m² */
  shortwaveRadiationWm2: number | null;
  /** Direct solar radiation on horizontal surface in W/m² */
  directRadiationWm2: number | null;
  /** Diffuse solar radiation on horizontal surface in W/m² */
  diffuseRadiationWm2: number | null;
}

export interface SolarData {
  sunrise: string | null;
  sunset: string | null;
  daylightDurationSeconds: number | null;
}

export interface HistoricalClimateData {
  available: boolean;
  provider: string | null;
  dataset: string | null;
  period: string | null;
  temporalResolution: string | null;
  geographicResolution: string | null;
  variables: Record<string, {
    description: string;
    unit: string;
    annualAverage?: number | null;
    monthlyValues?: Record<string, number | null>;
  }>;
}

export interface DataSourceProvenance {
  provider: string;
  endpoint: string;
  retrievalTimestamp: string;
  coveragePeriod: string;
  units: Record<string, string>;
  attribution: string;
  requestedCoordinates: { latitude: number; longitude: number };
  resolvedCoordinates: { latitude: number; longitude: number; elevationM?: number };
}

export interface DataQualityReport {
  missingFields: string[];
  warnings: string[];
  coverage: {
    hourlyCount: number;
    startTime: string | null;
    endTime: string | null;
    hasCurrentConditions: boolean;
    hasSolarData: boolean;
  };
  limitations: string[];
}

export interface SimulationReadinessReport {
  ready: boolean;
  availableInputs: string[];
  missingInputs: string[];
  notes: string[];
}

/**
 * Normalized environmental data response contract.
 * Designed for direct consumption by future building thermal simulation engines.
 */
export interface EnvironmentalDataProfile {
  location: NormalizedLocation;
  currentConditions: CurrentConditions;
  hourlyConditions: HourlyConditionRecord[];
  solarData: SolarData;
  historicalClimate: HistoricalClimateData;
  sources: DataSourceProvenance[];
  dataQuality: DataQualityReport;
  simulationReadiness: SimulationReadinessReport;
  rawResponses?: {
    openMeteo?: unknown;
    nasaPower?: unknown;
  };
}

export interface EnvironmentalCollectionOptions {
  /** Include historical climatology from NASA POWER (default: true) */
  includeHistoricalClimate?: boolean;
  /** Retain raw provider response payloads for debugging (default: false) */
  retainRawResponses?: boolean;
  /** Custom fetch implementation for unit testing/mocking */
  customFetch?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>;
}
