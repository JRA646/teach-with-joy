-- Dynamic platform foundation: configuration, feature flags, RBAC, navigation, widgets, and activity.
-- These tables are intentionally generic so future modules can be configured without schema rewrites.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.platform_roles (
  key text primary key,
  label text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_permissions (
  key text primary key,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_role_permissions (
  role_key text not null references public.platform_roles(key) on delete cascade,
  permission_key text not null references public.platform_permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table if not exists public.platform_navigation (
  id uuid primary key default gen_random_uuid(),
  role_key text not null references public.platform_roles(key) on delete cascade,
  item_key text not null,
  label text not null,
  path text not null,
  icon text,
  section text,
  sort_order integer not null default 0,
  permission_key text references public.platform_permissions(key),
  feature_flag_key text references public.feature_flags(key),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique (role_key, item_key)
);

create table if not exists public.platform_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  role_key text not null references public.platform_roles(key) on delete cascade,
  widget_key text not null,
  title text not null,
  component text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  permission_key text references public.platform_permissions(key),
  feature_flag_key text references public.feature_flags(key),
  unique (role_key, widget_key)
);

create table if not exists public.platform_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_navigation_role_order_idx on public.platform_navigation(role_key, enabled, sort_order);
create index if not exists platform_dashboard_widgets_role_order_idx on public.platform_dashboard_widgets(role_key, enabled, sort_order);
create index if not exists platform_activity_log_actor_created_idx on public.platform_activity_log(actor_id, created_at desc);
create index if not exists platform_activity_log_entity_idx on public.platform_activity_log(entity_type, entity_id, created_at desc);

insert into public.platform_roles(key, label, description, is_system) values
  ('admin', 'Administrator', 'Full platform administration', true),
  ('teacher', 'Teacher', 'Teaching workspace access', true),
  ('student', 'Student', 'Student learning workspace access', true)
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.platform_permissions(key, label, description) values
  ('dashboard.view', 'View dashboard', 'Access role dashboard'),
  ('students.view', 'View students', 'View student records'),
  ('students.manage', 'Manage students', 'Create and manage students'),
  ('programs.view', 'View programs', 'View program and enrollment data'),
  ('programs.manage', 'Manage programs', 'Create and manage programs'),
  ('schedule.view', 'View schedule', 'View schedules'),
  ('schedule.manage', 'Manage schedule', 'Create and modify schedules'),
  ('attendance.view', 'View attendance', 'View attendance records'),
  ('attendance.record', 'Record attendance', 'Record lesson attendance'),
  ('messages.view', 'View messages', 'Access messaging'),
  ('subjects.view', 'View subjects', 'Access subjects'),
  ('profile.view', 'View profile', 'Access own profile'),
  ('admin.manage', 'Manage platform', 'Manage platform configuration')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.platform_role_permissions(role_key, permission_key)
select 'admin', key from public.platform_permissions
on conflict do nothing;

insert into public.platform_role_permissions(role_key, permission_key) values
  ('teacher', 'dashboard.view'), ('teacher', 'students.view'), ('teacher', 'students.manage'),
  ('teacher', 'programs.view'), ('teacher', 'programs.manage'), ('teacher', 'schedule.view'),
  ('teacher', 'schedule.manage'), ('teacher', 'attendance.view'), ('teacher', 'attendance.record'),
  ('teacher', 'messages.view'), ('teacher', 'subjects.view'), ('teacher', 'profile.view'),
  ('student', 'dashboard.view'), ('student', 'programs.view'), ('student', 'schedule.view'),
  ('student', 'messages.view'), ('student', 'profile.view')
on conflict do nothing;

insert into public.feature_flags(key, enabled, description) values
  ('platform.dynamic_navigation', true, 'Use configurable navigation definitions'),
  ('platform.dashboard_widgets', true, 'Enable configurable dashboard widget definitions'),
  ('platform.activity_log', true, 'Enable platform activity logging'),
  ('platform.form_builder', false, 'Reserved for Phase 2 form builder'),
  ('platform.workflow_engine', false, 'Reserved for Phase 3 workflow automation')
on conflict (key) do update set description = excluded.description;

insert into public.app_settings(key, value, is_public, description) values
  ('platform', '{"name":"TeachWithJoy","version":1,"default_timezone":"Asia/Manila"}'::jsonb, true, 'Core platform configuration'),
  ('session', '{"allowed_statuses":["scheduled","confirmed","in_progress","completed","cancelled","postponed","teacher_absent","student_absent","teacher_cancelled","student_cancelled","rescheduled","no_show","holiday","technical_issue"]}'::jsonb, false, 'Session lifecycle configuration')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_navigation enable row level security;
alter table public.platform_dashboard_widgets enable row level security;
alter table public.platform_activity_log enable row level security;

-- Public/read policies are deliberately limited to non-sensitive configuration.
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select using (is_public = true);

drop policy if exists feature_flags_authenticated_read on public.feature_flags;
create policy feature_flags_authenticated_read on public.feature_flags for select to authenticated using (true);

drop policy if exists platform_navigation_authenticated_read on public.platform_navigation;
create policy platform_navigation_authenticated_read on public.platform_navigation for select to authenticated using (enabled = true);

drop policy if exists platform_dashboard_widgets_authenticated_read on public.platform_dashboard_widgets;
create policy platform_dashboard_widgets_authenticated_read on public.platform_dashboard_widgets for select to authenticated using (enabled = true);

-- Role/permission tables are safe to read because they contain capability metadata, not user data.
drop policy if exists platform_roles_authenticated_read on public.platform_roles;
create policy platform_roles_authenticated_read on public.platform_roles for select to authenticated using (true);

drop policy if exists platform_permissions_authenticated_read on public.platform_permissions;
create policy platform_permissions_authenticated_read on public.platform_permissions for select to authenticated using (true);

drop policy if exists platform_role_permissions_authenticated_read on public.platform_role_permissions;
create policy platform_role_permissions_authenticated_read on public.platform_role_permissions for select to authenticated using (true);

-- Activity logs are private to the actor by default; privileged server-side processes can extend this later.
drop policy if exists platform_activity_log_actor_read on public.platform_activity_log;
create policy platform_activity_log_actor_read on public.platform_activity_log for select to authenticated using (actor_id = auth.uid());

drop policy if exists platform_activity_log_actor_insert on public.platform_activity_log;
create policy platform_activity_log_actor_insert on public.platform_activity_log for insert to authenticated with check (actor_id = auth.uid());
