import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getIdentity } from '../shared/auth';
import { db, tableName } from '../shared/db';
import { handleError, json } from '../shared/http';
import { toIncident, type IncidentItem } from '../shared/incidents';

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
  try {
    const identity = getIdentity(event);
    const query = identity.isOperator
      ? { IndexName: 'GSI2', KeyConditionExpression: 'GSI2PK = :pk', ExpressionAttributeValues: { ':pk': 'INCIDENTS' } }
      : { IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :pk', ExpressionAttributeValues: { ':pk': `USER#${identity.sub}` } };
    const result = await db.send(new QueryCommand({ TableName: tableName, ...query, ScanIndexForward: false, Limit: 100 }));
    const items = (result.Items ?? []) as IncidentItem[];
    return json(200, {
      total: items.length,
      open: items.filter(item => item.status === 'open').length,
      inProgress: items.filter(item => item.status === 'in_progress').length,
      resolved: items.filter(item => item.status === 'resolved').length,
      critical: items.filter(item => item.priority === 'critical' && item.status !== 'closed').length,
      recent: items.slice(0, 6).map(toIncident),
    });
  } catch (error) { return handleError(error, event.requestContext.requestId); }
};
