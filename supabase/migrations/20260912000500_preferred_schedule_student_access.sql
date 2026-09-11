-- Students own their preferred program schedule requests.
-- Teachers/admins can review them through the enrollment/session workflow.

drop policy if exists preferred_student_insert on public.preferred_schedules;
create policy preferred_student_insert on public.preferred_schedules
for insert to authenticated
with check (
  exists (
    select 1 from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.student_id = (select auth.uid())
      and e.status in ('active','draft')
  )
);

drop policy if exists preferred_student_update on public.preferred_schedules;
create policy preferred_student_update on public.preferred_schedules
for update to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.student_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.student_id = (select auth.uid())
  )
);

drop policy if exists preferred_teacher_read on public.preferred_schedules;
create policy preferred_teacher_read on public.preferred_schedules
for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = preferred_schedules.enrollment_id
      and e.teacher_id = (select auth.uid())
  )
);
