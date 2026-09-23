import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from './errors';

export interface Identity {
  sub: string;
  groups: string[];
  isOperator: boolean;
}

export function getIdentity(event: APIGatewayProxyEventV2WithJWTAuthorizer): Identity {
  const claims = event.requestContext.authorizer.jwt.claims;
  const sub = String(claims.sub ?? '');
  if (!sub) throw new ForbiddenError('JWT does not contain a subject');
  const rawGroups = claims['cognito:groups'];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.map(String)
    : typeof rawGroups === 'string'
      ? rawGroups.replace(/[\[\]"]/g, '').split(',').map(group => group.trim()).filter(Boolean)
      : [];
  return { sub, groups, isOperator: groups.includes('Admins') || groups.includes('Agents') };
}
