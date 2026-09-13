-- Teach With Joy: Phase 1-2 scheduling foundation.
-- Adds student availability, dated exceptions, centralized conflict validation,
-- scheduling audit events, and safe recurring-series generation while preserving
-- the existing proposal/session RPC contract.

create table if not exists public.student_availability (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Manila',
  active boolean not null default true,
  unique(student_id, day_of_week, start_time, end_time),
  check (end_time > start_time)
);

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  exception_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default true,
  reason text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((teacher_id is not null) <> (student_id is not null)),
  check ((all_day = true) or (start_time is not null and end_time is not null and end_time > start_time))
);

create table if not exists public.scheduling_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.student_availability enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.scheduling_audit_log enable row level security;

drop policy if exists student_availability_admin_all on public.student_availability;
create policy student_availability_admin_all on public.student_availability for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists student_availability_student_all on public.student_availability;
create policy student_availability_student_all on public.student_availability for all to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());

drop policy if exists availability_exceptions_admin_all on public.availability_exceptions;
create policy availability_exceptions_admin_all on public.availability_exceptions for all using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists availability_exceptions_teacher_all on public.availability_exceptions;
create policy availability_exceptions_teacher_all on public.availability_exceptions for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
drop policy if exists availability_exceptions_student_all on public.availability_exceptions;
create policy availability_exceptions_student_all on public.availability_exceptions for all to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());

drop policy if exists scheduling_audit_admin_read on public.scheduling_audit_log;
create policy scheduling_audit_admin_read on public.scheduling_audit_log for select using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists scheduling_audit_participant_read on public.scheduling_audit_log;
create policy scheduling_audit_participant_read on public.scheduling_audit_log for select using (
  exists (select 1 from public.enrollments e where e.id=scheduling_audit_log.entity_id and (e.teacher_id=auth.uid() or e.student_id=auth.uid()))
  or exists (select 1 from public.sessions s where s.id=scheduling_audit_log.entity_id and (s.teacher_id=auth.uid() or s.student_id=auth.uid()))
  or exists (select 1 from public.teacher_proposals p where p.id=scheduling_audit_log.entity_id and (p.teacher_id=auth.uid() or p.student_id=auth.uid()))
  or exists (select 1 from public.recurring_lesson_series r where r.id=scheduling_audit_log.entity_id and (r.teacher_id=auth.uid() or r.student_id=auth.uid()))
);

create index if not exists idx_student_availability_student_day on public.student_availability(student_id, day_of_week, active);
create index if not exists idx_availability_exceptions_teacher_date on public.availability_exceptions(teacher_id, exception_date, active);
create index if not exists idx_availability_exceptions_student_date on public.availability_exceptions(student_id, exception_date, active);
create index if not exists idx_scheduling_audit_entity on public.scheduling_audit_log(entity_type, entity_id, created_at desc);

-- Centralized scheduling decision engine. All booking paths should use this function.
create or replace function public.check_schedule_slot(
  p_teacher_id uuid,
  p_student_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default 'Asia/Manila'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_date date;
  v_dow integer;
  v_start_time time;
  v_end_time time;
  v_teacher_has_availability boolean;
  v_student_has_availability boolean;
  v_teacher_available boolean;
  v_student_available boolean;
  v_conflict boolean;
  v_exception boolean;
  v_holiday boolean;
  v_reasons jsonb := '[]'::jsonb;
begin
  if p_teacher_id is null or p_student_id is null then
    return jsonb_build_object('status','INVALID','available',false,'reasons',jsonb_build_array('Teacher and student are required'));
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    return jsonb_build_object('status','INVALID','available',false,'reasons',jsonb_build_array('End time must be later than start time'));
  end if;

  v_date := (p_start at time zone p_timezone)::date;
  v_dow := extract(dow from (p_start at time zone p_timezone))::integer;
  v_start_time := (p_start at time zone p_timezone)::time;
  v_end_time := (p_end at time zone p_timezone)::time;

  select exists(select 1 from public.teacher_availability a where a.teacher_id=p_teacher_id and a.active=true) into v_teacher_has_availability;
  select exists(select 1 from public.student_availability a where a.student_id=p_student_id and a.active=true) into v_student_has_availability;

  v_teacher_available := not v_teacher_has_availability or exists(
    select 1 from public.teacher_availability a
    where a.teacher_id=p_teacher_id and a.active=true and a.day_of_week=v_dow
      and a.start_time <= v_start_time and a.end_time >= v_end_time
  );
  v_student_available := not v_student_has_availability or exists(
    select 1 from public.student_availability a
    where a.student_id=p_student_id and a.active=true and a.day_of_week=v_dow
      and a.start_time <= v_start_time and a.end_time >= v_end_time
  );

  v_exception := exists(
    select 1 from public.availability_exceptions x
    where x.active=true and x.exception_date=v_date
      and ((x.teacher_id=p_teacher_id) or (x.student_id=p_student_id))
      and (x.all_day=true or (x.start_time < v_end_time and x.end_time > v_start_time))
  );

  v_holiday := exists(select 1 from public.holidays h where h.holiday_date=v_date and h.active=true);

  v_conflict := exists(
    select 1 from public.sessions s
    where (s.teacher_id=p_teacher_id or s.student_id=p_student_id)
      and s.scheduled_start is not null and s.scheduled_end is not null
      and s.scheduled_start < p_end and s.scheduled_end > p_start
      and s.status in ('scheduled','confirmed','in_progress')
  );

  if not v_teacher_available then v_reasons := v_reasons || jsonb_build_array('OUTSIDE_TEACHER_AVAILABILITY'); end if;
  if not v_student_available then v_reasons := v_reasons || jsonb_build_array('OUTSIDE_STUDENT_AVAILABILITY'); end if;
  if v_exception then v_reasons := v_reasons || jsonb_build_array('BLACKED_OUT'); end if;
  if v_holiday then v_reasons := v_reasons || jsonb_build_array('HOLIDAY'); end if;
  if v_conflict then v_reasons := v_reasons || jsonb_build_array('CONFLICT'); end if;

  return jsonb_build_object(
    'status', case
      when v_conflict then 'CONFLICT'
      when v_exception or v_holiday then 'BLACKED_OUT'
      when not v_teacher_available or not v_student_available then 'OUTSIDE_AVAILABILITY'
      else 'AVAILABLE'
    end,
    'available', (not v_conflict and not v_exception and not v_holiday and v_teacher_available and v_student_available),
    'teacher_available', v_teacher_available,
    'student_available', v_student_available,
    'holiday', v_holiday,
    'blackout', v_exception,
    'conflict', v_conflict,
    'local_date', v_date,
    'day_of_week', v_dow,
    'timezone', p_timezone,
    'reasons', v_reasons
  );
end;
$$;

grant execute on function public.check_schedule_slot(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.assert_schedule_slot(
  p_teacher_id uuid,
  p_student_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text default 'Asia/Manila'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  v_result := public.check_schedule_slot(p_teacher_id,p_student_id,p_start,p_end,p_timezone);
  if coalesce((v_result->>'available')::boolean,false) = false then
    raise exception 'Schedule slot unavailable: %', coalesce(v_result->>'reasons','[]');
  end if;
  return v_result;
end;
$$;

grant execute on function public.assert_schedule_slot(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

-- Validate every newly accepted recurring series before it becomes active.
create or replace function public.validate_recurring_series_slot()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_start timestamptz; v_end timestamptz; v_result jsonb;
begin
  v_start := ((new.start_date + ((new.day_of_week - extract(dow from new.start_date)::integer + 7) % 7))::timestamp + new.start_time) at time zone new.timezone;
  v_end := ((new.start_date + ((new.day_of_week - extract(dow from new.start_date)::integer + 7) % 7))::timestamp + new.end_time) at time zone new.timezone;
  v_result := public.check_schedule_slot(new.teacher_id,new.student_id,v_start,v_end,new.timezone);
  if coalesce((v_result->>'available')::boolean,false) = false then
    raise exception 'Cannot activate recurring series: %', coalesce(v_result->>'reasons','[]');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_recurring_series_slot on public.recurring_lesson_series;
create trigger trg_validate_recurring_series_slot before insert or update of teacher_id,student_id,day_of_week,start_time,end_time,start_date,timezone,active on public.recurring_lesson_series
for each row when (new.active=true) execute function public.validate_recurring_series_slot();

-- Safe generation: checks every generated occurrence against availability, blackouts,
-- holidays and existing scheduled sessions before assigning the enrollment ledger slot.
create or replace function public.generate_recurring_series_sessions_safe(p_series_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v public.recurring_lesson_series%rowtype;
  d date;
  v_session uuid;
  v_count integer := 0;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
  v_number integer;
begin
  select * into v from public.recurring_lesson_series where id=p_series_id;
  if not found then raise exception 'Recurring series not found'; end if;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Not allowed'; end if;

  d := v.start_date + ((v.day_of_week - extract(dow from v.start_date)::integer + 7) % 7);
  while d <= least(v.end_date, v.start_date + ((v.recurrence_weeks-1)*7)) loop
    if not exists(select 1 from public.holidays h where h.holiday_date=d and h.active=true)
       and not exists(select 1 from public.recurring_lesson_exceptions x where x.series_id=v.id and x.exception_date=d and x.action in ('skip','cancel')) then
      v_start := ((d::timestamp + v.start_time) at time zone v.timezone);
      v_end := ((d::timestamp + v.end_time) at time zone v.timezone);
      v_result := public.check_schedule_slot(v.teacher_id,v.student_id,v_start,v_end,v.timezone);
      if coalesce((v_result->>'available')::boolean,false) = false then
        raise exception 'Recurring schedule conflict on %: %', d, coalesce(v_result->>'reasons','[]');
      end if;

      select s.id into v_session
      from public.sessions s
      where s.enrollment_id=v.enrollment_id and s.scheduled_start is null and s.status='unassigned'
      order by s.session_number limit 1;

      if v_session is null then
        select coalesce(max(session_number),0)+1 into v_number from public.sessions where enrollment_id=v.enrollment_id;
        insert into public.sessions(enrollment_id,session_number,student_id,teacher_id,scheduled_start,scheduled_end,status,meeting_provider,meeting_url)
        values(v.enrollment_id,v_number,v.student_id,v.teacher_id,v_start,v_end,'scheduled',v.meeting_provider,v.meeting_url)
        returning id into v_session;
      else
        update public.sessions set scheduled_start=v_start,scheduled_end=v_end,status='scheduled',teacher_id=v.teacher_id,student_id=v.student_id,meeting_provider=v.meeting_provider,meeting_url=v.meeting_url,updated_at=now() where id=v_session;
      end if;
      v_count := v_count + 1;
    end if;
    d := d + 7;
  end loop;

  insert into public.scheduling_audit_log(actor_id,entity_type,entity_id,action,status,details)
  values(auth.uid(),'recurring_lesson_series',v.id,'generate_sessions','success',jsonb_build_object('generated',v_count));
  return v_count;
end;
$$;

grant execute on function public.generate_recurring_series_sessions_safe(uuid) to authenticated;

-- Preserve the existing RPC used by the UI, but route it through the hardened engine.
create or replace function public.generate_recurring_series_sessions(p_series_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
begin
  return public.generate_recurring_series_sessions_safe(p_series_id);
end;
$$;

grant execute on function public.generate_recurring_series_sessions(uuid) to authenticated;

-- Record proposal/series lifecycle events without changing existing callers.
create or replace function public.log_scheduling_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_status text default null,
  p_details jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.scheduling_audit_log(actor_id,entity_type,entity_id,action,status,details)
  values(auth.uid(),p_entity_type,p_entity_id,p_action,p_status,coalesce(p_details,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_scheduling_event(text,uuid,text,text,jsonb) to authenticated;
