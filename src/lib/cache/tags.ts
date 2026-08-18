import { revalidateTag } from 'next/cache';

/**
 * Canonical cache tags for organization-scoped data.
 */
export const CACHE_TAGS = {
  settings: (orgId: string = 'global') => `settings:${orgId}`,
  ojts: (orgId: string = 'global') => `ojts:${orgId}`,
} as const;

/**
 * Triggers on-demand cache revalidation for an organization's site settings and configs.
 */
export function revalidateSettingsTag(orgId?: string | null): void {
  const tag = CACHE_TAGS.settings(orgId || 'global');
  revalidateTag(tag, 'default');
}

/**
 * Triggers on-demand cache revalidation for an organization's active OJT rosters.
 */
export function revalidateOjtsTag(orgId?: string | null): void {
  const tag = CACHE_TAGS.ojts(orgId || 'global');
  revalidateTag(tag, 'default');
}

