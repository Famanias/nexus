import { Profile } from '@/types';

export type KanbanScope = 'personal' | 'organization';

export function getKanbanScope(profile: Profile | null | undefined): KanbanScope {
  return profile?.org_id ? 'organization' : 'personal';
}

export function isPersonalBoard(profile: Profile | null | undefined): boolean {
  return !profile?.org_id;
}

export function isOrganizationBoard(profile: Profile | null | undefined): boolean {
  return !!profile?.org_id;
}

export function canManageColumns(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return true;
}

export function canManageTasks(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  // Personal board: full control
  if (!profile.org_id) return true;
  // Org board: admin and supervisor can manage tasks
  return profile.role === 'admin' || profile.role === 'supervisor';
}

export function canAssignUsers(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  // Personal board: no assignment
  if (!profile.org_id) return false;
  // Org board: yes
  return true;
}

export function canEditTask(
  profile: Profile | null | undefined,
  taskAssigneeId: string | null | undefined,
  isAcceptedAssignee: boolean
): boolean {
  if (!profile) return false;
  // Personal board: if they are the task creator
  if (!profile.org_id) return taskAssigneeId === profile.id;
  // Org board: creator, admin, supervisor, or accepted assignee
  return (
    taskAssigneeId === profile.id ||
    profile.role === 'admin' ||
    profile.role === 'supervisor' ||
    isAcceptedAssignee
  );
}
