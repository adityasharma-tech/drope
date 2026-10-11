import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as path from 'path';
import { extractFloorPlanGeometry } from './services/floorplan/geometry-extraction';

const s3Client = new S3Client({});
const EXPECTED_BUCKET = process.env.UPLOAD_BUCKET || '';
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
            console.log(`Starting geometry extraction via Bedrock…`);

            // Run geometry extraction via Bedrock Mantle
            const floorPlanModel = await extractFloorPlanGeometry(
                {
                    imageBytes,
                    mimeType,
                    sourceName: sourceKey,
                },
                {
                    ...(BEDROCK_MANTLE_ENDPOINT ? { endpointUrl: BEDROCK_MANTLE_ENDPOINT } : {}),
                    ...(BEDROCK_MANTLE_API_KEY ? { apiKey: BEDROCK_MANTLE_API_KEY } : {}),
                    ...(BEDROCK_MANTLE_MODEL_ID ? { modelId: BEDROCK_MANTLE_MODEL_ID } : {}),
                },
            );

            // Embed source/provenance fields into the model
            const result = {
                ...floorPlanModel,
                projectId,
                sourceBucket,
                sourceKey,
                fileName,
                fileSizeBytes,
                contentType,
                status: 'RECEIVED',
                message: 'Floor-plan image received and geometry extraction completed. Thermal simulation phase not yet started.',
            };

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: sourceBucket,
                    Key: resultKey,
                    Body: JSON.stringify(result, null, 2),
                    ContentType: 'application/json',
                }),
            );

            console.log(
                `Geometry extraction complete — ` +
                `rooms: ${floorPlanModel.rooms.length}, ` +
                `walls: ${floorPlanModel.walls.length}, ` +
                `openings: ${floorPlanModel.openings.length}, ` +
                `warnings: ${floorPlanModel.validationWarnings.length}`,
            );
            console.log(`Result saved to s3://${sourceBucket}/${resultKey}`);
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
