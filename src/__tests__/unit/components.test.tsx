import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatCard from '@/components/shared/StatCard';
import RequireOrganization from '@/components/shared/RequireOrganization';
import { Profile } from '@/types';

// Mock next/navigation router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock AuthContext & MUI Icons barrel imports
vi.mock('@mui/icons-material', () => ({
  Business: function DummyBusinessIcon() { return <span data-testid="icon-Business">Business</span>; },
  ArrowBack: function DummyArrowBackIcon() { return <span data-testid="icon-ArrowBack">ArrowBack</span>; },
}));

vi.mock('@/lib/context/AuthContext', () => ({
  useAuth: () => ({
    profile: null,
    loading: false,
  }),
}));

describe('StatCard Component', () => {
  it('renders title, value, and subtitle correctly', () => {
    render(
      <StatCard
        title="Total Active Trainees"
        value={42}
        subtitle="100% On-Track"
        icon={<span data-testid="stat-icon">Icon</span>}
      />
    );

    expect(screen.getByText('Total Active Trainees')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('100% On-Track')).toBeInTheDocument();
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });
});

describe('RequireOrganization Guard Component', () => {
  const orgProfile: Profile = {
    id: 'user-10',
    email: 'org@example.com',
    full_name: 'Org Member',
    role: 'ojt',
    department: 'Engineering',
    required_hours: 600,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    org_id: 'org-456',
  };

  const personalProfile: Profile = {
    ...orgProfile,
    id: 'user-11',
    org_id: undefined,
  };

  it('renders children when user profile has an org_id', () => {
    render(
      <RequireOrganization featureName="Kanban Board" serverProfile={orgProfile}>
        <div data-testid="protected-content">Protected Content</div>
      </RequireOrganization>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders OrgRequiredPlaceholder when profile lacks an org_id', () => {
    render(
      <RequireOrganization featureName="Kanban Board" serverProfile={personalProfile}>
        <div data-testid="protected-content">Protected Content</div>
      </RequireOrganization>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText(/Organization Required/i)).toBeInTheDocument();
  });
});
