export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentComment {
  id: string;
  incidentId: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface DashboardSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  recent: Incident[];
}

export interface PaginatedIncidents {
  items: Incident[];
  nextCursor?: string;
}
