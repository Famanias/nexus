import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import React from 'react';
import { useAttendance } from '@/lib/hooks/useAttendance';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import UsersClient from '@/app/dashboard/admin/users/UsersClient';
import type { Attendance, AttendanceSummary, Profile, KanbanColumn } from '@/types';

// Mock Supabase client
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

// Mock @mui/icons-material explicitly
vi.mock('@mui/icons-material', () => {
  const createIcon = (name: string) => () => <span data-testid={`icon-${name}`}>{name}</span>;
  return {
    Search: createIcon('Search'),
    CheckCircle: createIcon('CheckCircle'),
    Cancel: createIcon('Cancel'),
    Download: createIcon('Download'),
    CalendarMonth: createIcon('CalendarMonth'),
    Clear: createIcon('Clear'),
    ChevronLeft: createIcon('ChevronLeft'),
    ChevronRight: createIcon('ChevronRight'),
    TaskAlt: createIcon('TaskAlt'),
    Archive: createIcon('Archive'),
    FilterList: createIcon('FilterList'),
    Refresh: createIcon('Refresh'),
    Add: createIcon('Add'),
    Edit: createIcon('Edit'),
    Delete: createIcon('Delete'),
    MoreVert: createIcon('MoreVert'),
    Check: createIcon('Check'),
    Close: createIcon('Close'),
    PersonAdd: createIcon('PersonAdd'),
    Send: createIcon('Send'),
    Visibility: createIcon('Visibility'),
    Block: createIcon('Block'),
    CheckCircleOutline: createIcon('CheckCircleOutline'),
    ErrorOutline: createIcon('ErrorOutline'),
    SwapHoriz: createIcon('SwapHoriz'),
    AccessTime: createIcon('AccessTime'),
    CalendarToday: createIcon('CalendarToday'),
    TrendingUp: createIcon('TrendingUp'),
    Task: createIcon('Task'),
    Business: createIcon('Business'),
    ArrowBack: createIcon('ArrowBack'),
    ArrowForward: createIcon('ArrowForward'),
    Warning: createIcon('Warning'),
    DragIndicator: createIcon('DragIndicator'),
    Lock: createIcon('Lock'),
    AttachFile: createIcon('AttachFile'),
    Comment: createIcon('Comment'),
    AssignmentTurnedIn: createIcon('AssignmentTurnedIn'),
    History: createIcon('History'),
    Person: createIcon('Person'),
    MoreHoriz: createIcon('MoreHoriz'),
    ExpandMore: createIcon('ExpandMore'),
    ExpandLess: createIcon('ExpandLess'),
    Settings: createIcon('Settings'),
    Timer: createIcon('Timer'),
    Unarchive: createIcon('Unarchive'),
    Schedule: createIcon('Schedule'),
    FolderZip: createIcon('FolderZip'),
    Info: createIcon('Info'),
    DeleteForever: createIcon('DeleteForever'),
    AutoDelete: createIcon('AutoDelete'),
    RestoreFromTrash: createIcon('RestoreFromTrash'),
    Event: createIcon('Event'),
    PriorityHigh: createIcon('PriorityHigh'),
    Save: createIcon('Save'),
  };
});

// Mock toast & auth context
vi.mock('@/lib/context/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { id: 'user-1', role: 'admin', org_id: 'org-1' },
    organization: { id: 'org-1', name: 'Test Org' },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('Client Data Modules (Server Initial State Trust)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAttendance', () => {
    it('seeds immediately from initial state without mounting network fetch', () => {
      const fakeTodayRecords: Attendance[] = [
        {
          id: 'att-1',
          user_id: 'user-1',
          date: '2026-08-18',
          clock_in: '2026-08-18T08:00:00Z',
          clock_out: null,
          created_at: '2026-08-18T08:00:00Z',
        },
      ];
      const fakeSummary: AttendanceSummary = {
        total_days: 10,
        total_hours: 80,
        required_hours: 600,
        remaining_hours: 520,
        completion_percentage: 13.33,
      };

      const { result } = renderHook(() =>
        useAttendance('user-1', {
          initialTodayRecords: fakeTodayRecords,
          initialSummary: fakeSummary,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.todayRecords).toEqual(fakeTodayRecords);
      expect(result.current.todayRecord).toEqual(fakeTodayRecords[0]);
      expect(result.current.summary).toEqual(fakeSummary);
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('AttendanceTable', () => {
    it('renders initialRecords directly without triggering fetch on mount', () => {
      const initialRecords: (Attendance & { profile?: Profile })[] = [
        {
          id: 'att-1',
          user_id: 'user-1',
          date: '2026-08-18',
          clock_in: '2026-08-18T08:00:00Z',
          clock_out: '2026-08-18T17:00:00Z',
          total_hours: 9,
          created_at: '2026-08-18T08:00:00Z',
          profile: {
            id: 'user-1',
            full_name: 'John Trainee',
            email: 'john@example.com',
            role: 'ojt',
            is_active: true,
          },
        },
      ];

      render(
        <AttendanceTable
          userId="user-1"
          showUser={true}
          initialRecords={initialRecords}
        />
      );

      expect(screen.getByText('John Trainee')).toBeDefined();
      expect(screen.getByText('9h 0m')).toBeDefined();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('KanbanBoard', () => {
    it('renders initialColumns directly without fetching board on mount', () => {
      const initialColumns: KanbanColumn[] = [
        {
          id: 'col-1',
          title: 'To Do',
          color: '#6366f1',
          position: 0,
          created_at: '2026-08-01',
          tasks: [],
        },
        {
          id: 'col-2',
          title: 'Done',
          color: '#22c55e',
          position: 1,
          created_at: '2026-08-01',
          tasks: [],
        },
      ];

      const initialProfile: Profile = {
        id: 'user-1',
        full_name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        is_active: true,
      };

      render(
        <KanbanBoard
          initialColumns={initialColumns}
          initialOjts={[]}
          initialProfile={initialProfile}
        />
      );

      expect(screen.getByText('To Do')).toBeDefined();
      expect(screen.getByText('Done')).toBeDefined();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('UsersClient', () => {
    it('renders initialUsers and initialInvitations without triggering fetchUsers on mount', () => {
      const initialUsers: Profile[] = [
        {
          id: 'user-1',
          full_name: 'Alice OJT',
          email: 'alice@example.com',
          role: 'ojt',
          is_active: true,
          created_at: '2026-08-01T00:00:00Z',
        },
      ];

      render(
        <UsersClient
          initialUsers={initialUsers}
          initialInvitations={[]}
        />
      );

      expect(screen.getByText('Alice OJT')).toBeDefined();
      expect(screen.getByText('alice@example.com')).toBeDefined();
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
