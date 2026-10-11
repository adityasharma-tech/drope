import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { expect, describe, it, jest } from '@jest/globals';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn().mockImplementation(async () => 'https://mock-s3-upload-url.amazonaws.com/test'),
}));

import { lambdaHandler } from '../../app';

describe('Unit test for get-upload-url handler', function () {
    it('verifies successful response with presigned upload URL', async () => {
        const event: APIGatewayProxyEvent = {
            httpMethod: 'POST',
            body: JSON.stringify({ fileName: 'file.txt', fileType: 'text/plain' }),
            headers: {},
            isBase64Encoded: false,
            multiValueHeaders: {},
            multiValueQueryStringParameters: {},
            path: '/projects/project-123/upload-url',
            pathParameters: { id: 'project-123' },
            queryStringParameters: {},
            requestContext: {
                accountId: '123456789012',
                apiId: '1234',
                authorizer: {},
                httpMethod: 'POST',
                identity: {
                    accessKey: '',
                    accountId: '',
                    apiKey: '',
                    apiKeyId: '',
                    caller: '',
                    clientCert: {
                        clientCertPem: '',
                        issuerDN: '',
                        serialNumber: '',
                        subjectDN: '',
                        validity: { notAfter: '', notBefore: '' },
                    },
                    cognitoAuthenticationProvider: '',
                    cognitoAuthenticationType: '',
                    cognitoIdentityId: '',
                    cognitoIdentityPoolId: '',
                    principalOrgId: '',
                    sourceIp: '',
                    user: '',
                    userAgent: '',
                    userArn: '',
                },
                path: '/projects/project-123/upload-url',
                protocol: 'HTTP/1.1',
                requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
                requestTimeEpoch: 1428582896000,
                resourceId: '123456',
                resourcePath: '/projects/{id}/upload-url',
                stage: 'dev',
            },
            resource: '',
            stageVariables: {},
        };
        const result: APIGatewayProxyResult = await lambdaHandler(event);

        expect(result.statusCode).toEqual(200);
        const body = JSON.parse(result.body);
        expect(body.uploadUrl).toEqual('https://mock-s3-upload-url.amazonaws.com/test');
        expect(body.projectId).toEqual('project-123');
        expect(body.key).toContain('projects/project-123/file.txt');
    });

    it('returns 400 when project id is missing', async () => {
        const event = {
            httpMethod: 'POST',
            body: '{}',
            headers: {},
            isBase64Encoded: false,
            multiValueHeaders: {},
            multiValueQueryStringParameters: {},
            path: '/projects//upload-url',
            pathParameters: null,
            queryStringParameters: null,
            requestContext: {} as any,
            resource: '',
            stageVariables: null,
        } as unknown as APIGatewayProxyEvent;

        const result = await lambdaHandler(event);
        expect(result.statusCode).toEqual(400);
    });
});
