drop policy if exists availability_teacher_insert on public.teacher_availability;
create policy availability_teacher_insert on public.teacher_availability
for insert to authenticated
with check (teacher_id = auth.uid());

drop policy if exists availability_teacher_update on public.teacher_availability;
create policy availability_teacher_update on public.teacher_availability
for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists availability_teacher_delete on public.teacher_availability;
create policy availability_teacher_delete on public.teacher_availability
for delete to authenticated
using (teacher_id = auth.uid());
