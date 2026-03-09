-- ============================================================
-- OJT Tracker System - Supabase Schema (Multi-Organization)
-- Idempotent: safe to run on a fresh OR existing database
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS (safe even if they already exist)
-- ============================================================
do $$ begin
  create type user_role as enum ('ojt', 'supervisor', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type attendance_status as enum ('clocked_in', 'clocked_out');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- ORGANIZATIONS TABLE
-- ============================================================
create table if not exists organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  invite_code text unique not null,
  created_by  uuid,   -- FK to profiles added after profiles table is created
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  email          text not null unique,
  role           user_role not null default 'ojt',
  org_id         uuid references organizations(id) on delete set null,
  avatar_url     text,
  department     text,
  required_hours numeric(6,2) not null default 600,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Add org_id column to profiles if upgrading from single-org schema
alter table profiles add column if not exists org_id uuid references organizations(id) on delete set null;

-- Add FK from organizations back to profiles (deferred to avoid circular dependency)
do $$ begin
  alter table organizations
    add constraint fk_organizations_created_by
    foreign key (created_by) references profiles(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- HELPER FUNCTION FOR RLS (returns current user's org_id)
-- ============================================================
create or replace function get_my_org_id()
returns uuid as $$
  select org_id from profiles where id = auth.uid()
$$ language sql security definer stable;

-- ============================================================
-- SITE SETTINGS TABLE
-- ============================================================
create table if not exists site_settings (
  id                   uuid primary key default uuid_generate_v4(),
  org_id               uuid not null unique references organizations(id) on delete cascade,
  site_name            text not null default 'OJT Training Site',
  latitude             numeric(10,7) not null default 14.5995,
  longitude            numeric(10,7) not null default 120.9842,
  radius_meters        integer not null default 150,
  address              text,
  timezone             text not null default 'UTC',
  archive_retention_days integer not null default 7,
  updated_by           uuid references profiles(id),
  updated_at           timestamptz not null default now()
);

-- Add org_id column to site_settings if upgrading from single-org schema
alter table site_settings add column if not exists org_id uuid unique references organizations(id) on delete cascade;

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  clock_in timestamptz,
  clock_out timestamptz,
  clock_in_latitude numeric(10,7),
  clock_in_longitude numeric(10,7),
  clock_out_latitude numeric(10,7),
  clock_out_longitude numeric(10,7),
  clock_in_distance_meters numeric(8,2),
  clock_out_distance_meters numeric(8,2),
  total_hours numeric(6,4),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add org_id column to attendance if upgrading from single-org schema
alter table attendance add column if not exists org_id uuid references organizations(id) on delete cascade;

-- ============================================================
-- KANBAN COLUMNS TABLE
-- ============================================================
create table if not exists kanban_columns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  title text not null,
  color text default '#6366f1',
  position integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add org_id column to kanban_columns if upgrading from single-org schema
alter table kanban_columns add column if not exists org_id uuid references organizations(id) on delete cascade;

-- Default columns are now created per-organization via the /api/organizations route when a new org is created

-- ============================================================
-- KANBAN TASKS TABLE
-- ============================================================
create table if not exists kanban_tasks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  column_id uuid not null references kanban_columns(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references profiles(id),      -- who created/assigned the task (supervisor/admin)
  position integer not null default 0,
  due_date date,
  priority text default 'medium',                -- low, medium, high
  archived_at timestamptz,
  archived_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add org_id column to kanban_tasks if upgrading from single-org schema
alter table kanban_tasks add column if not exists org_id uuid references organizations(id) on delete cascade;

-- ============================================================
-- TASK ASSIGNEES (OJTs assigned to a task)
-- ============================================================
create table if not exists task_assignees (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references kanban_tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  status text not null default 'pending',   -- pending | accepted | rejected
  unique(task_id, user_id)
);

-- Add status column to task_assignees if upgrading from single-org schema
alter table task_assignees add column if not exists status text not null default 'pending';

-- ============================================================
-- TASK ATTACHMENTS
-- ============================================================
create table if not exists task_attachments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references kanban_tasks(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,   -- image, video, document
  file_size bigint,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table site_settings enable row level security;
alter table attendance enable row level security;
alter table kanban_columns enable row level security;
alter table kanban_tasks enable row level security;
alter table task_assignees enable row level security;
alter table task_attachments enable row level security;

-- Organizations policies
drop policy if exists "Users can view their own organization" on organizations;
create policy "Users can view their own organization" on organizations
  for select using (id = get_my_org_id());
drop policy if exists "Admins can update their organization" on organizations;
create policy "Admins can update their organization" on organizations
  for update using (
    id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Profiles policies
drop policy if exists "Users can view all profiles" on profiles;
drop policy if exists "Users can view profiles in same org" on profiles;
create policy "Users can view profiles in same org" on profiles
  for select using (org_id = get_my_org_id());
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
drop policy if exists "Admins can insert profiles" on profiles;
drop policy if exists "Admins can insert profiles in their org" on profiles;
create policy "Admins can insert profiles in their org" on profiles
  for insert with check (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Admins can update any profile" on profiles;
drop policy if exists "Admins can update any profile in org" on profiles;
create policy "Admins can update any profile in org" on profiles
  for update using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Admins can delete profiles" on profiles;
drop policy if exists "Admins can delete profiles in org" on profiles;
create policy "Admins can delete profiles in org" on profiles
  for delete using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Site settings policies
drop policy if exists "Anyone authenticated can view site settings" on site_settings;
drop policy if exists "Org members can view site settings" on site_settings;
create policy "Org members can view site settings" on site_settings
  for select using (org_id = get_my_org_id());
drop policy if exists "Admins can update site settings" on site_settings;
create policy "Admins can update site settings" on site_settings
  for update using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
drop policy if exists "Admins can insert site settings" on site_settings;
create policy "Admins can insert site settings" on site_settings
  for insert with check (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Attendance policies
drop policy if exists "Users can view own attendance" on attendance;
create policy "Users can view own attendance" on attendance
  for select using (auth.uid() = user_id);
drop policy if exists "Supervisors/Admins can view all attendance" on attendance;
drop policy if exists "Supervisors and admins can view org attendance" on attendance;
create policy "Supervisors and admins can view org attendance" on attendance
  for select using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor', 'admin'))
  );
drop policy if exists "Users can insert own attendance" on attendance;
create policy "Users can insert own attendance" on attendance
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own attendance" on attendance;
create policy "Users can update own attendance" on attendance
  for update using (auth.uid() = user_id);
drop policy if exists "Admins can update any attendance" on attendance;
drop policy if exists "Admins can update any org attendance" on attendance;
create policy "Admins can update any org attendance" on attendance
  for update using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Kanban columns policies
drop policy if exists "All authenticated can view columns" on kanban_columns;
drop policy if exists "Org members can view kanban columns" on kanban_columns;
create policy "Org members can view kanban columns" on kanban_columns
  for select using (org_id = get_my_org_id());
drop policy if exists "Supervisors/Admins can manage columns" on kanban_columns;
drop policy if exists "Supervisors and admins can manage kanban columns" on kanban_columns;
create policy "Supervisors and admins can manage kanban columns" on kanban_columns
  for all using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor', 'admin'))
  );

-- Kanban tasks policies
drop policy if exists "All authenticated can view tasks" on kanban_tasks;
drop policy if exists "Org members can view kanban tasks" on kanban_tasks;
create policy "Org members can view kanban tasks" on kanban_tasks
  for select using (org_id = get_my_org_id());
drop policy if exists "Supervisors/Admins can manage tasks" on kanban_tasks;
drop policy if exists "Supervisors and admins can manage kanban tasks" on kanban_tasks;
create policy "Supervisors and admins can manage kanban tasks" on kanban_tasks
  for all using (
    org_id = get_my_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role in ('supervisor', 'admin'))
  );
drop policy if exists "OJTs can insert own tasks" on kanban_tasks;
create policy "OJTs can insert own tasks" on kanban_tasks
  for insert with check (auth.uid() = assignee_id);
drop policy if exists "OJTs can update own tasks" on kanban_tasks;
create policy "OJTs can update own tasks" on kanban_tasks
  for update using (auth.uid() = assignee_id);
drop policy if exists "OJTs can delete own tasks" on kanban_tasks;
create policy "OJTs can delete own tasks" on kanban_tasks
  for delete using (auth.uid() = assignee_id);

-- Task assignees policies
drop policy if exists "All authenticated can view task assignees" on task_assignees;
drop policy if exists "Org members can view task assignees" on task_assignees;
create policy "Org members can view task assignees" on task_assignees
  for select using (
    exists (select 1 from kanban_tasks where id = task_id and org_id = get_my_org_id())
  );
drop policy if exists "Supervisors/Admins can manage task assignees" on task_assignees;
drop policy if exists "Supervisors and admins can manage task assignees" on task_assignees;
create policy "Supervisors and admins can manage task assignees" on task_assignees
  for all using (
    exists (
      select 1 from kanban_tasks kt
      join profiles p on p.id = auth.uid()
      where kt.id = task_id
        and kt.org_id = get_my_org_id()
        and p.role in ('supervisor', 'admin')
    )
  );
drop policy if exists "OJTs can insert assignees for own tasks" on task_assignees;
create policy "OJTs can insert assignees for own tasks" on task_assignees
  for insert with check (
    exists (select 1 from kanban_tasks where id = task_id and assignee_id = auth.uid())
  );
drop policy if exists "OJTs can update own assignment status" on task_assignees;
create policy "OJTs can update own assignment status" on task_assignees
  for update using (auth.uid() = user_id);
drop policy if exists "OJTs can delete assignees for own tasks" on task_assignees;
drop policy if exists "OJTs can delete assignees from own tasks" on task_assignees;
create policy "OJTs can delete assignees from own tasks" on task_assignees
  for delete using (
    exists (select 1 from kanban_tasks where id = task_id and assignee_id = auth.uid())
  );

-- Task attachments policies
drop policy if exists "All authenticated can view attachments" on task_attachments;
drop policy if exists "Org members can view task attachments" on task_attachments;
create policy "Org members can view task attachments" on task_attachments
  for select using (
    exists (select 1 from kanban_tasks where id = task_id and org_id = get_my_org_id())
  );
drop policy if exists "Supervisors/Admins can manage attachments" on task_attachments;
drop policy if exists "Supervisors and admins can manage task attachments" on task_attachments;
create policy "Supervisors and admins can manage task attachments" on task_attachments
  for all using (
    exists (
      select 1 from kanban_tasks kt
      join profiles p on p.id = auth.uid()
      where kt.id = task_id
        and kt.org_id = get_my_org_id()
        and p.role in ('supervisor', 'admin')
    )
  );
drop policy if exists "OJTs can insert attachments for own tasks" on task_attachments;
drop policy if exists "OJTs can upload attachments to own tasks" on task_attachments;
create policy "OJTs can upload attachments to own tasks" on task_attachments
  for insert with check (
    exists (select 1 from kanban_tasks where id = task_id and assignee_id = auth.uid())
  );
drop policy if exists "OJTs can delete attachments for own tasks" on task_attachments;
drop policy if exists "OJTs can delete attachments from own tasks" on task_attachments;
create policy "OJTs can delete attachments from own tasks" on task_attachments
  for delete using (
    exists (select 1 from kanban_tasks where id = task_id and assignee_id = auth.uid())
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles for each row execute function update_updated_at();
drop trigger if exists trg_attendance_updated_at on attendance;
create trigger trg_attendance_updated_at before update on attendance for each row execute function update_updated_at();
drop trigger if exists trg_kanban_columns_updated_at on kanban_columns;
create trigger trg_kanban_columns_updated_at before update on kanban_columns for each row execute function update_updated_at();
drop trigger if exists trg_kanban_tasks_updated_at on kanban_tasks;
create trigger trg_kanban_tasks_updated_at before update on kanban_tasks for each row execute function update_updated_at();
drop trigger if exists trg_site_settings_updated_at on site_settings;
create trigger trg_site_settings_updated_at before update on site_settings for each row execute function update_updated_at();
drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at before update on organizations for each row execute function update_updated_at();

-- Calculate total hours when clocking out
create or replace function calculate_total_hours()
returns trigger as $$
begin
  if new.clock_out is not null and new.clock_in is not null then
    new.total_hours = extract(epoch from (new.clock_out - new.clock_in)) / 3600.0;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_attendance_total_hours on attendance;
create trigger trg_attendance_total_hours before update on attendance for each row execute function calculate_total_hours();

-- Auto-set org_id on attendance rows from the user's profile (so clients don't need to pass it)
create or replace function set_attendance_org_id()
returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from profiles where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_attendance_org_id on attendance;
create trigger trg_attendance_org_id
  before insert on attendance
  for each row execute function set_attendance_org_id();

-- Auto-set org_id on kanban_columns from created_by's profile
create or replace function set_kanban_column_org_id()
returns trigger as $$
begin
  if new.org_id is null and new.created_by is not null then
    select org_id into new.org_id from profiles where id = new.created_by;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kanban_column_org_id on kanban_columns;
create trigger trg_kanban_column_org_id
  before insert on kanban_columns
  for each row execute function set_kanban_column_org_id();

-- Auto-set org_id on kanban_tasks from the column's org
create or replace function set_kanban_task_org_id()
returns trigger as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from kanban_columns where id = new.column_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_kanban_task_org_id on kanban_tasks;
create trigger trg_kanban_task_org_id
  before insert on kanban_tasks
  for each row execute function set_kanban_task_org_id();

-- Auto-create profile on signup (reads role and org_id from user_metadata)
create or replace function handle_new_user()
returns trigger as $$
declare
  v_role     user_role := 'ojt';
  v_role_str text;
  v_org_id   uuid;
  v_org_id_str text;
begin
  v_role_str := new.raw_user_meta_data->>'role';
  if v_role_str in ('ojt', 'supervisor', 'admin') then
    v_role := v_role_str::user_role;
  end if;

  v_org_id_str := new.raw_user_meta_data->>'org_id';
  if v_org_id_str is not null and v_org_id_str != '' then
    begin
      v_org_id := v_org_id_str::uuid;
    exception when others then
      v_org_id := null;
    end;
  end if;

  insert into profiles (id, full_name, email, role, org_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_org_id
  )
  on conflict (id) do update
    set
      full_name  = excluded.full_name,
      email      = excluded.email,
      role       = excluded.role,
      org_id     = coalesce(excluded.org_id, profiles.org_id),
      updated_at = now();

  return new;
exception when others then
  -- Never let a trigger failure block auth user creation
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values ('task-attachments', 'task-attachments', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Storage policies for task-attachments (private, authenticated access)
drop policy if exists "Authenticated users can upload task attachments" on storage.objects;
create policy "Authenticated users can upload task attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments');

drop policy if exists "Authenticated users can view task attachments" on storage.objects;
create policy "Authenticated users can view task attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-attachments');

drop policy if exists "Users can delete their own task attachments" on storage.objects;
create policy "Users can delete their own task attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for avatars (public read, authenticated write)
drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
