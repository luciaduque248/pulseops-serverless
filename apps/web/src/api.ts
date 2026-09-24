import { fetchAuthSession } from 'aws-amplify/auth';
import { appConfig } from './config';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorPayload {
  error?: {
    message?: string;
    code?: string;
  };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await fetchAuthSession();
  // HTTP API JWT authorizers validate the Cognito User Pool Client audience.
  // Cognito exposes that audience in the ID token (`aud`), not in the access token.
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new ApiError(401, 'Your session has expired. Please sign in again.', 'UNAUTHENTICATED');

  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as ErrorPayload | null)?.error;
    throw new ApiError(response.status, error?.message ?? 'Request failed', error?.code);
  }
  return payload as T;
}
