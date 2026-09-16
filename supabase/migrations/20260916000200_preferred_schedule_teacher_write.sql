-- Teachers manage preferred schedule rows for enrollments they own.
-- Students retain ownership of their own requested schedule rows.
-- Administrators can manage all rows through the existing admin role helper.

drop policy if exists preferred_teacher_write on public.preferred_schedules;
create policy preferred_teacher_write on public.preferred_schedules
for all to authenticated
using (
  coalesce(public.is_admin(), false)
  or exists (
    select 1
    from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.teacher_id = (select auth.uid())
  )
)
with check (
  coalesce(public.is_admin(), false)
  or exists (
    select 1
    from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.teacher_id = (select auth.uid())
  )
);
