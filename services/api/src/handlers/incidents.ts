import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { BatchWriteCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getIdentity } from '../shared/auth';
import { db, tableName } from '../shared/db';
import { BadRequestError } from '../shared/errors';
import { handleError, json, parseBody } from '../shared/http';
import { assertIncidentAccess, getIncidentItem, toIncident, type IncidentItem } from '../shared/incidents';
import { createIncidentSchema, statuses, updateIncidentSchema } from '../shared/validation';

const cursorEncode = (key: Record<string, unknown> | undefined) => key ? Buffer.from(JSON.stringify(key)).toString('base64url') : undefined;
const cursorDecode = (cursor: string | undefined) => {
  if (!cursor) return undefined;
  try { return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>; }
  catch { throw new BadRequestError('Invalid pagination cursor'); }
};

async function list(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const identity = getIdentity(event);
  const status = event.queryStringParameters?.status;
  if (status && !statuses.includes(status as (typeof statuses)[number])) throw new BadRequestError('Invalid status filter');
  const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit ?? 30) || 30, 1), 100);
  const cursor = cursorDecode(event.queryStringParameters?.cursor);

  const query = identity.isOperator
    ? {
        IndexName: 'GSI2', KeyConditionExpression: status ? 'GSI2PK = :pk AND begins_with(GSI2SK, :status)' : 'GSI2PK = :pk',
        ExpressionAttributeValues: status ? { ':pk': 'INCIDENTS', ':status': `STATUS#${status}#` } : { ':pk': 'INCIDENTS' },
      }
    : {
        IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :pk', ExpressionAttributeValues: { ':pk': `USER#${identity.sub}` },
        ...(status ? { FilterExpression: '#status = :status', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':pk': `USER#${identity.sub}`, ':status': status } } : {}),
      };

  const result = await db.send(new QueryCommand({ TableName: tableName, ...query, ScanIndexForward: false, Limit: limit, ExclusiveStartKey: cursor }));
  return json(200, { items: (result.Items as IncidentItem[] | undefined ?? []).map(toIncident), ...(result.LastEvaluatedKey ? { nextCursor: cursorEncode(result.LastEvaluatedKey) } : {}) });
}

async function create(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const identity = getIdentity(event);
  const input = parseBody(event.body, createIncidentSchema);
  const id = randomUUID();
  const now = new Date().toISOString();
  const item: IncidentItem = {
    PK: `INCIDENT#${id}`, SK: 'META', GSI1PK: `USER#${identity.sub}`, GSI1SK: `INCIDENT#${now}#${id}`,
    GSI2PK: 'INCIDENTS', GSI2SK: `STATUS#open#${now}#${id}`, entity: 'Incident', id, ...input,
    status: 'open', createdBy: identity.sub, createdAt: now, updatedAt: now,
  };
  await db.send(new PutCommand({ TableName: tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
  console.info(JSON.stringify({ level: 'info', action: 'incident.created', incidentId: id, actor: identity.sub }));
  return json(201, toIncident(item));
}

async function get(event: APIGatewayProxyEventV2WithJWTAuthorizer, id: string) {
  const identity = getIdentity(event); const item = await getIncidentItem(id); assertIncidentAccess(item, identity);
  return json(200, toIncident(item));
}

async function update(event: APIGatewayProxyEventV2WithJWTAuthorizer, id: string) {
  const identity = getIdentity(event); const existing = await getIncidentItem(id); assertIncidentAccess(existing, identity);
  const input = parseBody(event.body, updateIncidentSchema);
  if ('assignedTo' in input && !identity.isOperator) throw new BadRequestError('Only agents or admins can assign incidents');
  const now = new Date().toISOString();
  const values: Record<string, unknown> = { ':updatedAt': now };
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const sets = ['#updatedAt = :updatedAt'];
  for (const [key, value] of Object.entries(input)) {
    names[`#${key}`] = key; values[`:${key}`] = value; sets.push(`#${key} = :${key}`);
  }
  if (input.status) { names['#GSI2SK'] = 'GSI2SK'; values[':GSI2SK'] = `STATUS#${input.status}#${existing.createdAt}#${id}`; sets.push('#GSI2SK = :GSI2SK'); }
  const result = await db.send(new UpdateCommand({ TableName: tableName, Key: { PK: existing.PK, SK: existing.SK }, UpdateExpression: `SET ${sets.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ConditionExpression: 'attribute_exists(PK)', ReturnValues: 'ALL_NEW' }));
  console.info(JSON.stringify({ level: 'info', action: 'incident.updated', incidentId: id, actor: identity.sub, fields: Object.keys(input) }));
  return json(200, toIncident(result.Attributes as IncidentItem));
}

async function remove(event: APIGatewayProxyEventV2WithJWTAuthorizer, id: string) {
  const identity = getIdentity(event); const existing = await getIncidentItem(id); assertIncidentAccess(existing, identity);
  const children = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': existing.PK }, ProjectionExpression: 'PK, SK' }));
  const requests = (children.Items ?? []).map(item => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } }));
  for (let index = 0; index < requests.length; index += 25) await db.send(new BatchWriteCommand({ RequestItems: { [tableName]: requests.slice(index, index + 25) } }));
  console.info(JSON.stringify({ level: 'info', action: 'incident.deleted', incidentId: id, actor: identity.sub }));
  return { statusCode: 204 };
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const method = event.requestContext.http.method; const id = event.pathParameters?.id;
    if (method === 'GET' && !id) return await list(event);
    if (method === 'POST' && !id) return await create(event);
    if (!id) throw new BadRequestError('Incident id is required');
    if (method === 'GET') return await get(event, id);
    if (method === 'PATCH') return await update(event, id);
    if (method === 'DELETE') return await remove(event, id);
    throw new BadRequestError('Unsupported operation');
  } catch (error) { return handleError(error, event.requestContext.requestId); }
};
