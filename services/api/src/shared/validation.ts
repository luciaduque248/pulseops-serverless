import { z } from 'zod';

export const priorities = ['low', 'medium', 'high', 'critical'] as const;
export const statuses = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const createIncidentSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(3000),
  category: z.string().trim().min(2).max(60),
  priority: z.enum(priorities),
}).strict();

export const updateIncidentSchema = z.object({
  title: z.string().trim().min(4).max(120).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  priority: z.enum(priorities).optional(),
  status: z.enum(statuses).optional(),
  assignedTo: z.string().trim().min(1).max(120).nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field must be provided');

export const commentSchema = z.object({ body: z.string().trim().min(2).max(1500) }).strict();

export const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(3).max(120),
}).strict();
