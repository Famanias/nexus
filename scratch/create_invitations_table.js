const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local file to find connection string
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const connectionStringLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_CONNECTION_STRING='));

if (!connectionStringLine) {
  console.error('DATABASE_CONNECTION_STRING not found in .env.local');
  process.exit(1);
}

const connectionString = connectionStringLine.split('=')[1].trim();

const sql = `
-- Drop table if exists if we need a clean start (we don't want to lose data, but for setup we'll do if not exists)
create table if not exists public.invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'ojt',
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for single pending invitation per email per organization
drop index if exists public.unique_pending_invitation;
create unique index unique_pending_invitation on public.invitations (email, organization_id) where (status = 'pending');

-- Enable RLS
alter table public.invitations enable row level security;

-- RLS policies:
-- Admins can view invitations in their organization
drop policy if exists "Admins can view invitations in their organization" on public.invitations;
create policy "Admins can view invitations in their organization" on public.invitations
  for select using (
    organization_id = get_my_org_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can create invitations in their organization
drop policy if exists "Admins can create invitations in their organization" on public.invitations;
create policy "Admins can create invitations in their organization" on public.invitations
  for insert with check (
    organization_id = get_my_org_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can update/revoke invitations in their organization
drop policy if exists "Admins can update invitations in their organization" on public.invitations;
create policy "Admins can update invitations in their organization" on public.invitations
  for update using (
    organization_id = get_my_org_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-update updated_at helper for invitations table if needed (invitations don't have updated_at in description, but let's keep it simple)
`;

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase DB.');
    await client.query(sql);
    console.log('Successfully created invitations table and set up RLS!');
  } catch (err) {
    console.error('Error running SQL:', err);
  } finally {
    await client.end();
  }
}

main();
