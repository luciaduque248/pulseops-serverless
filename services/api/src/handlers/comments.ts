import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getIdentity } from '../shared/auth';
import { db, tableName } from '../shared/db';
import { BadRequestError } from '../shared/errors';
import { handleError, json, parseBody } from '../shared/http';
import { assertIncidentAccess, getIncidentItem } from '../shared/incidents';
import { commentSchema } from '../shared/validation';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const identity = getIdentity(event); const id = event.pathParameters?.id;
    if (!id) throw new BadRequestError('Incident id is required');
    const incident = await getIncidentItem(id); assertIncidentAccess(incident, identity);
    if (event.requestContext.http.method === 'GET') {
      const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `INCIDENT#${id}`, ':prefix': 'COMMENT#' }, ScanIndexForward: true }));
      const items = (result.Items ?? []).map(item => ({ id: item.id, incidentId: id, body: item.body, authorId: item.authorId, createdAt: item.createdAt }));
      return json(200, { items });
    }
    if (event.requestContext.http.method === 'POST') {
      const input = parseBody(event.body, commentSchema); const commentId = randomUUID(); const now = new Date().toISOString();
      const item = { PK: `INCIDENT#${id}`, SK: `COMMENT#${now}#${commentId}`, entity: 'Comment', id: commentId, incidentId: id, body: input.body, authorId: identity.sub, createdAt: now };
      await db.send(new PutCommand({ TableName: tableName, Item: item }));
      return json(201, { id: commentId, incidentId: id, body: input.body, authorId: identity.sub, createdAt: now });
    }
    throw new BadRequestError('Unsupported operation');
  } catch (error) { return handleError(error, event.requestContext.requestId); }
};
