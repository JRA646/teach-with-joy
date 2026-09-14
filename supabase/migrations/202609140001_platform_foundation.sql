-- TeachWithJoy dynamic platform foundation
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.platform_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role_key text not null,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_key)
);

create table if not exists public.platform_permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  label text not null,
  description text,
  module text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_role_permissions (
  role_id uuid not null references public.platform_roles(id) on delete cascade,
  permission_id uuid not null references public.platform_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.platform_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.platform_roles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id, organization_id)
);

create table if not exists public.platform_navigation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role_key text not null,
  item_key text not null,
  label text not null,
  path text not null,
  icon text,
  section text,
  sort_order integer not null default 0,
  permission_key text,
  feature_flag_key text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_key, item_key)
);

create table if not exists public.platform_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role_key text not null,
  widget_key text not null,
  title text not null,
  component text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  permission_key text,
  feature_flag_key text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, role_key, widget_key)
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  enabled_roles text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  config_type text not null,
  version integer not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (organization_id, config_type, version)
);

create table if not exists public.platform_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default false,
  trigger_type text not null,
  definition jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.platform_workflows(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped')),
  trigger_payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_notification_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_key text not null,
  channel text not null check (channel in ('in_app','email','push','sms')),
  subject text,
  body text not null,
  enabled boolean not null default true,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_key, channel)
);

create table if not exists public.platform_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','push','sms')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id, channel)
);

create table if not exists public.platform_search_index (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  subtitle text,
  search_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, entity_id)
);

create index if not exists platform_activity_log_actor_idx on public.platform_activity_log(actor_id, created_at desc);
create index if not exists platform_activity_log_entity_idx on public.platform_activity_log(entity_type, entity_id, created_at desc);
create index if not exists platform_navigation_role_idx on public.platform_navigation(organization_id, role_key, enabled, sort_order);
create index if not exists platform_widgets_role_idx on public.platform_dashboard_widgets(organization_id, role_key, enabled, sort_order);
create index if not exists platform_search_idx on public.platform_search_index using gin (to_tsvector('simple', search_text));

insert into public.platform_permissions(permission_key,label,module) values
('dashboard.view','View dashboard','dashboard'),('students.view','View students','students'),('students.manage','Manage students','students'),
('programs.view','View programs','programs'),('programs.manage','Manage programs','programs'),('schedule.view','View schedule','schedule'),
('schedule.manage','Manage schedule','schedule'),('attendance.view','View attendance','attendance'),('attendance.record','Record attendance','attendance'),
('messages.view','View messages','messages'),('subjects.view','View subjects','subjects'),('profile.view','View profile','profile'),('admin.manage','Manage platform','admin'),
('reports.view','View reports','reports'),('notifications.manage','Manage notifications','notifications'),('workflows.manage','Manage workflows','automation')
on conflict (permission_key) do nothing;

insert into public.feature_flags(key,enabled,description) values
('platform.dynamic_navigation',true,'Use database-backed role navigation'),('platform.dashboard_widgets',true,'Use database-backed dashboard widgets'),
('platform.activity_log',true,'Record platform audit activity'),('platform.form_builder',false,'Enable dynamic forms'),('platform.workflow_engine',false,'Enable workflow automation'),
('platform.organizations',false,'Enable organization-aware platform mode'),('platform.global_search',true,'Enable global search'),('platform.notifications',true,'Enable platform notification preferences')
on conflict (key) do nothing;

-- Security helper: application admins remain governed by the existing profiles.role model.
create or replace function public.is_platform_admin()
returns boolean language sql security definer set search_path = public
as $$ select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'); $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_user_roles enable row level security;
alter table public.platform_navigation enable row level security;
alter table public.platform_dashboard_widgets enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_activity_log enable row level security;
alter table public.platform_configuration_versions enable row level security;
alter table public.platform_workflows enable row level security;
alter table public.platform_workflow_runs enable row level security;
alter table public.platform_notification_templates enable row level security;
alter table public.platform_notification_preferences enable row level security;
alter table public.platform_search_index enable row level security;

-- Re-runnable policies for the platform admin surface.
do $$ declare t text; begin
  foreach t in array array['organizations','organization_members','platform_roles','platform_permissions','platform_role_permissions','platform_user_roles','platform_navigation','platform_dashboard_widgets','feature_flags','platform_activity_log','platform_configuration_versions','platform_workflows','platform_workflow_runs','platform_notification_templates','platform_notification_preferences','platform_search_index'] loop
    execute format('drop policy if exists platform_admin_all on public.%I', t);
    execute format('create policy platform_admin_all on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())', t);
  end loop;
end $$;

-- Users can always see their own notification preferences.
drop policy if exists platform_notification_preferences_self on public.platform_notification_preferences;
create policy platform_notification_preferences_self on public.platform_notification_preferences for select to authenticated using (user_id = auth.uid());

-- Users can read their own role assignments.
drop policy if exists platform_user_roles_self on public.platform_user_roles;
create policy platform_user_roles_self on public.platform_user_roles for select to authenticated using (user_id = auth.uid());
