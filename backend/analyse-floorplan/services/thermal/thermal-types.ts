/**
 * Thermal Simulation Models and Contract Interfaces
 *
 * Defines the domain model for the prototype room-level transient heat-balance engine:
 * - Building construction assumptions (U-values, thermal capacitance, ventilation, internal gains)
 * - Room thermal parameters derived from extracted geometry
 * - Hourly heat flows breakdown (envelope, partitions, solar, ventilation, internal)
 * - Complete simulation output contract
 */

import { FloorPlanModel } from '../floorplan/geometry-extraction';
import { EnvironmentalDataProfile } from '../environmental/environmental-types';

export interface ConstructionAssumptions {
  /** Exterior wall U-value in W/(m²·K). Default: 0.6 (insulated brick/block cavity) */
  exteriorWallUValue: number;
  /** Interior partition U-value in W/(m²·K). Default: 1.8 (standard single masonry or studded plasterboard) */
  interiorPartitionUValue: number;
  /** Window U-value in W/(m²·K). Default: 2.8 (double glazing) */
  windowUValue: number;
  /** Window Solar Heat Gain Coefficient (0 to 1). Default: 0.65 */
  windowSHGC: number;
  /** Roof U-value in W/(m²·K) for top-floor/single-story exposed rooms. Default: 0.4 */
  roofUValue: number;
  /** Ground floor / slab U-value in W/(m²·K). Default: 0.5 */
  groundSlabUValue: number;
  /** Standard room ceiling height in meters. Default: 2.7 m */
  ceilingHeightM: number;
  /** Effective specific thermal capacitance in J/(m² floor area · K). Default: 120,000 J/(m²·K) */
  effectiveThermalCapacitancePerM2: number;
  /** Infiltration / background natural ventilation in air changes per hour (ACH). Default: 0.5 ACH */
  airChangesPerHour: number;
  /** Air density in kg/m³. Default: 1.20 kg/m³ */
  airDensityKgM3: number;
  /** Air specific heat capacity in J/(kg·K). Default: 1005 J/(kg·K) */
  airSpecificHeatJPkgK: number;
  /** Default initial room temperature in °C if not explicitly specified. Default: 24.0 °C */
  defaultInitialTempC: number;
  /** Internal gains per room type in W/m² floor area */
  internalGainsByRoomTypeWPerM2: Record<string, number>;
  /** Optional HVAC setpoints per room: if enabled, clamps room temperature and records HVAC power */
  hvacConfig?: {
    enabled: boolean;
    coolingSetpointC?: number;
    heatingSetpointC?: number;
    maxCoolingCapacityWPerM2?: number;
    maxHeatingCapacityWPerM2?: number;
  };
}

export const DEFAULT_CONSTRUCTION_ASSUMPTIONS: ConstructionAssumptions = {
  exteriorWallUValue: 0.6, // Reference: ASHRAE 90.1 / ISO 13789 standard residential insulation
  interiorPartitionUValue: 1.8, // Reference: Standard uninsulated 100mm masonry/drywall partition
  windowUValue: 2.8, // Reference: Standard clear double glazing
  windowSHGC: 0.65, // Reference: Clear double glazed window
  roofUValue: 0.4, // Reference: Moderately insulated flat/sloped roof
  groundSlabUValue: 0.5, // Reference: Slab-on-grade with perimeter insulation
  ceilingHeightM: 2.7, // Reference: Standard residential ceiling height (2.7m / ~9ft)
  effectiveThermalCapacitancePerM2: 120000, // J/(m²·K): ISO 13790 "medium" thermal mass (furniture, internal air, finishing)
  airChangesPerHour: 0.5, // ACH: Standard residential baseline infiltration without mechanical ventilation
  airDensityKgM3: 1.2, // At 20°C sea level
  airSpecificHeatJPkgK: 1005, // Standard atmospheric air
  defaultInitialTempC: 24.0, // Plausible room starting temperature
  internalGainsByRoomTypeWPerM2: {
    kitchen: 15.0, // Cooking equipment, appliances, occupants
    living: 6.0, // Entertainment, lighting, occupants
    'family-room': 6.0,
    dining: 5.0,
    bedroom: 3.5, // Low night-time occupancy & lighting
    'master-bedroom': 3.5,
    study: 8.0, // Computers, task lighting
    bathroom: 2.0,
    washroom: 2.0,
    toilet: 1.0,
    corridor: 1.0,
    lobby: 1.5,
    foyer: 1.5,
    hallway: 1.0,
    closet: 0.5,
    storage: 0.5,
    garage: 0.5,
    default: 4.0,
  },
};

export interface RoomThermalGeometry {
  roomId: string;
  roomLabel: string;
  roomType: string;
  floorAreaM2: number;
  volumeM3: number;
  thermalCapacitanceJK: number; // C = area * effectiveThermalCapacitancePerM2
  /** Total net exterior opaque wall area in m² */
  exteriorWallAreaM2: number;
  /** Total window area facing outdoors in m² */
  exteriorWindowAreaM2: number;
  /** Weighted facade orientations for windows (cardinal or degrees from North) */
  windowOrientations: { orientationDeg: number; areaM2: number }[];
  /** Partition connections to neighboring rooms: adjacentRoomId -> shared wall area in m² */
  partitionAreasToAdjacentRooms: Record<string, number>;
  /** Exposed roof area in m² (if single-story/top-floor) */
  roofAreaM2: number;
  /** Base internal gains in Watts */
  baseInternalGainsW: number;
}

export interface RoomHeatFlowBreakdown {
  /** Net heat conduction through exterior walls in Watts (positive = heat entering room) */
  exteriorWallConductionW: number;
  /** Net heat conduction through exterior windows in Watts */
  windowConductionW: number;
  /** Net heat conduction through roof in Watts */
  roofConductionW: number;
  /** Net heat exchange with adjacent interior rooms in Watts */
  internalPartitionTransferW: number;
  /** Solar heat gain through glazing in Watts */
  solarGainW: number;
  /** Ventilation and infiltration heat exchange in Watts */
  ventilationLossOrGainW: number;
  /** Occupant and equipment internal heat gains in Watts */
  internalGainsW: number;
  /** Heating or cooling delivered by HVAC if active in Watts (negative = cooling) */
  hvacHeatW: number;
  /** Total net rate of heat accumulation: dQ/dt in Watts */
  netHeatFlowW: number;
}

export interface RoomHourlyThermalState {
  roomId: string;
  roomLabel: string;
  timestamp: string;
  temperatureC: number;
  outdoorTempC: number;
  temperatureDeltaC: number; // T_room - T_outdoor
  heatFlows: RoomHeatFlowBreakdown;
}

export interface ThermalSimulationOutput {
  simulationId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  modelMetadata: {
    modelName: string;
    version: string;
    numericalMethod: string; // e.g. "Explicit Euler with Adaptive Sub-Stepping (dt = 60s)"
    subTimestepSeconds: number;
    description: string;
  };
  simulationPeriod: {
    startTimestamp: string;
    endTimestamp: string;
    totalHours: number;
  };
  environmentalProvenance: {
    locationName: string | null;
    latitude: number;
    longitude: number;
    elevationM: number | null;
    timezone: string | null;
    provider: string;
  };
  buildingAssumptions: ConstructionAssumptions;
  roomGeometries: Record<string, RoomThermalGeometry>;
  initialRoomTemperatures: Record<string, number>;
  /** Hourly thermal states: key = timestamp -> list of room states */
  hourlyRoomStates: Record<string, RoomHourlyThermalState[]>;
  /** Summary statistics per room over the full simulation window */
  roomSummaries: Record<
    string,
    {
      roomId: string;
      label: string;
      minTemperatureC: number;
      maxTemperatureC: number;
      meanTemperatureC: number;
      peakSolarGainW: number;
      totalHeatGainedKWh: number;
    }
  >;
  diagnostics: {
    geometryWarnings: string[];
    environmentalWarnings: string[];
    missingInputs: string[];
    approximationsUsed: string[];
    confidence: 'high' | 'medium' | 'low';
    confidenceRationale: string;
    notes: string[];
  };
  createdAt: string;
}

export interface ThermalSimulationInput {
  geometry: FloorPlanModel;
  environment: EnvironmentalDataProfile;
  customAssumptions?: Partial<ConstructionAssumptions>;
  initialTemperatures?: Record<string, number>; // roomId -> starting temp °C
}
