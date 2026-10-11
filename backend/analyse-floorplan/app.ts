import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as path from 'path';

const s3Client = new S3Client({});
const EXPECTED_BUCKET = process.env.UPLOAD_BUCKET || '';
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * Consumes a stream to safely calculate or confirm read without loading unbounded buffers into memory.
 */
const drainStream = async (stream: Readable): Promise<number> => {
    let bytesRead = 0;
    for await (const chunk of stream) {
        bytesRead += chunk.length;
    }
    return bytesRead;
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

        // Validate key prefix - must be under projects/{projectId}/{fileName}
        // Never process results/ to avoid recursion or unintended processing
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

        const fileNameWithoutExtension = parsedPath.name;
        const resultKey = `results/${projectId}/${fileNameWithoutExtension}.json`;

        try {
            const getObjResponse = await s3Client.send(
                new GetObjectCommand({
                    Bucket: sourceBucket,
                    Key: sourceKey,
                }),
            );

            const contentType = getObjResponse.ContentType || 'application/octet-stream';
            let fileSizeBytes = getObjResponse.ContentLength;

            // Stream handling: drain stream to verify readable content without loading unbounded memory
            if (getObjResponse.Body instanceof Readable) {
                const streamBytes = await drainStream(getObjResponse.Body);
                if (fileSizeBytes === undefined || fileSizeBytes === null) {
                    fileSizeBytes = streamBytes;
                }
            }

            const analysisResult = {
                projectId,
                sourceBucket,
                sourceKey,
                fileName,
                contentType,
                fileSizeBytes: fileSizeBytes ?? record.s3.object.size ?? 0,
                status: 'RECEIVED',
                message: 'Image successfully received and validated for floor-plan processing foundation.',
                createdAt: new Date().toISOString(),
            };

            await s3Client.send(
                new PutObjectCommand({
                    Bucket: sourceBucket,
                    Key: resultKey,
                    Body: JSON.stringify(analysisResult, null, 2),
                    ContentType: 'application/json',
                }),
            );

            console.log(`Saved analysis placeholder result to s3://${sourceBucket}/${resultKey}`);
        } catch (err) {
            console.error(`Failed processing s3://${sourceBucket}/${sourceKey}:`, err);
            throw err;
        }
    }
};
