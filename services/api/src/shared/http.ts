import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ZodError, type ZodType } from 'zod';
import { AppError, BadRequestError } from './errors';

export const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function parseBody<T>(body: string | undefined, schema: ZodType<T>): T {
  if (!body) throw new BadRequestError('Request body is required');
  let value: unknown;
  try { value = JSON.parse(body); }
  catch { throw new BadRequestError('Request body must be valid JSON'); }
  return schema.parse(value);
}

export function handleError(error: unknown, requestId?: string): APIGatewayProxyStructuredResultV2 {
  if (error instanceof ZodError) {
    return json(422, { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }, requestId });
  }
  if (error instanceof AppError) {
    return json(error.statusCode, { error: { code: error.code, message: error.message }, requestId });
  }
  console.error(JSON.stringify({ level: 'error', message: 'Unhandled API error', requestId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error }));
  return json(500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId });
}
