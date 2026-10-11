/**
 * SVG Thermal Floor-Plan Renderer Types & Options
 */

import { FloorPlanModel } from '../floorplan/geometry-extraction';
import { ThermalSimulationOutput } from '../thermal/thermal-types';
import { VentilationBuildingConfig, PhysicalOverlayCollection } from './overlay-types';

export interface ColorStop {
  temperatureC: number;
  hex: string;
}

export interface ColorScaleConfig {
  /** Minimum temperature on scale in °C (default: auto from global simulation min or 18°C) */
  minTempC: number;
  /** Maximum temperature on scale in °C (default: auto from global simulation max or 32°C) */
  maxTempC: number;
  /** Fill color when room temperature is missing or unknown. Default: "#e2e8f0" (neutral gray) */
  missingDataColorHex: string;
  /** Custom gradient color stops (sorted from cold to hot) */
  customStops?: ColorStop[];
}

export interface SvgRenderOptions {
  /** Simulation timestamp to render (ISO 8601 string). If omitted, renders the peak or first available timestamp */
  timestamp?: string;
  /** Color scale configuration across the building */
  colorScale?: Partial<ColorScaleConfig>;
  /** Whether to render room text labels and temperature values (default: true) */
  showLabels?: boolean;
  /** Whether to render walls and openings vectors on top of room fills (default: true) */
  showWallsAndOpenings?: boolean;
  /** Whether to render the temperature color legend and metadata bar (default: true) */
  showLegend?: boolean;
  /** Whether to render the True North indicator if orientation is known (default: true) */
  showNorthArrow?: boolean;
  /** Whether to render continuous spatial temperature gradients (default: true). Set false for flat room fills. */
  enableSpatialGradients?: boolean;
  /** Whether to render physical heat-flux arrows through walls and windows based on calculated Watts (default: true) */
  showHeatFluxVectors?: boolean;
  /** Whether to render architectural fixtures (beds, sinks, tables) if present (default: true) */
  showFixtures?: boolean;
  /** Whether to render physical overlay collection (conductive, solar, ventilation) if provided (default: true) */
  showPhysicalOverlays?: boolean;
  /** Whether to show opening state indicators (open/closed/partial) (default: true) */
  showOpeningStates?: boolean;
  /** Background fill color for building exterior/canvas. Default: "#f8fafc" */
  backgroundColorHex?: string;
  /** Additional styling/font overrides */
  fontFamily?: string;
  /** Ventilation and equipment configuration for airflow overlay generation */
  ventilationConfig?: VentilationBuildingConfig;
}

export interface RenderedSvgResult {
  /** Complete, valid, standalone SVG document markup string */
  svg: string;
  /** Selected simulation timestamp for this frame */
  selectedTimestamp: string;
  /** Resolved global color scale applied to this frame */
  colorScale: ColorScaleConfig;
  /** Simulated temperatures per room rendered in this frame: roomId -> temp °C */
  renderedRoomTemperatures: Record<string, number | null>;
  /** Physical overlay collection calculated for this frame */
  physicalOverlays?: PhysicalOverlayCollection;
  /** Diagnostics, warnings, and limitations preserved from geometry and simulation */
  diagnostics: {
    warnings: string[];
    limitations: string[];
    missingRoomTemperatures: string[];
  };
}

export interface SvgRendererInput {
  geometry: FloorPlanModel;
  simulation: ThermalSimulationOutput;
  options?: SvgRenderOptions;
}
