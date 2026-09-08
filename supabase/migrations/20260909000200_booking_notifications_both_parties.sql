create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subject_name text;
  teacher_name text;
  student_name text;
begin
  select name into subject_name from public.subjects where id = new.subject_id;
  select full_name into teacher_name from public.profiles where id = new.teacher_id;
  select full_name into student_name from public.profiles where id = new.student_id;

  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, type, title, body, related_booking_id)
    values
      (new.teacher_id, 'booking', 'New booking', coalesce(student_name, 'A student') || ' booked ' || coalesce(subject_name, 'a lesson'), new.id),
      (new.student_id, 'booking', 'Booking confirmed', 'Your ' || coalesce(subject_name, 'lesson') || ' with ' || coalesce(teacher_name, 'your teacher') || ' is confirmed.', new.id);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.notifications(recipient_id, type, title, body, related_booking_id)
    values
      (new.teacher_id, 'booking', 'Booking updated', 'Booking status changed to ' || new.status || '.', new.id),
      (new.student_id, 'booking', 'Booking updated', 'Your booking status changed to ' || new.status || '.', new.id);
  end if;
  return new;
end;
$$;
