// ============================================================
// OJT Tracker - Type Definitions
// ============================================================

export type UserRole = 'ojt' | 'supervisor' | 'admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  org_id?: string;
  avatar_url?: string;
  department?: string;
  required_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  id: string;
  org_id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address?: string;
  require_location_verification: boolean;
  timezone?: string;
  archive_retention_days?: number;
  updated_by?: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  clock_in?: string;
  clock_out?: string;
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_out_latitude?: number;
  clock_out_longitude?: number;
  clock_in_distance_meters?: number;
  clock_out_distance_meters?: number;
  total_hours?: number;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  profile?: Profile;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  position: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // loaded client-side
  tasks?: KanbanTask[];
}

export interface KanbanTask {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
  position: number;
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assignee?: Profile;
  archived_by_profile?: Profile;
  assigned_ojts?: Profile[]; // only accepted assignees
  task_assignees_detail?: TaskAssigneeDetail[]; // all assignees with status
  attachments?: TaskAttachment[];
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  profile?: Profile;
}

export interface TaskAssigneeDetail {
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  profile: Profile;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: 'image' | 'video' | 'document';
  file_size?: number;
  uploaded_by?: string;
  uploaded_at: string;
}

export interface AttendanceSummary {
  total_days: number;
  total_hours: number;
  required_hours: number;
  remaining_hours: number;
  completion_percentage: number;
}

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  invited_by?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  // joined
  organization?: Organization;
  invited_by_profile?: Profile;
}

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}


