/**
 * Floor-Plan Geometry Extraction Service
 *
 * Converts an architectural floor-plan image into a structured, machine-readable
 * digital building model using the Bedrock Mantle OpenAI-compatible Chat Completions API.
 *
 * Output is a FloorPlanModel suitable for:
 *  - SVG/Canvas rendering (each object has pixel-space geometry)
 *  - Programmatic adjacency/connectivity traversal
 *  - Thermal simulation as a geometric input foundation
 *
 * Data sources are tagged on every object:
 *   "annotated"  – explicitly stated in the drawing (labels, dimension text)
 *   "detected"   – identified visually by the model (symbols, lines, arcs)
 *   "inferred"   – logically derived from surrounding context
 *   "unknown"    – could not be reliably determined
 *
 * Image coordinates: origin top-left, x→right, y→down (raw pixel space).
 * Real-world dimensions: preserved from drawing annotations where present;
 * otherwise marked "uncalibrated" until the user supplies a confirmed scale.
 */

import * as https from 'https';
import { URL } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────────────────────────────────────

export type DataSource = 'annotated' | 'detected' | 'inferred' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';

/** A 2-D point in image pixel space (origin: top-left). */
export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned bounding box in image pixel space. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An ordered polygon in image pixel space. */
export interface Polygon {
  points: Point[];
}

/** A wall segment between two endpoints. */
export interface Wall {
  id: string;
  startPoint: Point;
  endPoint: Point;
  thicknessPixels?: number;
  thicknessReal?: Dimension;
  lengthReal?: Dimension;
  orientation?: 'horizontal' | 'vertical' | 'diagonal';
  boundingRoomIds: string[];
  isExterior: boolean;
  isExteriorSource: DataSource;
  isLoadBearing?: boolean;
  isLoadBearingSource: DataSource;
  confidence: Confidence;
}

export interface Dimension {
  value: number;
  unit: 'mm' | 'cm' | 'm' | 'ft' | 'in' | 'unknown';
  source: DataSource;
  rawAnnotation?: string; /** e.g. "9'-0\"" */
}

export interface Opening {
  id: string;
  type: OpeningType;
  wallId?: string;
  positionOnWall: Point;
  widthReal?: Dimension;
  heightReal?: Dimension;
  widthPixels?: number;
  hingePoint?: Point;
  swingEndPoint?: Point;
  swingDirection?: 'clockwise' | 'counter-clockwise' | 'unknown';
  connectsSpaceIds: string[];
  isExterior: boolean;
  confidence: Confidence;
  source: DataSource;
}

export type OpeningType =
  | 'door-hinged'
  | 'door-sliding'
  | 'door-double'
  | 'door-folding'
  | 'door-unknown'
  | 'window-sliding'
  | 'window-casement'
  | 'window-fixed'
  | 'window-bay'
  | 'window-unknown'
  | 'ventilator'
  | 'pass-through'
  | 'open-connection'
  | 'unknown';

export type RoomType =
  | 'bedroom'
  | 'master-bedroom'
  | 'bathroom'
  | 'toilet'
  | 'washroom'
  | 'kitchen'
  | 'dining'
  | 'living'
  | 'family-room'
  | 'corridor'
  | 'lobby'
  | 'foyer'
  | 'hallway'
  | 'closet'
  | 'storage'
  | 'laundry'
  | 'garage'
  | 'balcony'
  | 'terrace'
  | 'study'
  | 'staircase'
  | 'lift'
  | 'service'
  | 'outdoor'
  | 'unknown';

export interface Room {
  id: string;
  label?: string;
  type: RoomType;
  typeSource: DataSource;
  boundary: Polygon;
  boundingBox: BoundingBox;
  areaReal?: Dimension;
  areaPixels?: number;
  perimeterPixels?: number;
  annotatedWidth?: Dimension;
  annotatedDepth?: Dimension;
  wallIds: string[];
  openingIds: string[];
  adjacentRoomIds: string[];
  connectedRoomIds: string[];
  isExteriorExposed: boolean;
  exteriorWallIds: string[];
  fixtures: FixtureObject[];
  confidence: Confidence;
  validationWarnings: string[];
}

export interface FixtureObject {
  id: string;
  category: FixtureCategory;
  label?: string;
  boundingBox: BoundingBox;
  orientation?: number;
  confidence: Confidence;
  source: DataSource;
}

export type FixtureCategory =
  | 'bed'
  | 'sofa'
  | 'chair'
  | 'table-dining'
  | 'table-other'
  | 'desk'
  | 'wardrobe'
  | 'kitchen-counter'
  | 'kitchen-sink'
  | 'kitchen-stove'
  | 'refrigerator'
  | 'toilet'
  | 'washbasin'
  | 'bathtub'
  | 'shower'
  | 'washer'
  | 'dryer'
  | 'stairs'
  | 'other'
  | 'unknown';

export interface Annotation {
  id: string;
  text: string;
  normalizedText?: string;
  type: AnnotationType;
  position: Point;
  refObjectId?: string;
  confidence: Confidence;
}

export type AnnotationType =
  | 'room-label'
  | 'room-dimension'
  | 'wall-dimension'
  | 'door-label'
  | 'window-label'
  | 'material-note'
  | 'grid-label'
  | 'level-label'
  | 'north-arrow'
  | 'scale-notation'
  | 'legend'
  | 'general-note'
  | 'unknown';

export interface ScaleCalibration {
  pixelLength: number;
  realLength: Dimension;
  pixelsPerUnit: number;
  source: DataSource;
  confidence: Confidence;
}

export interface Orientation {
  northAngleDeg?: number;
  northAngleSource: DataSource;
  entranceFacing?: string;
  confidence: Confidence;
}

export interface ValidationWarning {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  objectIds?: string[];
}

export interface BuildingMetadata {
  title?: string;
  floorLevel?: string;
  totalFloors?: number;
  totalFloorsSource: DataSource;
  buildingWidthReal?: Dimension;
  buildingDepthReal?: Dimension;
  totalAreaReal?: Dimension;
}

export interface ImageMetadata {
  source: string;
  widthPixels: number;
  heightPixels: number;
  analyzedAt: string;
  modelId: string;
}

export interface FloorPlanModel {
  schemaVersion: '1.0';
  imageMetadata: ImageMetadata;
  buildingMetadata: BuildingMetadata;
  scale?: ScaleCalibration;
  orientation: Orientation;
  buildingFootprint?: Polygon;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  annotations: Annotation[];
  adjacencyGraph: Record<string, string[]>;
  connectivityGraph: Record<string, string[]>;
  exteriorExposedRoomIds: string[];
  incompleteBoundaryRoomIds: string[];
  validationWarnings: ValidationWarning[];
  unresolvedAmbiguities: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Input / Options
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractionInput {
  imageBytes: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sourceName: string;
  knownWidthReal?: Dimension;
  northAngleDeg?: number;
}

export interface ExtractionOptions {
  /**
   * Bedrock Mantle OpenAI-compatible Chat Completions endpoint URL.
   * Default: "https://bedrock-mantle.ap-south-1.api.aws/v1/chat/completions"
   */
  endpointUrl?: string;
  /**
   * API Key for Bedrock Mantle authentication (used as Bearer token).
   * Defaults to process.env.BEDROCK_MANTLE_API_KEY.
   */
  apiKey?: string;
  /**
   * Model ID for Bedrock Mantle (from /v1/models catalog).
   * Default: "qwen.qwen3-vl-235b-a22b-instruct" (Qwen VL – only vision-capable model available)
   */
  modelId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bedrock Mantle System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are an expert architectural drawing analyser.
Your sole task is to convert a 2D floor-plan image into a structured JSON object
that exactly matches the FloorPlanModel schema described below.

Rules:
1. Reply with a single, valid JSON object and absolutely nothing else — no markdown fences, no explanatory text.
2. Use image pixel coordinates (origin top-left, x→right, y→down) for all geometry.
3. Tag every field with its data source: "annotated" (from text/symbols in the drawing),
   "detected" (visually identified), "inferred" (logically derived), or "unknown".
4. When a value cannot be reliably determined, use null and set source to "unknown".
5. Do NOT invent walls, doors, rooms, or dimensions that are not supported by the drawing.
6. Preserve original label text exactly in the label/text fields; put your normalised
   interpretation in separate normalised fields.
7. Distinguish physical adjacency (shared wall) from traversable connectivity (door/opening).
8. List every validation warning you detect (inconsistent dimensions, ambiguous symbols, etc.).
9. Do NOT treat furniture lines as walls. Do NOT treat door-swing arcs as walls.
10. North is unknown unless a north arrow is visible. Do not infer north from image orientation.

Schema:
{
  "schemaVersion": "1.0",
  "imageMetadata": { "source": string, "widthPixels": number, "heightPixels": number, "analyzedAt": string, "modelId": string },
  "buildingMetadata": { "title": string, "floorLevel": string, "totalFloors": number, "totalFloorsSource": string, "buildingWidthReal": { "value": number, "unit": string, "source": string, "rawAnnotation": string }, "buildingDepthReal": { "value": number, "unit": string, "source": string, "rawAnnotation": string }, "totalAreaReal": { "value": number, "unit": string, "source": string } },
  "scale": { "pixelLength": number, "realLength": { "value": number, "unit": string, "source": string }, "pixelsPerUnit": number, "source": string, "confidence": string },
  "orientation": { "northAngleDeg": number, "northAngleSource": string, "entranceFacing": string, "confidence": string },
  "buildingFootprint": { "points": [{ "x": number, "y": number }] },
  "rooms": [
    {
      "id": string, "label": string, "type": string, "typeSource": string,
      "boundary": { "points": [{ "x": number, "y": number }] },
      "boundingBox": { "x": number, "y": number, "width": number, "height": number },
      "areaReal": { "value": number, "unit": string, "source": string },
      "areaPixels": number, "perimeterPixels": number,
      "annotatedWidth": { "value": number, "unit": string, "source": string, "rawAnnotation": string },
      "annotatedDepth": { "value": number, "unit": string, "source": string, "rawAnnotation": string },
      "wallIds": [string], "openingIds": [string],
      "adjacentRoomIds": [string], "connectedRoomIds": [string],
      "isExteriorExposed": boolean, "exteriorWallIds": [string],
      "fixtures": [{ "id": string, "category": string, "label": string, "boundingBox": { "x": number, "y": number, "width": number, "height": number }, "orientation": number, "confidence": string, "source": string }],
      "confidence": string, "validationWarnings": [string]
    }
  ],
  "walls": [
    {
      "id": string,
      "startPoint": { "x": number, "y": number }, "endPoint": { "x": number, "y": number },
      "thicknessPixels": number, "thicknessReal": { "value": number, "unit": string, "source": string },
      "lengthReal": { "value": number, "unit": string, "source": string }, "orientation": string,
      "boundingRoomIds": [string], "isExterior": boolean, "isExteriorSource": string,
      "isLoadBearing": boolean, "isLoadBearingSource": string, "confidence": string
    }
  ],
  "openings": [
    {
      "id": string, "type": string, "wallId": string,
      "positionOnWall": { "x": number, "y": number },
      "widthReal": { "value": number, "unit": string, "source": string },
      "heightReal": { "value": number, "unit": string, "source": string },
      "widthPixels": number,
      "hingePoint": { "x": number, "y": number },
      "swingEndPoint": { "x": number, "y": number },
      "swingDirection": string,
      "connectsSpaceIds": [string],
      "isExterior": boolean, "confidence": string, "source": string
    }
  ],
  "annotations": [
    { "id": string, "text": string, "normalizedText": string, "type": string, "position": { "x": number, "y": number }, "refObjectId": string, "confidence": string }
  ],
  "adjacencyGraph": {},
  "connectivityGraph": {},
  "exteriorExposedRoomIds": [string],
  "incompleteBoundaryRoomIds": [string],
  "validationWarnings": [{ "severity": string, "code": string, "message": string, "objectIds": [string] }],
  "unresolvedAmbiguities": [string],
  "createdAt": string
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Internal HTTP & Post-processing Helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function buildAdditionalUserInstructions(input: ExtractionInput): string {
  const lines: string[] = [
    `Image source filename: ${input.sourceName}`,
    `Image byte length: ${input.imageBytes.length} bytes.`,
  ];
  if (input.knownWidthReal) {
    lines.push(
      `Confirmed building width annotation: ${input.knownWidthReal.value} ${input.knownWidthReal.unit} (source: "annotated"). Use this reference to calibrate real-world scale.`,
    );
  }
  if (input.northAngleDeg !== undefined) {
    lines.push(
      `North angle override: ${input.northAngleDeg}° clockwise from image top (source: "annotated"). Use this value; ignore any north arrow in the drawing.`,
    );
  }
  lines.push(
    'Analyse the floor-plan image carefully and return the complete FloorPlanModel JSON object.',
  );
  return lines.join('\n');
}

function applyOverrides(model: FloorPlanModel, input: ExtractionInput): FloorPlanModel {
  if (input.northAngleDeg !== undefined) {
    model.orientation.northAngleDeg = input.northAngleDeg;
    model.orientation.northAngleSource = 'annotated';
  }
  return model;
}

function postProcessModel(model: FloorPlanModel, sourceName: string, modelId: string): FloorPlanModel {
  const now = new Date().toISOString();
  model.createdAt = now;
  model.imageMetadata.analyzedAt = now;
  model.imageMetadata.source = sourceName;
  model.imageMetadata.modelId = modelId;

  const roomIds = new Set(model.rooms.map((r) => r.id));
  const wallIds = new Set(model.walls.map((w) => w.id));
  const openingIds = new Set(model.openings.map((o) => o.id));

  for (const room of model.rooms) {
    for (const oid of room.openingIds) {
      if (!openingIds.has(oid)) {
        model.validationWarnings.push({
          severity: 'warning',
          code: 'DANGLING_OPENING_REF',
          message: `Room ${room.id} references opening ${oid} which does not exist in openings[].`,
          objectIds: [room.id, oid],
        });
      }
    }
    for (const wid of room.wallIds) {
      if (!wallIds.has(wid)) {
        model.validationWarnings.push({
          severity: 'warning',
          code: 'DANGLING_WALL_REF',
          message: `Room ${room.id} references wall ${wid} which does not exist in walls[].`,
          objectIds: [room.id, wid],
        });
      }
    }
  }

  const adjacency: Record<string, string[]> = {};
  const connectivity: Record<string, string[]> = {};
  for (const room of model.rooms) {
    adjacency[room.id] = [...new Set(room.adjacentRoomIds.filter((id) => roomIds.has(id)))];
    connectivity[room.id] = [...new Set(room.connectedRoomIds.filter((id) => roomIds.has(id)))];
  }
  model.adjacencyGraph = adjacency;
  model.connectivityGraph = connectivity;

  model.exteriorExposedRoomIds = model.rooms
    .filter((r) => r.isExteriorExposed)
    .map((r) => r.id);

  model.incompleteBoundaryRoomIds = model.rooms
    .filter((r) => r.validationWarnings?.some((w) => w.toLowerCase().includes('incomplete') || w.toLowerCase().includes('missing')))
    .map((r) => r.id);

  return model;
}

/**
 * Sends a request to the Bedrock Mantle OpenAI-compatible Chat Completions endpoint via HTTPS.
 */
function sendMantleRequest(
  endpointUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(endpointUrl);
    const postData = JSON.stringify(payload);

    const reqOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(
            new Error(
              `Bedrock Mantle HTTP ${res.statusCode} ${res.statusMessage}: ${body.slice(0, 500)}`,
            ),
          );
        }
        resolve(body);
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract a structured FloorPlanModel from a floor-plan image using Bedrock Mantle.
 */
export async function extractFloorPlanGeometry(
  input: ExtractionInput,
  options: ExtractionOptions = {},
): Promise<FloorPlanModel> {
  const endpointUrl =
    options.endpointUrl ??
    process.env.BEDROCK_MANTLE_ENDPOINT ??
    'https://bedrock-mantle.ap-south-1.api.aws/v1/chat/completions';

  const apiKey =
    options.apiKey ??
    process.env.BEDROCK_MANTLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Bedrock Mantle API key is required. Pass options.apiKey or set BEDROCK_MANTLE_API_KEY environment variable.',
    );
  }

  const modelId =
    options.modelId ??
    process.env.BEDROCK_MANTLE_MODEL_ID ??
    'qwen.qwen3-vl-235b-a22b-instruct';

  const base64Image = input.imageBytes.toString('base64');
  const userInstructions = buildAdditionalUserInstructions(input);

  // Build OpenAI-compatible chat completions payload.
  // Image is sent as a data URI in an image_url content block.
  const requestPayload = {
    model: modelId,
    max_tokens: 16000,
    messages: [
      {
        role: 'system',
        content: EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${input.mimeType};base64,${base64Image}`,
            },
          },
          {
            type: 'text',
            text: userInstructions,
          },
        ],
      },
    ],
  };

  const rawResponse = await sendMantleRequest(endpointUrl, apiKey, requestPayload);

  // Parse OpenAI-format response: choices[0].message.content
  let mantleResult: {
    choices?: { message?: { content?: string } }[];
    error?: { type: string; message: string };
  };
  try {
    mantleResult = JSON.parse(rawResponse);
  } catch {
    throw new Error(`Bedrock Mantle returned non-JSON response: ${rawResponse.slice(0, 300)}`);
  }

  if (mantleResult.error) {
    throw new Error(
      `Bedrock Mantle error [${mantleResult.error.type}]: ${mantleResult.error.message}`,
    );
  }

  const messageContent = mantleResult.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error(
      `Bedrock Mantle response contained no message content.\nFull response: ${rawResponse.slice(0, 500)}`,
    );
  }

  const cleaned = stripMarkdown(messageContent);

  let rawModel: FloorPlanModel;
  try {
    rawModel = JSON.parse(cleaned) as FloorPlanModel;
  } catch (err) {
    throw new Error(
      `Mantle output could not be parsed as FloorPlanModel JSON.\n` +
      `Parse error: ${(err as Error).message}\n` +
      `Raw output (first 500 chars): ${cleaned.slice(0, 500)}`,
    );
  }

  applyOverrides(rawModel, input);
  return postProcessModel(rawModel, input.sourceName, modelId);
}
