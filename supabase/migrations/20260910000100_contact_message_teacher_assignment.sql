alter table public.contact_messages
  add column if not exists assigned_teacher_id uuid references public.profiles(id) on delete set null;

alter table public.contact_messages
  add column if not exists assigned_at timestamptz;

alter table public.contact_messages
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null;

create index if not exists contact_messages_assigned_teacher_idx
  on public.contact_messages(assigned_teacher_id);

drop policy if exists "teachers_can_view_assigned_contact_messages" on public.contact_messages;
create policy "teachers_can_view_assigned_contact_messages"
on public.contact_messages
for select to authenticated
using (assigned_teacher_id = auth.uid());
