import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, formatTime, formatHours, formatFileSize } from '@/lib/utils/format';
import { getSiteUrl } from '@/lib/utils/url';
import { getKanbanScope, isPersonalBoard, isOrganizationBoard, canManageTasks, canEditTask } from '@/lib/utils/kanbanScope';
import { Profile } from '@/types';

describe('format.ts helpers', () => {
  it('formatDate formats ISO dates to MMM dd, yyyy', () => {
    const formatted = formatDate('2026-07-23T10:30:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Jul');
  });

  it('formatDateTime formats ISO dates to date and time', () => {
    const formatted = formatDateTime('2026-07-23T14:30:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/AM|PM/i);
  });

  it('formatTime formats time string correctly', () => {
    const formatted = formatTime('2026-07-23T14:30:00Z');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('formatHours converts decimal hours into hours and minutes string', () => {
    expect(formatHours(0)).toBe('0h 0m');
    expect(formatHours(1.5)).toBe('1h 30m');
    expect(formatHours(8)).toBe('8h 0m');
    expect(formatHours(7.25)).toBe('7h 15m');
  });

  it('formatFileSize formats byte amounts into readable units', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1500)).toBe('1.5 KB');
    expect(formatFileSize(2000000)).toBe('1.9 MB');
  });
});

describe('url.ts getSiteUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('prioritizes NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://custom-domain.com/';
    expect(getSiteUrl()).toBe('https://custom-domain.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL when defined', () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'nexus-ojt.vercel.app';
    expect(getSiteUrl()).toBe('https://nexus-ojt.vercel.app');
  });

  it('falls back to localhost:3000 by default', () => {
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});

describe('kanbanScope.ts helpers', () => {
  const personalProfile: Profile = {
    id: 'user-1',
    email: 'user1@example.com',
    full_name: 'Personal User',
    role: 'ojt',
    department: undefined,
    required_hours: 600,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    org_id: undefined,
  };

  const orgAdminProfile: Profile = {
    ...personalProfile,
    id: 'admin-1',
    role: 'admin',
    org_id: 'org-100',
  };

  const orgOjtProfile: Profile = {
    ...personalProfile,
    id: 'ojt-1',
    role: 'ojt',
    org_id: 'org-100',
  };

  it('identifies personal vs organization board scopes', () => {
    expect(getKanbanScope(personalProfile)).toBe('personal');
    expect(isPersonalBoard(personalProfile)).toBe(true);
    expect(isOrganizationBoard(personalProfile)).toBe(false);

    expect(getKanbanScope(orgAdminProfile)).toBe('organization');
    expect(isPersonalBoard(orgAdminProfile)).toBe(false);
    expect(isOrganizationBoard(orgAdminProfile)).toBe(true);
  });

  it('evaluates task management privileges correctly', () => {
    expect(canManageTasks(personalProfile)).toBe(true);
    expect(canManageTasks(orgAdminProfile)).toBe(true);
    expect(canManageTasks(orgOjtProfile)).toBe(false);
  });

  it('evaluates task editing privileges correctly', () => {
    // Creator can edit task on personal board
    expect(canEditTask(personalProfile, 'user-1', false)).toBe(true);
    expect(canEditTask(personalProfile, 'other-user', false)).toBe(false);

    // Admin can edit any task on org board
    expect(canEditTask(orgAdminProfile, 'other-user', false)).toBe(true);

    // Accepted assignee can edit task on org board
    expect(canEditTask(orgOjtProfile, 'creator-id', true)).toBe(true);
    expect(canEditTask(orgOjtProfile, 'creator-id', false)).toBe(false);
  });
});
