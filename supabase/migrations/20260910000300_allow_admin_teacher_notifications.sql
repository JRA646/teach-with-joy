drop policy if exists "admins_can_create_notifications" on public.notifications;
create policy "admins_can_create_notifications"
on public.notifications
for insert to authenticated
with check (public.is_admin());
