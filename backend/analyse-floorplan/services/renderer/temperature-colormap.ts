/**
 * Scientific Temperature Colormap Utility
 *
 * Implements a perceptually progressive thermal palette:
 *   Deep Blue (Cool) -> Cyan -> Green/Yellow (Comfort) -> Orange -> Deep Red (Hot)
 *
 * Provides deterministic continuous color mapping and SVG gradient generation.
 */

import { ColorScaleConfig, ColorStop } from './renderer-types';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_THERMAL_STOPS: ColorStop[] = [
  { temperatureC: 18.0, hex: '#313695' }, // Deep Cool Blue
  { temperatureC: 21.0, hex: '#4575b4' }, // Slate Blue
  { temperatureC: 23.0, hex: '#74add1' }, // Soft Blue
  { temperatureC: 24.5, hex: '#abd9e9' }, // Cyan / Near Comfort
  { temperatureC: 25.5, hex: '#e0f3f8' }, // Neutral Cool
  { temperatureC: 26.5, hex: '#fee090' }, // Soft Yellow / Warm Comfort
  { temperatureC: 28.0, hex: '#fdae61' }, // Orange
  { temperatureC: 30.0, hex: '#f46d43' }, // Red-Orange
  { temperatureC: 32.0, hex: '#d73027' }, // Bright Red
  { temperatureC: 35.0, hex: '#a50026' }, // Deep Warm Red
];

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = ((bigint >> 8) & 0xf) * 17;
    const g = ((bigint >> 4) & 0xf) * 17;
    const b = (bigint & 0xf) * 17;
    return { r, g, b };
  }
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

export function rgbToHex(rgb: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(rgb.r).toString(16).padStart(2, '0');
  const g = clamp(rgb.g).toString(16).padStart(2, '0');
  const b = clamp(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function interpolateColor(colorA: RGB, colorB: RGB, factor: number): RGB {
  const t = Math.max(0, Math.min(1, factor));
  return {
    r: colorA.r + (colorB.r - colorA.r) * t,
    g: colorA.g + (colorB.g - colorA.g) * t,
    b: colorA.b + (colorB.b - colorA.b) * t,
  };
}

/**
 * Maps a numerical room temperature in °C to a hex color using a normalized scale.
 */
export function temperatureToColor(
  tempC: number | null | undefined,
  config: ColorScaleConfig,
): string {
  if (tempC === null || tempC === undefined || Number.isNaN(tempC)) {
    return config.missingDataColorHex;
  }

  const min = config.minTempC;
  const max = config.maxTempC;
  const stops = config.customStops ?? DEFAULT_THERMAL_STOPS;

  // Normalized temperature t in [0, 1]
  const range = max - min > 0.01 ? max - min : 1.0;
  const normalizedT = Math.max(0, Math.min(1, (tempC - min) / range));

  // Find surrounding stops normalized across [min, max]
  if (normalizedT <= 0) return stops[0].hex;
  if (normalizedT >= 1) return stops[stops.length - 1].hex;

  // Normalize stops to [0, 1]
  const normalizedStops = stops.map((s) => ({
    norm: Math.max(0, Math.min(1, (s.temperatureC - min) / range)),
    rgb: hexToRgb(s.hex),
    hex: s.hex,
  }));

  for (let i = 0; i < normalizedStops.length - 1; i++) {
    const s1 = normalizedStops[i];
    const s2 = normalizedStops[i + 1];

    if (normalizedT >= s1.norm && normalizedT <= s2.norm) {
      const segRange = s2.norm - s1.norm;
      const factor = segRange > 0.0001 ? (normalizedT - s1.norm) / segRange : 0;
      const rgb = interpolateColor(s1.rgb, s2.rgb, factor);
      return rgbToHex(rgb);
    }
  }

  return stops[stops.length - 1].hex;
}

/**
 * Builds SVG `<linearGradient>` stops for rendering the temperature legend bar.
 */
export function buildSvgGradientStops(config: ColorScaleConfig): string {
  const stops = config.customStops ?? DEFAULT_THERMAL_STOPS;
  const min = config.minTempC;
  const max = config.maxTempC;
  const range = max - min > 0.01 ? max - min : 1.0;

  return stops
    .map((s) => {
      const offsetPct = Math.round(Math.max(0, Math.min(100, ((s.temperatureC - min) / range) * 100)));
      return `    <stop offset="${offsetPct}%" stop-color="${s.hex}" />`;
    })
    .join('\n');
}
