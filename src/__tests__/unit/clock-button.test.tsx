import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClockButton from '@/components/attendance/ClockButton';
import { Attendance } from '@/types';

// Mock MUI icons to avoid slow barrel imports
vi.mock('@mui/icons-material', () => ({
  PlayArrow: () => <span data-testid="icon-play">PlayArrow</span>,
  Stop: () => <span data-testid="icon-stop">Stop</span>,
  LocationOn: () => <span data-testid="icon-loc">LocationOn</span>,
  LocationOff: () => <span data-testid="icon-loc-off">LocationOff</span>,
  CheckCircle: () => <span data-testid="icon-check">CheckCircle</span>,
  Warning: () => <span data-testid="icon-warn">Warning</span>,
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  }),
}));

// Mock useAuth
vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', org_id: 'org-1' },
    loading: false,
  }),
}));

// Mock useLocation
vi.mock('@/lib/hooks/useLocation', () => ({
  useLocation: () => ({
    location: { latitude: 14.5, longitude: 121.0, loading: false, error: null },
    getLocation: vi.fn().mockResolvedValue({ latitude: 14.5, longitude: 121.0 }),
  }),
}));

// Mock automation emitter
vi.mock('@/lib/automation/client-emitter', () => ({
  emitClientEvent: vi.fn(),
}));

// Mock server actions
vi.mock('@/actions/attendance', () => ({
  clockIn: vi.fn().mockResolvedValue({ data: { id: 'att-new', clock_in: new Date().toISOString() } }),
  clockOut: vi.fn().mockResolvedValue({ data: { id: 'att-out', clock_out: new Date().toISOString(), total_hours: 4 } }),
}));

describe('ClockButton Component — Multi Clock-In/Out Support', () => {
  it('renders Clock In button when there are no sessions today', () => {
    render(
      <ClockButton
        userId="user-1"
        todayRecords={[]}
        todayRecord={null}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /clock in/i })).toBeInTheDocument();
    expect(screen.queryByText(/You have completed your attendance for today/i)).not.toBeInTheDocument();
  });

  it('renders Clock Out button when currently clocked in (active session)', () => {
    const activeSession: Attendance = {
      id: 'att-1',
      user_id: 'user-1',
      date: '2026-08-18',
      clock_in: '2026-08-18T08:00:00Z',
      clock_out: undefined,
      created_at: '2026-08-18T08:00:00Z',
      updated_at: '2026-08-18T08:00:00Z',
    };

    render(
      <ClockButton
        userId="user-1"
        todayRecords={[activeSession]}
        todayRecord={activeSession}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument();
    expect(screen.getByText(/Currently Clocked In/i)).toBeInTheDocument();
    expect(screen.queryByText(/You have completed your attendance for today/i)).not.toBeInTheDocument();
  });

  it('allows clocking in again after completing a previous session (no blocker alert)', () => {
    const completedSession: Attendance = {
      id: 'att-1',
      user_id: 'user-1',
      date: '2026-08-18',
      clock_in: '2026-08-18T08:00:00Z',
      clock_out: '2026-08-18T12:00:00Z',
      total_hours: 4,
      created_at: '2026-08-18T08:00:00Z',
      updated_at: '2026-08-18T12:00:00Z',
    };

    render(
      <ClockButton
        userId="user-1"
        todayRecords={[completedSession]}
        todayRecord={completedSession}
        onSuccess={vi.fn()}
      />
    );

    // Button is enabled and available to clock in again
    const clockButton = screen.getByRole('button', { name: /clock in again/i });
    expect(clockButton).toBeInTheDocument();
    expect(clockButton).not.toBeDisabled();

    // The blocker message MUST NOT be present
    expect(screen.queryByText(/You have completed your attendance for today\. See you tomorrow!/i)).not.toBeInTheDocument();

    // Displays session #1 in breakdown
    expect(screen.getByText(/Today's Sessions \(1\)/i)).toBeInTheDocument();
  });

  it('displays multiple daily sessions and total hours correctly', () => {
    const session1: Attendance = {
      id: 'att-1',
      user_id: 'user-1',
      date: '2026-08-18',
      clock_in: '2026-08-18T08:00:00Z',
      clock_out: '2026-08-18T12:00:00Z',
      total_hours: 4,
      created_at: '2026-08-18T08:00:00Z',
      updated_at: '2026-08-18T12:00:00Z',
    };

    const session2: Attendance = {
      id: 'att-2',
      user_id: 'user-1',
      date: '2026-08-18',
      clock_in: '2026-08-18T13:00:00Z',
      clock_out: '2026-08-18T17:00:00Z',
      total_hours: 4,
      created_at: '2026-08-18T13:00:00Z',
      updated_at: '2026-08-18T17:00:00Z',
    };

    render(
      <ClockButton
        userId="user-1"
        todayRecords={[session1, session2]}
        todayRecord={session2}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Today's Sessions \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Today:\s*8h 0m/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clock in again/i })).toBeInTheDocument();
  });
});
