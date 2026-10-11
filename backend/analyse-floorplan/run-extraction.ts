#!/usr/bin/env ts-node
/**
 * Local runner for the floor-plan geometry extraction service.
 * Primary provider: Native Google Gemini API (gemini-2.5-flash / gemini-1.5-pro)
 * Backup provider: Bedrock Mantle (qwen.qwen3-vl-235b-a22b-instruct)
 *
 * Usage:
 *   cd backend/analyse-floorplan
 *   GEMINI_API_KEY="your-gemini-key" KNOWN_WIDTH_FT=40 npx ts-node run-extraction.ts [path/to/floor_plan.png] [output.json]
 *
 * Defaults:
 *   image        → ~/Downloads/floor_plan.png
 *   output       → ./extraction-result.json
 *   gemini model → gemini-2.5-flash
 *   bedrock model→ qwen.qwen3-vl-235b-a22b-instruct
 *
 * Environment variables:
 *   GEMINI_API_KEY          – Google Gemini API Key (primary)
 *   GEMINI_MODEL            – Gemini model name (default: gemini-2.5-flash)
 *   BEDROCK_MANTLE_API_KEY  – Bedrock Mantle API Key (backup)
 *   BEDROCK_MANTLE_ENDPOINT – Custom Mantle endpoint URL (optional)
 *   BEDROCK_MANTLE_MODEL_ID – Bedrock Model ID (default: qwen.qwen3-vl-235b-a22b-instruct)
 *   KNOWN_WIDTH_FT          – Calibration: known building width in feet (e.g. 40)
 *   NORTH_ANGLE_DEG         – North angle in degrees clockwise from image top
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractFloorPlanGeometry, Dimension } from './services/floorplan/geometry-extraction';

async function main(): Promise<void> {
  const imagePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(os.homedir(), 'Downloads', 'floor_plan.png');

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(__dirname, 'extraction-result.json');

  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    process.exit(1);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const mimeType = mimeMap[ext];
  if (!mimeType) {
    console.error(`Unsupported image type: ${ext}. Supported: .png .jpg .jpeg .webp`);
    process.exit(1);
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  const bedrockApiKey = process.env.BEDROCK_MANTLE_API_KEY;
  const bedrockEndpoint =
    process.env.BEDROCK_MANTLE_ENDPOINT ??
    'https://bedrock-mantle.ap-south-1.api.aws/v1/chat/completions';
  const bedrockModelId =
    process.env.BEDROCK_MANTLE_MODEL_ID ?? 'qwen.qwen3-vl-235b-a22b-instruct';

  if (!geminiApiKey && !bedrockApiKey) {
    console.error('Error: Neither GEMINI_API_KEY nor BEDROCK_MANTLE_API_KEY is set.');
    console.error('Please run with: GEMINI_API_KEY="your-key" npx ts-node run-extraction.ts ...');
    process.exit(1);
  }

  let knownWidthReal: Dimension | undefined;
  if (process.env.KNOWN_WIDTH_FT) {
    knownWidthReal = {
      value: parseFloat(process.env.KNOWN_WIDTH_FT),
      unit: 'ft',
      source: 'annotated',
      rawAnnotation: `${process.env.KNOWN_WIDTH_FT}'`,
    };
  }

  let northAngleDeg: number | undefined;
  if (process.env.NORTH_ANGLE_DEG) {
    northAngleDeg = parseFloat(process.env.NORTH_ANGLE_DEG);
  }

  console.log('──────────────────────────────────────────────');
  console.log('Floor-Plan Geometry Extraction');
  console.log('──────────────────────────────────────────────');
  console.log(`  Image    : ${imagePath}`);
  console.log(`  Output   : ${outputPath}`);
  console.log(`  Primary  : ${geminiApiKey ? `Gemini (${geminiModel})` : 'Not configured'}`);
  console.log(`  Backup   : ${bedrockApiKey ? `Bedrock Mantle (${bedrockModelId})` : 'Not configured'}`);
  if (knownWidthReal) console.log(`  Width    : ${knownWidthReal.value} ${knownWidthReal.unit} (calibration override)`);
  if (northAngleDeg !== undefined) console.log(`  North    : ${northAngleDeg}° (override)`);
  console.log('──────────────────────────────────────────────\n');

  const imageBytes = fs.readFileSync(imagePath);
  const sourceName = path.basename(imagePath);

  console.log(`Reading image (${(imageBytes.length / 1024).toFixed(1)} KB)…`);
  console.log('Sending for analysis… (this may take 15–45 s)\n');

  const startMs = Date.now();
  const model = await extractFloorPlanGeometry(
    { imageBytes, mimeType, sourceName, knownWidthReal, northAngleDeg },
    {
      geminiApiKey,
      geminiModel,
      endpointUrl: bedrockEndpoint,
      apiKey: bedrockApiKey,
      modelId: bedrockModelId,
    },
  );
  const elapsedMs = Date.now() - startMs;

  fs.writeFileSync(outputPath, JSON.stringify(model, null, 2), 'utf-8');

  console.log(`✓ Extraction complete in ${(elapsedMs / 1000).toFixed(1)} s`);
  console.log(`✓ Result written to: ${outputPath}`);
  console.log('');
  console.log('Summary:');
  console.log(`  Rooms     : ${model.rooms.length}`);
  console.log(`  Walls     : ${model.walls.length}`);
  console.log(`  Openings  : ${model.openings.length}`);
  console.log(`  Fixtures  : ${model.rooms.reduce((n, r) => n + (r.fixtures?.length ?? 0), 0)}`);
  console.log(`  Warnings  : ${model.validationWarnings.length}`);
  if (model.validationWarnings.length > 0) {
    for (const w of model.validationWarnings.slice(0, 5)) {
      console.log(`    [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
    }
    if (model.validationWarnings.length > 5) {
      console.log(`    … and ${model.validationWarnings.length - 5} more (see output JSON)`);
    }
  }
}

main().catch((err) => {
  console.error('\nExtraction failed:', err.message ?? err);
  process.exit(1);
});
