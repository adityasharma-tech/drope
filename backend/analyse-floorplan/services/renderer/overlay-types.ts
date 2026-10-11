/**
 * Physical Overlay Data Contract
 *
 * Defines typed overlays for every distinct physical phenomenon rendered in the
 * SVG thermal floor-plan visualization.
 *
 * Each overlay carries:
 * - A stable overlay ID
 * - The physical quantity and its units
 * - Source and destination room/wall/window IDs where applicable
 * - Coordinates in the same pixel space as the floor-plan geometry
 * - Direction vector (normalised, in pixel space) where meaningful
 * - Magnitude in physical units
 * - Simulation timestamp (ISO 8601)
 * - Model / calculation method
 * - Data quality flags: whether the result is simulated, measured, estimated or interpolated
 * - Warnings and confidence metadata
 */

import { Point } from '../floorplan/geometry-extraction';

export type OverlayDataQuality = 'simulated' | 'measured' | 'estimated' | 'interpolated' | 'configured';
export type OverlaySeverity = 'normal' | 'warning' | 'uncertain';

export interface OverlayBase {
  /** Stable unique ID for this overlay element */
  overlayId: string;
  /** ISO 8601 simulation timestamp this overlay belongs to */
  timestamp: string;
  /** Physical quantity label (e.g. "Conductive Heat Flux") */
  quantityLabel: string;
  /** Physical unit string (e.g. "W", "W/m²", "m³/s", "°C") */
  unit: string;
  /** Scalar magnitude of the physical quantity in the stated unit */
  magnitude: number;
  /** Model or calculation method that produced this value */
  method: string;
  /** Data quality flag */
  dataQuality: OverlayDataQuality;
  /** Anchor position in floor-plan pixel space */
  position: Point;
  /** Warnings or limitations for this specific overlay */
  warnings: string[];
  /** Severity rating */
  severity: OverlaySeverity;
}

/** Direction vector in normalised pixel space (unit vector) */
export interface DirectionVector {
  /** dx component in pixel space (right = +1, left = -1) */
  dx: number;
  /** dy component in pixel space (down = +1, up = -1) */
  dy: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Conductive Heat Transfer through Walls, Windows, Roofs
// ─────────────────────────────────────────────────────────────────────────────

export interface ConductiveHeatOverlay extends OverlayBase {
  overlayType: 'CONDUCTIVE_HEAT';
  /** Room that is gaining or losing heat */
  roomId: string;
  /** Wall, window, or roof element carrying this heat flux */
  elementId: string;
  /** Type of building element */
  elementType: 'exterior-wall' | 'window' | 'roof' | 'ground-slab' | 'interior-partition';
  /** Adjacent room ID if this is a partition transfer (null for envelope) */
  adjacentRoomId: string | null;
  /** True if heat flows INTO the room, false if leaving */
  isEnteringRoom: boolean;
  /** Normalised wall-perpendicular direction vector in pixel space */
  direction: DirectionVector;
  /** U-value used in W/(m²·K) */
  uValueWm2K: number;
  /** Effective area used in m² */
  areaM2: number;
  /** Temperature difference driving this flux (T_hot - T_cold) in °C/K */
  deltaTemperatureK: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Solar Radiation and Glazing Heat Gain
// ─────────────────────────────────────────────────────────────────────────────

export interface SolarRadiationOverlay extends OverlayBase {
  overlayType: 'SOLAR_RADIATION';
  /** Room receiving solar heat gain */
  roomId: string;
  /** Opening ID (window) through which solar radiation passes */
  openingId: string;
  /** Global horizontal irradiance at this hour in W/m² */
  globalHorizontalIrradianceWm2: number;
  /** Effective vertical irradiance on window facade in W/m² */
  verticalIrradianceWm2: number;
  /** Solar heat gain coefficient applied */
  shgc: number;
  /** Glazing area in m² */
  glazingAreaM2: number;
  /** Transmitted solar heat gain in W (= verticalIrradiance * area * SHGC) */
  transmittedGainW: number;
  /** Approximate sun direction vector in pixel space */
  sunDirection: DirectionVector;
  /** Whether orientation data was available for incidence angle calculation */
  orientationKnown: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Convective Heat Transfer (indoor air convection)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConvectiveHeatOverlay extends OverlayBase {
  overlayType: 'CONVECTIVE_HEAT';
  roomId: string;
  /** Heat convected between surface and air in W (positive = air gains heat) */
  convectedHeatW: number;
  /** Convection source (wall surface, floor, ceiling) */
  sourceType: 'wall-surface' | 'floor-surface' | 'ceiling-surface' | 'equipment-surface';
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ventilation and Infiltration
// ─────────────────────────────────────────────────────────────────────────────

export interface VentilationOverlay extends OverlayBase {
  overlayType: 'VENTILATION';
  roomId: string;
  /** Opening ID through which ventilation occurs (null for distributed infiltration) */
  openingId: string | null;
  /** Direction of net airflow: inflow vs outflow */
  airflowDirection: 'inflow' | 'outflow' | 'bidirectional';
  /** Estimated volumetric flow rate in m³/s (null if not calculated) */
  volumetricFlowM3s: number | null;
  /** Estimated mass flow rate in kg/s (null if not calculated) */
  massFlowKgs: number | null;
  /** Heat exchange rate in W (+ve = heat entering room from outdoor air) */
  heatExchangeW: number;
  /** Whether this is background infiltration (distributed) or active ventilation through an opening */
  isInfiltration: boolean;
  /** Opening state if driven by a configured opening */
  openingState: OpeningState | null;
  /** Path start point in pixel space */
  pathStart: Point;
  /** Path end point in pixel space */
  pathEnd: Point;
}

export type OpeningState = 'open' | 'closed' | 'partial' | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// 5. HVAC Supply and Return Airflow
// ─────────────────────────────────────────────────────────────────────────────

export interface HvacAirflowOverlay extends OverlayBase {
  overlayType: 'HVAC_AIRFLOW';
  equipmentId: string;
  roomId: string;
  /** Supply outlet position in pixel space */
  supplyPosition: Point;
  /** Return inlet position in pixel space (null if not modeled) */
  returnPosition: Point | null;
  /** Supply air temperature in °C */
  supplyAirTemperatureC: number | null;
  /** Airflow rate in m³/s */
  airflowM3s: number | null;
  /** Net cooling (negative W) or heating (positive W) delivered */
  hvacHeatW: number;
  /** Operating state */
  isActive: boolean;
  /** Cooling setpoint configured in °C */
  coolingSetpointC: number | null;
  /** Heating setpoint configured in °C */
  heatingSetpointC: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Fan-Driven Air Circulation
// ─────────────────────────────────────────────────────────────────────────────

export interface FanCirculationOverlay extends OverlayBase {
  overlayType: 'FAN_CIRCULATION';
  equipmentId: string;
  roomId: string;
  fanType: 'ceiling-fan' | 'pedestal-fan' | 'exhaust-fan' | 'supply-fan' | 'unknown';
  operatingMode: 'clockwise' | 'counter-clockwise' | 'forward' | 'reverse' | 'unknown';
  /** Configured airflow rate in m³/s (null if not measured) */
  airflowM3s: number | null;
  /** Note: ceiling fan circulation is NOT outdoor air exchange */
  isFreshAirExchange: false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Exhaust Airflow
// ─────────────────────────────────────────────────────────────────────────────

export interface ExhaustAirflowOverlay extends OverlayBase {
  overlayType: 'EXHAUST_AIRFLOW';
  equipmentId: string;
  roomId: string;
  /** Exit path start point */
  pathStart: Point;
  /** Exit path end point (outdoor or shaft) */
  pathEnd: Point;
  /** Exhaust flow rate in m³/s */
  exhaustFlowM3s: number | null;
  /** Whether this path crosses a valid opening without solid wall penetration */
  pathIsValid: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Spatial Temperature Field Overlay (room-level approximation reference)
// ─────────────────────────────────────────────────────────────────────────────

export interface SpatialTemperatureOverlay extends OverlayBase {
  overlayType: 'SPATIAL_TEMPERATURE';
  roomId: string;
  /** Simulated room-mean temperature in °C from the lumped model */
  meanTemperatureC: number;
  /** Spatial range (from field generator, not CFD) */
  spatialMinC: number;
  spatialMaxC: number;
  /** Field generation method label */
  fieldMethod: string;
  /** Explicit disclaimer: this is NOT a CFD prediction */
  isCfdPrediction: false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Union type for all overlay variants
// ─────────────────────────────────────────────────────────────────────────────

export type PhysicalOverlay =
  | ConductiveHeatOverlay
  | SolarRadiationOverlay
  | ConvectiveHeatOverlay
  | VentilationOverlay
  | HvacAirflowOverlay
  | FanCirculationOverlay
  | ExhaustAirflowOverlay
  | SpatialTemperatureOverlay;

// ─────────────────────────────────────────────────────────────────────────────
// Equipment Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HvacUnitConfig {
  /** Unique equipment ID */
  equipmentId: string;
  /** Room this unit serves */
  roomId: string;
  /** Equipment type (splits, central, VRF, etc.) */
  equipmentType: 'split-ac' | 'central-ac' | 'vrf' | 'window-ac' | 'heat-pump' | 'ptac' | 'unknown';
  /** Supply outlet location in pixel space */
  supplyOutletPosition?: Point;
  /** Return inlet location in pixel space */
  returnInletPosition?: Point;
  /** Operating state */
  isOperating: boolean;
  /** Supply air temperature in °C when operating */
  supplyAirTemperatureC?: number;
  /** Designed airflow in m³/s */
  designAirflowM3s?: number;
  /** Cooling capacity in W (positive value) */
  coolingCapacityW?: number;
  /** Heating capacity in W */
  heatingCapacityW?: number;
  /** Cooling setpoint in °C */
  coolingSetpointC?: number;
  /** Heating setpoint in °C */
  heatingSetpointC?: number;
}

export interface FanConfig {
  equipmentId: string;
  roomId: string;
  fanType: 'ceiling-fan' | 'pedestal-fan' | 'exhaust-fan' | 'supply-fan' | 'unknown';
  /** Fan position in pixel space */
  position: Point;
  isOperating: boolean;
  operatingMode?: 'clockwise' | 'counter-clockwise' | 'forward' | 'reverse' | 'unknown';
  /** Configured airflow in m³/s */
  airflowM3s?: number;
}

export interface OpeningConfig {
  openingId: string;
  state: OpeningState;
  /** Fraction open (0.0 = fully closed, 1.0 = fully open). Used only when state = 'partial'. */
  openFraction?: number;
}

export interface VentilationBuildingConfig {
  /** Per-opening states. Unspecified openings are treated as 'unknown'. */
  openingStates?: Record<string, OpeningConfig>;
  /** HVAC units in the building */
  hvacUnits?: HvacUnitConfig[];
  /** Fans in the building */
  fans?: FanConfig[];
  /** Global override for ACH if known from measurement */
  measuredAirChangesPerHour?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay Collection
// ─────────────────────────────────────────────────────────────────────────────

export interface PhysicalOverlayCollection {
  timestamp: string;
  overlays: PhysicalOverlay[];
  diagnostics: {
    totalOverlays: number;
    overlaysByType: Record<string, number>;
    warnings: string[];
    limitations: string[];
  };
}
