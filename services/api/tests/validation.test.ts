import { describe, expect, it } from 'vitest';
import { createIncidentSchema, updateIncidentSchema } from '../src/shared/validation';

describe('incident validation', () => {
  it('accepts a valid incident', () => {
    expect(createIncidentSchema.safeParse({ title: 'VPN cannot connect', description: 'Multiple users cannot establish a VPN session.', category: 'Network', priority: 'high' }).success).toBe(true);
  });

  it('rejects unsupported priorities and short descriptions', () => {
    expect(createIncidentSchema.safeParse({ title: 'VPN issue', description: 'broken', category: 'Network', priority: 'urgent' }).success).toBe(false);
  });

  it('requires at least one patch field', () => {
    expect(updateIncidentSchema.safeParse({}).success).toBe(false);
    expect(updateIncidentSchema.safeParse({ status: 'resolved' }).success).toBe(true);
  });
});
