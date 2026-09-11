drop policy if exists preferred_student_delete on public.preferred_schedules;
create policy preferred_student_delete on public.preferred_schedules
for delete to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.student_id = (select auth.uid())
  )
);
