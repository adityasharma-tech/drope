#!/usr/bin/env ts-node
/**
 * Quick diagnostic: ask the model two things about the floor plan:
 *  1. Plain-language room list (no schema)
 *  2. Minimal JSON with just rooms[] (simplified schema)
 */
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';
import { URL } from 'url';

const KEY = process.env.BEDROCK_MANTLE_API_KEY!;
const ENDPOINT = 'https://bedrock-mantle.ap-south-1.api.aws/v1/chat/completions';
const MODEL = 'qwen.qwen3-vl-235b-a22b-instruct';

const imagePath = process.argv[2] ?? path.join(os.homedir(), 'Downloads', 'floor_plan.png');
const imgB64 = fs.readFileSync(imagePath).toString('base64');

function post(payload: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new URL(ENDPOINT);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'Authorization': `Bearer ${KEY}`,
      },
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function imageMsg(text: string) {
  return [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:image/png;base64,${imgB64}` } },
      { type: 'text', text },
    ],
  }];
}

async function main() {
  if (!KEY) { console.error('BEDROCK_MANTLE_API_KEY not set'); process.exit(1); }

  // ── Step 1: Plain description ───────────────────────────────────────────────
  console.log('\n══ Step 1: Plain room list ══\n');
  const r1 = await post({
    model: MODEL,
    max_tokens: 1000,
    messages: imageMsg(
      'This is an architectural floor plan. List EVERY room/space you can see. ' +
      'For each: room name, rough location (e.g. top-left), and approximate bounding box in pixels (x, y, width, height). ' +
      'Do NOT output JSON — just a numbered plain-text list.'
    ),
  });
  const d1 = JSON.parse(r1);
  const text1 = d1.choices?.[0]?.message?.content ?? r1;
  console.log(text1);
  console.log('\nFinish reason:', d1.choices?.[0]?.finish_reason);

  // ── Step 2: Minimal JSON (rooms only) ───────────────────────────────────────
  console.log('\n\n══ Step 2: Minimal JSON (rooms only) ══\n');
  const r2 = await post({
    model: MODEL,
    max_tokens: 4000,
    messages: imageMsg(
      'This is an architectural floor plan. ' +
      'Output ONLY a JSON array called "rooms" where each element has: ' +
      '{"id":"r1","label":"Kitchen","boundingBox":{"x":0,"y":0,"width":100,"height":100}}. ' +
      'Include every visible room. Reply with only the JSON object {"rooms":[...]} — no markdown, no explanation.'
    ),
  });
  const d2 = JSON.parse(r2);
  const text2 = d2.choices?.[0]?.message?.content ?? r2;
  console.log(text2);
  console.log('\nFinish reason:', d2.choices?.[0]?.finish_reason);
}

main().catch(e => { console.error(e.message); process.exit(1); });
