create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text not null,
  related_booking_id uuid references public.bookings(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages(sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_created_idx on public.messages(recipient_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.messages enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
  for insert to authenticated with check (sender_id = auth.uid());

drop policy if exists messages_update_recipient on public.messages;
create policy messages_update_recipient on public.messages
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

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
  recipient uuid;
  other_name text;
  message_title text;
  message_body text;
begin
  select name into subject_name from public.subjects where id = new.subject_id;
  select full_name into teacher_name from public.profiles where id = new.teacher_id;
  select full_name into student_name from public.profiles where id = new.student_id;

  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_id, type, title, body, related_booking_id)
    values (
      new.teacher_id,
      'booking',
      'New booking',
      coalesce(student_name, 'A student') || ' booked ' || coalesce(subject_name, 'a lesson'),
      new.id
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    recipient := case when auth.uid() = new.teacher_id then new.student_id else new.teacher_id end;
    other_name := case when recipient = new.student_id then coalesce(teacher_name, 'Your teacher') else coalesce(student_name, 'A student') end;
    message_title := 'Booking updated';
    message_body := other_name || ' changed the booking status to ' || new.status || '.';
    insert into public.notifications(recipient_id, type, title, body, related_booking_id)
    values (recipient, 'booking', message_title, message_body, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_notification_trigger on public.bookings;
create trigger bookings_notification_trigger
after insert or update of status on public.bookings
for each row execute function public.notify_booking_change();

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select full_name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications(recipient_id, type, title, body)
  values (
    new.recipient_id,
    'message',
    coalesce(sender_name, 'New message'),
    left(new.body, 120)
  );
  return new;
end;
$$;

drop trigger if exists messages_notification_trigger on public.messages;
create trigger messages_notification_trigger
after insert on public.messages
for each row execute function public.notify_new_message();

-- Keep all collaborative data in Supabase Realtime.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.availability_slots;
alter publication supabase_realtime add table public.subjects;
alter publication supabase_realtime add table public.profiles;
