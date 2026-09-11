-- Teachers may create enrollments only when they are the assigned teacher.
-- Admins retain full access through enrollments_admin_all.
drop policy if exists enrollments_teacher_insert on public.enrollments;
create policy enrollments_teacher_insert on public.enrollments
for insert to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  )
);
