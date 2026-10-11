import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as path from 'path';
import { extractFloorPlanGeometry } from './services/floorplan/geometry-extraction';
import { collectEnvironmentalData } from './services/environmental';
import { runThermalSimulation } from './services/thermal';
import { renderThermalFloorPlanSvg, reviewThermalVisualization } from './services/renderer';

const s3Client = new S3Client({});
const EXPECTED_BUCKET = process.env.UPLOAD_BUCKET || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL;
const BEDROCK_MANTLE_API_KEY = process.env.BEDROCK_MANTLE_API_KEY;
const BEDROCK_MANTLE_ENDPOINT = process.env.BEDROCK_MANTLE_ENDPOINT;
const BEDROCK_MANTLE_MODEL_ID = process.env.BEDROCK_MANTLE_MODEL_ID || process.env.BEDROCK_MODEL_ID;
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME_MAP: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
};

/**
 * Reads a stream fully into a Buffer.
 * Used only for images, which are bounded in practice by S3 upload limits.
 */
const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

export const lambdaHandler: S3Handler = async (event: S3Event): Promise<void> => {
    for (const record of event.Records) {
        const sourceBucket = record.s3.bucket.name;
        // Decode S3 object key correctly, including URL-encoded characters and '+' replacing spaces
        const rawKey = record.s3.object.key;
        const sourceKey = decodeURIComponent(rawKey.replace(/\+/g, ' '));

        console.log(`Processing S3 record: s3://${sourceBucket}/${sourceKey}`);

        // Validate bucket if configured
        if (EXPECTED_BUCKET && sourceBucket !== EXPECTED_BUCKET) {
            console.warn(`Skipping event from unconfigured bucket: ${sourceBucket} (expected: ${EXPECTED_BUCKET})`);
            continue;
        }

        // Validate key prefix — must be under projects/{projectId}/{fileName}
        // Never process results/ to avoid triggering recursion
        if (!sourceKey.startsWith('projects/')) {
            console.log(`Ignoring key outside projects/ prefix: ${sourceKey}`);
            continue;
        }

        const keyParts = sourceKey.split('/');
        // Format expected: projects/{projectId}/{fileName...}
        if (keyParts.length < 3) {
            console.warn(`Ignoring malformed project key structure: ${sourceKey}`);
            continue;
        }

        const projectId = keyParts[1];
        const fileName = keyParts.slice(2).join('/');
        const parsedPath = path.parse(fileName);
        const ext = parsedPath.ext.toLowerCase();

        // Validate supported image extension
        if (!SUPPORTED_EXTENSIONS.has(ext)) {
            console.log(`Ignoring file with unsupported extension "${ext}": ${sourceKey}`);
            continue;
        }

        const mimeType = MIME_MAP[ext];
        const fileNameWithoutExtension = parsedPath.name;
        const resultKey = `results/${projectId}/${fileNameWithoutExtension}.json`;

        let fileSizeBytes: number = record.s3.object.size ?? 0;
        let contentType = 'application/octet-stream';

        try {
            // Download the image
            const getObjResponse = await s3Client.send(
                new GetObjectCommand({
                    Bucket: sourceBucket,
                    Key: sourceKey,
                }),
            );

            contentType = getObjResponse.ContentType || 'application/octet-stream';
            if (getObjResponse.ContentLength) {
                fileSizeBytes = getObjResponse.ContentLength;
            }

            if (!(getObjResponse.Body instanceof Readable)) {
                throw new Error('S3 GetObject body is not a readable stream.');
            }

            const imageBytes = await streamToBuffer(getObjResponse.Body);
            fileSizeBytes = imageBytes.length;

            console.log(`Downloaded image: ${fileSizeBytes} bytes, type: ${contentType}`);
            console.log(`Starting geometry extraction (Gemini primary, Bedrock Mantle backup)…`);

            // Run geometry extraction: Gemini primary, Bedrock Mantle backup
            const floorPlanModel = await extractFloorPlanGeometry(
                {
                    imageBytes,
                    mimeType,
                    sourceName: sourceKey,
                },
                {
                    ...(GEMINI_API_KEY ? { geminiApiKey: GEMINI_API_KEY } : {}),
                    ...(GEMINI_MODEL ? { geminiModel: GEMINI_MODEL } : {}),
                    ...(BEDROCK_MANTLE_ENDPOINT ? { endpointUrl: BEDROCK_MANTLE_ENDPOINT } : {}),
                    ...(BEDROCK_MANTLE_API_KEY ? { apiKey: BEDROCK_MANTLE_API_KEY } : {}),
                    ...(BEDROCK_MANTLE_MODEL_ID ? { modelId: BEDROCK_MANTLE_MODEL_ID } : {}),
                },
            );

            console.log(
                `Geometry extraction complete — ` +
                `rooms: ${floorPlanModel.rooms.length}, ` +
                `walls: ${floorPlanModel.walls.length}, ` +
                `openings: ${floorPlanModel.openings.length}, ` +
                `warnings: ${floorPlanModel.validationWarnings.length}`,
            );

            // 2. Environmental Collection (Open-Meteo & NASA POWER)
            console.log(`Collecting location environmental profile…`);
            const defaultLat = 28.6139; // Default or extracted
            const defaultLon = 77.2090;
            let envProfile;
            try {
                envProfile = await collectEnvironmentalData({
                    latitude: defaultLat,
                    longitude: defaultLon,
                    name: 'Project Site',
                });
            } catch (envErr) {
                console.warn(`Live environmental collection failed, fallback to synthetic: ${(envErr as Error).message}`);
                // Simple fallback hourly profile
                const nowIso = new Date().toISOString();
                envProfile = {
                    location: { latitude: defaultLat, longitude: defaultLon, elevationM: 215, timezone: 'Asia/Kolkata', name: 'Project Site' },
                    currentConditions: { timestamp: nowIso, temperatureC: 31.5, relativeHumidityPercent: 55, wetBulbTemperatureC: 24.2, wetBulbMethod: 'stull-2011', windSpeedMps: 3.4, windDirectionDegrees: 180, windDirectionCompass: 'S', surfacePressureHpa: 1012 },
                    hourlyConditions: Array.from({ length: 24 }).map((_, h) => ({
                        timestamp: new Date(Date.now() + h * 3600000).toISOString(),
                        temperatureC: 24 + Math.sin((h / 24) * Math.PI * 2) * 8,
                        relativeHumidityPercent: 50,
                        shortwaveRadiationWm2: h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) * 800 : 0,
                        directRadiationWm2: h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) * 600 : 0,
                        diffuseRadiationWm2: h >= 6 && h <= 18 ? 150 : 0,
                        windSpeedMps: 3.0,
                        windDirectionDegrees: 180,
                    })),
                } as any;
            }

            // 3. Transient Physics Simulation
            console.log(`Running transient room thermal simulation…`);
            const simulationOutput = runThermalSimulation({
                geometry: floorPlanModel,
                environment: envProfile,
            });

            // 4. Vector SVG Rendering with Spatial Gradients & Overlays
            console.log(`Rendering SVG thermal floor-plan…`);
            const renderResult = renderThermalFloorPlanSvg({
                geometry: floorPlanModel,
                simulation: simulationOutput,
                options: {
                    enableSpatialGradients: true,
                    showHeatFluxVectors: true,
                    showPhysicalOverlays: true,
                    showFixtures: true,
                },
            });

            // 5. Automated AI / Deterministic Quality Review
            console.log(`Running quality review…`);
            const review = reviewThermalVisualization({
                svg: renderResult.svg,
                geometry: floorPlanModel,
                simulation: simulationOutput,
                renderedRoomTemperatures: renderResult.renderedRoomTemperatures,
                options: { timestamp: renderResult.selectedTimestamp },
            });

            // Upload generated SVG
            const svgKey = `results/${projectId}/${fileNameWithoutExtension}.svg`;
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: sourceBucket,
                    Key: svgKey,
                    Body: renderResult.svg,
                    ContentType: 'image/svg+xml',
                }),
            );

            // Embed comprehensive structured output
            const result = {
                ...floorPlanModel,
                projectId,
                sourceBucket,
                sourceKey,
                fileName,
                fileSizeBytes,
                contentType,
                status: 'COMPLETED',
                svgUrlKey: svgKey,
                svgContent: renderResult.svg,
                environment: envProfile,
                simulation: {
                    simulationId: simulationOutput.simulationId,
                    selectedTimestamp: renderResult.selectedTimestamp,
                    colorScale: renderResult.colorScale,
                    renderedRoomTemperatures: renderResult.renderedRoomTemperatures,
                    roomSummaries: simulationOutput.roomSummaries,
                    physicalOverlays: renderResult.physicalOverlays,
                },
                qualityReview: review,
                message: 'Floor-plan geometry extracted, 24h thermal simulation completed, and vector SVG rendered.',
            };

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: sourceBucket,
                    Key: resultKey,
                    Body: JSON.stringify(result, null, 2),
                    ContentType: 'application/json',
                }),
            );

            console.log(`✓ Analysis & simulation complete. Saved JSON -> ${resultKey}, SVG -> ${svgKey}`);
        } catch (err) {
            // Write a FAILED result so callers can inspect the error without re-triggering
            const failedResult = {
                projectId,
                sourceBucket,
                sourceKey,
                fileName,
                contentType,
                fileSizeBytes,
                status: 'FAILED',
                message: `Geometry extraction failed: ${(err as Error).message ?? String(err)}`,
                createdAt: new Date().toISOString(),
            };

            try {
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: sourceBucket,
                        Key: resultKey,
                        Body: JSON.stringify(failedResult, null, 2),
                        ContentType: 'application/json',
                    }),
                );
            } catch (writeErr) {
                console.error(`Also failed to write FAILED result to S3:`, writeErr);
            }

            console.error(`Failed processing s3://${sourceBucket}/${sourceKey}:`, err);
            throw err;
        }
    }
};
