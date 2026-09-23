import { fetchAuthSession } from 'aws-amplify/auth';
import { appConfig } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  if (!token) throw new ApiError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');

  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | T | null;
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new ApiError(response.status, error?.message ?? 'Request failed', error?.code);
  }
  return payload as T;
}
