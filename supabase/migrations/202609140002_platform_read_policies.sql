-- Runtime configuration must be readable by authenticated users; writes remain admin-only.
drop policy if exists platform_config_read on public.platform_navigation;
create policy platform_config_read on public.platform_navigation for select to authenticated using (enabled = true);

drop policy if exists platform_widgets_read on public.platform_dashboard_widgets;
create policy platform_widgets_read on public.platform_dashboard_widgets for select to authenticated using (enabled = true);

drop policy if exists platform_flags_read on public.feature_flags;
create policy platform_flags_read on public.feature_flags for select to authenticated using (true);

drop policy if exists platform_roles_read on public.platform_roles;
create policy platform_roles_read on public.platform_roles for select to authenticated using (true);

drop policy if exists platform_permissions_read on public.platform_permissions;
create policy platform_permissions_read on public.platform_permissions for select to authenticated using (true);

drop policy if exists platform_role_permissions_read on public.platform_role_permissions;
create policy platform_role_permissions_read on public.platform_role_permissions for select to authenticated using (true);
