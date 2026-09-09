alter table public.contact_messages drop constraint if exists contact_messages_assigned_by_fkey;

alter table public.contact_messages
  add constraint contact_messages_assigned_by_fkey
  foreign key (assigned_by)
  references public.admin_users(user_id)
  on delete set null;

create index if not exists contact_messages_assigned_teacher_id_idx
  on public.contact_messages(assigned_teacher_id);

create index if not exists contact_messages_status_idx
  on public.contact_messages(status);
