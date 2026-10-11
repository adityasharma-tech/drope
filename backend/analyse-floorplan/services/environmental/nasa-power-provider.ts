/**
 * NASA POWER Climatological Data Provider
 *
 * Implements environmental climatology data collection using NASA's Prediction
 * of Worldwide Energy Resources (POWER) API:
 * https://power.larc.nasa.gov/api/temporal/climatology/point
 *
 * Parameters retrieved:
 *  - T2M: Temperature at 2 Metres (°C)
 *  - RH2M: Relative Humidity at 2 Metres (%)
 *  - ALLSKY_SFC_SW_DWN: All Sky Surface Shortwave Downward Irradiance (W/m²)
 *  - WS10M: Wind Speed at 10 Metres (m/s)
 *  - PS: Surface Pressure (converted from kPa to hPa)
 *
 * Provides long-term 20+ year climatological context (monthly & annual averages)
 * for regional building thermal design.
 */

import * as https from 'https';
import { URL } from 'url';
import {
  DataSourceProvenance,
  HistoricalClimateData,
  LocationInput,
} from './environmental-types';
import { validateCoordinates } from './meteorological-formulas';

export interface NasaPowerRawResponse {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: [number, number, number]; // [lon, lat, elevation]
  };
  header?: {
    title?: string;
    api?: { version?: string; name?: string };
    sources?: string[];
    range?: string;
    fill_value?: number;
  };
  messages?: string[];
  parameters?: Record<string, { units?: string; longname?: string }>;
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      RH2M?: Record<string, number>;
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
      WS10M?: Record<string, number>;
      PS?: Record<string, number>; // in kPa
    };
  };
}

export interface NasaPowerExtractionResult {
  historicalClimate: HistoricalClimateData;
  provenance: DataSourceProvenance;
  rawResponse: NasaPowerRawResponse;
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
          'User-Agent': 'BuildingThermalAnalysis/1.0 (EnvironmentalCollector; NASA POWER Client)',
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
              new Error(`NASA POWER API HTTP ${res.statusCode} ${res.statusMessage}: ${body.slice(0, 300)}`),
            );
          }
          resolve(body);
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`NASA POWER request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
  });
}

/**
 * Normalizes NASA POWER raw response into clean HistoricalClimateData.
 */
export function normalizeNasaPowerResponse(
  raw: NasaPowerRawResponse,
  input: LocationInput,
  retrievalTimestamp: string,
): NasaPowerExtractionResult {
  const params = raw.properties?.parameter ?? {};
  const header = raw.header;
  const geom = raw.geometry?.coordinates; // [lon, lat, elev]

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const cleanMonthly = (
    dict: Record<string, number> | undefined,
    scale = 1.0,
  ): { annual: number | null; monthly: Record<string, number | null> } => {
    if (!dict) return { annual: null, monthly: {} };
    const monthly: Record<string, number | null> = {};
    for (const m of months) {
      const val = dict[m];
      monthly[m] = val !== undefined && val !== -999 ? Math.round(val * scale * 100) / 100 : null;
    }
    const ann = dict['ANN'];
    const annual = ann !== undefined && ann !== -999 ? Math.round(ann * scale * 100) / 100 : null;
    return { annual, monthly };
  };

  const t2m = cleanMonthly(params.T2M);
  const rh2m = cleanMonthly(params.RH2M);
  const solar = cleanMonthly(params.ALLSKY_SFC_SW_DWN);
  const ws10m = cleanMonthly(params.WS10M);
  // PS in raw NASA POWER is in kPa; convert to hPa (1 kPa = 10 hPa)
  const psHpa = cleanMonthly(params.PS, 10.0);

  const variables: HistoricalClimateData['variables'] = {
    temperature2m: {
      description: 'Monthly and annual 25-year climatological average air temperature at 2m',
      unit: '°C',
      annualAverage: t2m.annual,
      monthlyValues: t2m.monthly,
    },
    relativeHumidity2m: {
      description: 'Monthly and annual 25-year climatological average relative humidity at 2m',
      unit: '%',
      annualAverage: rh2m.annual,
      monthlyValues: rh2m.monthly,
    },
    allSkyShortwaveSolarRadiation: {
      description: 'Monthly and annual all-sky shortwave solar irradiance on a horizontal surface',
      unit: 'W/m²',
      annualAverage: solar.annual,
      monthlyValues: solar.monthly,
    },
    windSpeed10m: {
      description: 'Monthly and annual average wind speed at 10m',
      unit: 'm/s',
      annualAverage: ws10m.annual,
      monthlyValues: ws10m.monthly,
    },
    surfacePressure: {
      description: 'Monthly and annual average surface atmospheric pressure',
      unit: 'hPa',
      annualAverage: psHpa.annual,
      monthlyValues: psHpa.monthly,
    },
  };

  const historicalClimate: HistoricalClimateData = {
    available: true,
    provider: 'NASA POWER',
    dataset: header?.title ?? 'NASA/POWER Climatology',
    period: header?.range ?? '25-year Climatology (2001-2025)',
    temporalResolution: 'monthly-climatology',
    geographicResolution: '0.5 x 0.625 degree MERRA-2 assimilation grid',
    variables,
  };

  const provenance: DataSourceProvenance = {
    provider: 'NASA POWER',
    endpoint: 'https://power.larc.nasa.gov/api/temporal/climatology/point',
    retrievalTimestamp,
    coveragePeriod: historicalClimate.period ?? '25-year climatology',
    units: {
      temperature: '°C',
      relative_humidity: '%',
      solar_irradiance: 'W/m²',
      wind_speed: 'm/s',
      pressure: 'hPa (converted from native kPa)',
    },
    attribution: 'NASA POWER Project (NASA Langley Research Center)',
    requestedCoordinates: { latitude: input.latitude, longitude: input.longitude },
    resolvedCoordinates: {
      latitude: geom ? geom[1] : input.latitude,
      longitude: geom ? geom[0] : input.longitude,
      elevationM: geom && geom[2] !== undefined ? geom[2] : undefined,
    },
  };

  return {
    historicalClimate,
    provenance,
    rawResponse: raw,
  };
}

/**
 * Fetches NASA POWER monthly climatology data for building site context.
 */
export async function fetchNasaPowerClimatology(
  input: LocationInput,
  customFetch?: (url: string) => Promise<{ status: number; text: () => Promise<string> }>,
): Promise<NasaPowerExtractionResult> {
  validateCoordinates(input.latitude, input.longitude);

  const url =
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=T2M,RH2M,ALLSKY_SFC_SW_DWN,WS10M,PS` +
    `&community=SB` +
    `&longitude=${encodeURIComponent(input.longitude)}` +
    `&latitude=${encodeURIComponent(input.latitude)}` +
    `&format=JSON`;

  const retrievalTimestamp = new Date().toISOString();
  let rawJson: string;

  if (customFetch) {
    const res = await customFetch(url);
    if (res.status < 200 || res.status >= 300) {
      const errText = await res.text();
      throw new Error(`NASA POWER HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    rawJson = await res.text();
  } else {
    rawJson = await httpsGet(url);
  }

  let raw: NasaPowerRawResponse;
  try {
    raw = JSON.parse(rawJson) as NasaPowerRawResponse;
  } catch (err) {
    throw new Error(`Failed to parse NASA POWER JSON response: ${(err as Error).message}`);
  }

  return normalizeNasaPowerResponse(raw, input, retrievalTimestamp);
}
