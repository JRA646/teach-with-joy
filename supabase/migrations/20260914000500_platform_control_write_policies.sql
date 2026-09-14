-- Make Platform Control Center configuration writable by authorized administrators.
-- Keep all read policies from the foundation migration intact.

alter table public.app_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_roles enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.platform_navigation enable row level security;
alter table public.platform_dashboard_widgets enable row level security;
alter table public.platform_activity_log enable row level security;

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists feature_flags_admin_write on public.feature_flags;
create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists platform_roles_admin_write on public.platform_roles;
create policy platform_roles_admin_write on public.platform_roles
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists platform_permissions_admin_write on public.platform_permissions;
create policy platform_permissions_admin_write on public.platform_permissions
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists platform_role_permissions_admin_write on public.platform_role_permissions;
create policy platform_role_permissions_admin_write on public.platform_role_permissions
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists platform_navigation_admin_write on public.platform_navigation;
create policy platform_navigation_admin_write on public.platform_navigation
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

drop policy if exists platform_dashboard_widgets_admin_write on public.platform_dashboard_widgets;
create policy platform_dashboard_widgets_admin_write on public.platform_dashboard_widgets
  for all to authenticated
  using (coalesce(public.is_admin(), false))
  with check (coalesce(public.is_admin(), false));

-- Allow administrators to review the full platform audit stream.
drop policy if exists platform_activity_log_admin_read on public.platform_activity_log;
create policy platform_activity_log_admin_read on public.platform_activity_log
  for select to authenticated
  using (coalesce(public.is_admin(), false) or actor_id = auth.uid());
