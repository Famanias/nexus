// app/dashboard/layout.tsx
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/shared/DashboardShell';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [profileResponse] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
  ]);

  const profile = profileResponse.data;
  const profileError = profileResponse.error;

  if (!profile || profileError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '2.5rem',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', color: '#f87171' }}>Profile Access Required</h2>
          <p style={{ color: '#a3a3a3', lineHeight: '1.6', fontSize: '0.95rem' }}>
            We could not fetch your user profile. This usually happens if the database RLS (Row Level Security) policies block your user from viewing their own profile row.
          </p>
          <div style={{
            backgroundColor: '#111',
            border: '1px solid #222',
            borderRadius: '6px',
            padding: '1rem',
            margin: '1.5rem 0',
            textAlign: 'left',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            color: '#f87171',
            overflowX: 'auto'
          }}>
            {profileError ? JSON.stringify(profileError, null, 2) : 'Profile record not found in database.'}
          </div>
          <p style={{ color: '#a3a3a3', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Please make sure you have applied the latest schema and migrations to your local/remote Supabase instance.
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block',
              backgroundColor: '#3b82f6',
              color: '#fff',
              textDecoration: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.9rem',
              transition: 'background-color 0.2s'
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}