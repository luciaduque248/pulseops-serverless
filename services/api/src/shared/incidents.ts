import { GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Identity } from './auth';
import { db, tableName } from './db';
import { ForbiddenError, NotFoundError } from './errors';

export interface IncidentItem {
  PK: string;
  SK: 'META';
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: 'INCIDENTS';
  GSI2SK: string;
  entity: 'Incident';
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export const toIncident = (item: IncidentItem) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  category: item.category,
  priority: item.priority,
  status: item.status,
  createdBy: item.createdBy,
  ...(item.assignedTo ? { assignedTo: item.assignedTo } : {}),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export async function getIncidentItem(id: string): Promise<IncidentItem> {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { PK: `INCIDENT#${id}`, SK: 'META' } }));
  if (!result.Item) throw new NotFoundError('Incident not found');
  return result.Item as IncidentItem;
}

export function assertIncidentAccess(item: IncidentItem, identity: Identity) {
  if (!identity.isOperator && item.createdBy !== identity.sub) throw new ForbiddenError();
}
