import { json } from '../shared/http';

export const handler = async () => json(200, { service: 'pulseops-api', status: 'ok', timestamp: new Date().toISOString() });
