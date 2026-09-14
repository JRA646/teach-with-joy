-- Teach With Joy: scheduler operations.
-- Adds explicit reschedule/cancel/skip/replacement operations and a session timeline.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check check (status in (
  'unassigned','scheduled','confirmed','in_progress','completed',
  'student_absent','teacher_absent','student_cancelled','teacher_cancelled',
  'postponed','holiday','no_show','technical_issue','rescheduled','cancelled'
));

create table if not exists public.session_schedule_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created','rescheduled','cancelled','skipped','replacement_created','confirmed','started','completed')),
  previous_start timestamptz,
  previous_end timestamptz,
  new_start timestamptz,
  new_end timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_session_schedule_events_session on public.session_schedule_events(session_id, created_at desc);

alter table public.session_schedule_events enable row level security;
drop policy if exists session_schedule_events_admin_all on public.session_schedule_events;
create policy session_schedule_events_admin_all on public.session_schedule_events for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists session_schedule_events_participant_read on public.session_schedule_events;
create policy session_schedule_events_participant_read on public.session_schedule_events for select to authenticated
using (exists (select 1 from public.sessions s where s.id=session_id and (s.teacher_id=auth.uid() or s.student_id=auth.uid())));

create or replace function public.reschedule_session(
  p_session_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_reason text default null,
  p_timezone text default 'Asia/Manila'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v public.sessions%rowtype;
  v_check jsonb;
begin
  select * into v from public.sessions where id=p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_new_start is null or p_new_end is null or p_new_end <= p_new_start then raise exception 'Invalid replacement time'; end if;

  v_check := public.check_schedule_slot(v.teacher_id,v.student_id,p_new_start,p_new_end,p_timezone);
  if coalesce((v_check->>'available')::boolean,false)=false then
    raise exception 'Schedule slot unavailable: %', coalesce(v_check->>'reasons','[]');
  end if;

  update public.sessions
  set scheduled_start=p_new_start, scheduled_end=p_new_end, status='rescheduled', updated_at=now()
  where id=p_session_id;

  insert into public.session_schedule_events(session_id,actor_id,action,previous_start,previous_end,new_start,new_end,reason)
  values(p_session_id,auth.uid(),'rescheduled',v.scheduled_start,v.scheduled_end,p_new_start,p_new_end,p_reason);

  return jsonb_build_object('session_id',p_session_id,'status','rescheduled','scheduled_start',p_new_start,'scheduled_end',p_new_end);
end;
$$;

grant execute on function public.reschedule_session(uuid,timestamptz,timestamptz,text,text) to authenticated;

create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason text default null,
  p_create_replacement boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v public.sessions%rowtype;
  v_replacement uuid;
begin
  select * into v from public.sessions where id=p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;

  update public.sessions set status='cancelled', counts_as_session=not p_create_replacement, updated_at=now() where id=p_session_id;

  insert into public.session_schedule_events(session_id,actor_id,action,previous_start,previous_end,reason,metadata)
  values(p_session_id,auth.uid(),'cancelled',v.scheduled_start,v.scheduled_end,p_reason,jsonb_build_object('replacement_requested',p_create_replacement));

  if p_create_replacement then
    insert into public.sessions(enrollment_id,session_number,student_id,teacher_id,status,counts_as_session,makeup_for,meeting_provider,meeting_url,notes)
    values(v.enrollment_id,(select coalesce(max(s2.session_number),0)+1 from public.sessions s2 where s2.enrollment_id=v.enrollment_id),v.student_id,v.teacher_id,'unassigned',false,p_session_id,v.meeting_provider,v.meeting_url,'Replacement for cancelled session')
    returning id into v_replacement;

    insert into public.session_schedule_events(session_id,actor_id,action,reason,metadata)
    values(v_replacement,auth.uid(),'replacement_created',p_reason,jsonb_build_object('makeup_for',p_session_id));
  end if;

  return jsonb_build_object('session_id',p_session_id,'status','cancelled','replacement_session_id',v_replacement);
end;
$$;

grant execute on function public.cancel_session(uuid,text,boolean) to authenticated;

create or replace function public.skip_session(
  p_session_id uuid,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.sessions%rowtype;
begin
  select * into v from public.sessions where id=p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.sessions set status='cancelled', counts_as_session=false, updated_at=now() where id=p_session_id;
  insert into public.session_schedule_events(session_id,actor_id,action,previous_start,previous_end,reason)
  values(p_session_id,auth.uid(),'skipped',v.scheduled_start,v.scheduled_end,p_reason);
  return jsonb_build_object('session_id',p_session_id,'status','cancelled','counts_as_session',false);
end;
$$;

grant execute on function public.skip_session(uuid,text) to authenticated;

create or replace function public.create_session_replacement(
  p_session_id uuid,
  p_new_start timestamptz,
  p_new_end timestamptz,
  p_reason text default null,
  p_timezone text default 'Asia/Manila'
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v public.sessions%rowtype;
  v_check jsonb;
  v_id uuid;
  v_number integer;
begin
  select * into v from public.sessions where id=p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not public.is_admin() then raise exception 'Not allowed'; end if;
  v_check := public.check_schedule_slot(v.teacher_id,v.student_id,p_new_start,p_new_end,p_timezone);
  if coalesce((v_check->>'available')::boolean,false)=false then raise exception 'Schedule slot unavailable: %',coalesce(v_check->>'reasons','[]'); end if;
  select coalesce(max(session_number),0)+1 into v_number from public.sessions where enrollment_id=v.enrollment_id;
  insert into public.sessions(enrollment_id,session_number,student_id,teacher_id,scheduled_start,scheduled_end,status,counts_as_session,makeup_for,meeting_provider,meeting_url,notes)
  values(v.enrollment_id,v_number,v.student_id,v.teacher_id,p_new_start,p_new_end,'scheduled',false,p_session_id,v.meeting_provider,v.meeting_url,p_reason)
  returning id into v_id;
  insert into public.session_schedule_events(session_id,actor_id,action,new_start,new_end,reason,metadata)
  values(v_id,auth.uid(),'replacement_created',p_new_start,p_new_end,p_reason,jsonb_build_object('makeup_for',p_session_id));
  return v_id;
end;
$$;

grant execute on function public.create_session_replacement(uuid,timestamptz,timestamptz,text,text) to authenticated;

create or replace view public.session_schedule_timeline as
select e.id, e.session_id, e.actor_id, e.action, e.previous_start, e.previous_end,
       e.new_start, e.new_end, e.reason, e.metadata, e.created_at
from public.session_schedule_events e;
