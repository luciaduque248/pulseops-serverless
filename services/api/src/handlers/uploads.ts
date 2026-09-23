import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getIdentity } from '../shared/auth';
import { attachmentsBucket } from '../shared/db';
import { BadRequestError } from '../shared/errors';
import { handleError, json, parseBody } from '../shared/http';
import { assertIncidentAccess, getIncidentItem } from '../shared/incidents';
import { attachmentSchema } from '../shared/validation';

const s3 = new S3Client({});
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv']);

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const identity = getIdentity(event); const id = event.pathParameters?.id;
    if (!id) throw new BadRequestError('Incident id is required');
    const incident = await getIncidentItem(id); assertIncidentAccess(incident, identity);
    const input = parseBody(event.body, attachmentSchema);
    if (!allowedTypes.has(input.contentType)) throw new BadRequestError('Unsupported file type');
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `incidents/${id}/${identity.sub}/${randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({ Bucket: attachmentsBucket, Key: key, ContentType: input.contentType, Metadata: { incidentId: id, uploadedBy: identity.sub } });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    return json(200, { uploadUrl, key, expiresIn: 600 });
  } catch (error) { return handleError(error, event.requestContext.requestId); }
};
