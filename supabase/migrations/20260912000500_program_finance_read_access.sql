drop policy if exists payments_teacher_read on public.enrollment_payments;
create policy payments_teacher_read on public.enrollment_payments
for select to authenticated
using (exists (select 1 from public.enrollments e where e.id = enrollment_payments.enrollment_id and e.teacher_id = auth.uid()));
