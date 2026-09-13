-- Teach With Joy: teacher proposals + recurring weekly lesson series.
create table if not exists public.teacher_proposals (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','countered','accepted','rejected','expired','cancelled')),
  proposed_start_date date not null,
  proposed_end_date date not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Manila',
  recurrence_weeks integer not null default 12 check (recurrence_weeks between 1 and 52),
  meeting_provider text not null default 'teach_with_joy' check (meeting_provider in ('teach_with_joy','zoom','microsoft_teams','google_meet','other')),
  meeting_url text,
  teacher_note text,
  student_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed_end_date >= proposed_start_date),
  check (end_time > start_time)
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.teacher_proposals(id) on delete cascade,
  version_number integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  proposed_start_date date not null,
  proposed_end_date date not null,
  recurrence_weeks integer not null check (recurrence_weeks between 1 and 52),
  note text,
  created_at timestamptz not null default now(),
  unique(proposal_id, version_number)
);

create table if not exists public.proposal_messages (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.teacher_proposals(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_lesson_series (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.teacher_proposals(id) on delete set null,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Manila',
  start_date date not null,
  end_date date not null,
  recurrence_weeks integer not null default 12 check (recurrence_weeks between 1 and 52),
  meeting_provider text not null default 'teach_with_joy' check (meeting_provider in ('teach_with_joy','zoom','microsoft_teams','google_meet','other')),
  meeting_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_time > start_time)
);

create table if not exists public.recurring_lesson_exceptions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.recurring_lesson_series(id) on delete cascade,
  exception_date date not null,
  reason text,
  action text not null default 'skip' check (action in ('skip','reschedule','cancel')),
  replacement_start timestamptz,
  replacement_end timestamptz,
  created_at timestamptz not null default now(),
  unique(series_id, exception_date)
);

create or replace function public.touch_teacher_proposal_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_teacher_proposals_updated_at on public.teacher_proposals;
create trigger trg_teacher_proposals_updated_at before update on public.teacher_proposals for each row execute function public.touch_teacher_proposal_updated_at();
drop trigger if exists trg_recurring_series_updated_at on public.recurring_lesson_series;
create trigger trg_recurring_series_updated_at before update on public.recurring_lesson_series for each row execute function public.touch_teacher_proposal_updated_at();

create or replace function public.create_teacher_proposal(
  p_enrollment_id uuid,
  p_start_date date,
  p_end_date date,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_recurrence_weeks integer,
  p_meeting_provider text default 'teach_with_joy',
  p_meeting_url text default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_student uuid; v_teacher uuid;
begin
  select e.student_id, e.teacher_id into v_student, v_teacher from public.enrollments e where e.id=p_enrollment_id;
  if v_teacher is null or v_teacher <> auth.uid() then raise exception 'Only the assigned teacher can create this proposal'; end if;
  insert into public.teacher_proposals(enrollment_id,teacher_id,student_id,proposed_start_date,proposed_end_date,day_of_week,start_time,end_time,recurrence_weeks,meeting_provider,meeting_url,teacher_note,created_by)
  values(p_enrollment_id,v_teacher,v_student,p_start_date,p_end_date,p_day_of_week,p_start_time,p_end_time,p_recurrence_weeks,p_meeting_provider,p_meeting_url,p_note,auth.uid()) returning id into v_id;
  insert into public.proposal_versions(proposal_id,version_number,actor_id,day_of_week,start_time,end_time,proposed_start_date,proposed_end_date,recurrence_weeks,note)
  values(v_id,1,auth.uid(),p_day_of_week,p_start_time,p_end_time,p_start_date,p_end_date,p_recurrence_weeks,p_note);
  return v_id;
end;
$$;

create or replace function public.respond_to_teacher_proposal(
  p_proposal_id uuid,
  p_action text,
  p_day_of_week integer default null,
  p_start_time time default null,
  p_end_time time default null,
  p_start_date date default null,
  p_end_date date default null,
  p_recurrence_weeks integer default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_proposal public.teacher_proposals%rowtype; v_version integer; v_series uuid;
begin
  select * into v_proposal from public.teacher_proposals where id=p_proposal_id for update;
  if v_proposal.student_id <> auth.uid() then raise exception 'Only the student can respond to this proposal'; end if;
  if p_action not in ('accepted','rejected','countered') then raise exception 'Invalid proposal action'; end if;
  if p_action='accepted' then
    update public.teacher_proposals set status='accepted', student_note=p_note where id=p_proposal_id;
    insert into public.recurring_lesson_series(proposal_id,enrollment_id,teacher_id,student_id,day_of_week,start_time,end_time,timezone,start_date,end_date,recurrence_weeks,meeting_provider,meeting_url)
    values(p_proposal_id,v_proposal.enrollment_id,v_proposal.teacher_id,v_proposal.student_id,v_proposal.day_of_week,v_proposal.start_time,v_proposal.end_time,v_proposal.timezone,v_proposal.proposed_start_date,v_proposal.proposed_end_date,v_proposal.recurrence_weeks,v_proposal.meeting_provider,v_proposal.meeting_url)
    returning id into v_series;
    return v_series;
  end if;
  if p_action='rejected' then
    update public.teacher_proposals set status='rejected', student_note=p_note where id=p_proposal_id;
    return p_proposal_id;
  end if;
  if p_day_of_week is null or p_start_time is null or p_end_time is null then raise exception 'Counter proposal requires a day and time'; end if;
  select coalesce(max(version_number),0)+1 into v_version from public.proposal_versions where proposal_id=p_proposal_id;
  update public.teacher_proposals set status='countered',day_of_week=p_day_of_week,start_time=p_start_time,end_time=p_end_time,proposed_start_date=coalesce(p_start_date,proposed_start_date),proposed_end_date=coalesce(p_end_date,proposed_end_date),recurrence_weeks=coalesce(p_recurrence_weeks,recurrence_weeks),student_note=p_note where id=p_proposal_id;
  insert into public.proposal_versions(proposal_id,version_number,actor_id,day_of_week,start_time,end_time,proposed_start_date,proposed_end_date,recurrence_weeks,note)
  values(p_proposal_id,v_version,auth.uid(),p_day_of_week,p_start_time,p_end_time,coalesce(p_start_date,v_proposal.proposed_start_date),coalesce(p_end_date,v_proposal.proposed_end_date),coalesce(p_recurrence_weeks,v_proposal.recurrence_weeks),p_note);
  insert into public.proposal_messages(proposal_id,sender_id,message) values(p_proposal_id,auth.uid(),coalesce(p_note,'Counter proposal submitted'));
  return p_proposal_id;
end;
$$;

create or replace function public.teacher_accept_counter_proposal(p_proposal_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v public.teacher_proposals%rowtype; v_series uuid;
begin
  select * into v from public.teacher_proposals where id=p_proposal_id for update;
  if v.teacher_id <> auth.uid() then raise exception 'Only the assigned teacher can accept the counter proposal'; end if;
  if v.status <> 'countered' then raise exception 'Proposal is not awaiting teacher approval'; end if;
  update public.teacher_proposals set status='accepted',teacher_note=coalesce(p_note,teacher_note) where id=p_proposal_id;
  insert into public.recurring_lesson_series(proposal_id,enrollment_id,teacher_id,student_id,day_of_week,start_time,end_time,timezone,start_date,end_date,recurrence_weeks,meeting_provider,meeting_url)
  values(v.id,v.enrollment_id,v.teacher_id,v.student_id,v.day_of_week,v.start_time,v.end_time,v.timezone,v.proposed_start_date,v.proposed_end_date,v.recurrence_weeks,v.meeting_provider,v.meeting_url)
  returning id into v_series;
  return v_series;
end;
$$;

create or replace function public.generate_recurring_series_sessions(p_series_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v public.recurring_lesson_series%rowtype; e public.enrollments%rowtype; d date; v_session uuid; v_count integer:=0; v_number integer; v_start timestamptz; v_end timestamptz;
begin
  select * into v from public.recurring_lesson_series where id=p_series_id;
  if v.teacher_id <> auth.uid() and v.student_id <> auth.uid() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Not allowed'; end if;
  select * into e from public.enrollments where id=v.enrollment_id;
  d := v.start_date + ((v.day_of_week - extract(dow from v.start_date)::integer + 7) % 7);
  while d <= least(v.end_date, v.start_date + ((v.recurrence_weeks-1)*7)) loop
    if not exists(select 1 from public.holidays h where h.holiday_date=d and h.active=true) and not exists(select 1 from public.recurring_lesson_exceptions x where x.series_id=v.id and x.exception_date=d) then
      v_start := (d::text || ' ' || v.start_time::text || ' ' || v.timezone)::timestamptz;
      v_end := (d::text || ' ' || v.end_time::text || ' ' || v.timezone)::timestamptz;
      select id into v_session from public.sessions where enrollment_id=v.enrollment_id and scheduled_start is null and status='unassigned' order by session_number limit 1;
      if v_session is not null then
        update public.sessions set scheduled_start=v_start, scheduled_end=v_end, status='scheduled', teacher_id=v.teacher_id, student_id=v.student_id, meeting_provider=v.meeting_provider, meeting_url=v.meeting_url where id=v_session;
        v_count := v_count + 1;
      end if;
    end if;
    d := d + 7;
  end loop;
  return v_count;
end;
$$;

alter table public.teacher_proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_messages enable row level security;
alter table public.recurring_lesson_series enable row level security;
alter table public.recurring_lesson_exceptions enable row level security;

drop policy if exists teacher_proposals_access on public.teacher_proposals;
create policy teacher_proposals_access on public.teacher_proposals for select using (teacher_id=auth.uid() or student_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists proposal_versions_access on public.proposal_versions;
create policy proposal_versions_access on public.proposal_versions for select using (exists(select 1 from public.teacher_proposals p where p.id=proposal_versions.proposal_id and (p.teacher_id=auth.uid() or p.student_id=auth.uid() or exists(select 1 from public.profiles x where x.id=auth.uid() and x.role='admin'))));
drop policy if exists proposal_messages_access on public.proposal_messages;
create policy proposal_messages_access on public.proposal_messages for select using (exists(select 1 from public.teacher_proposals p where p.id=proposal_messages.proposal_id and (p.teacher_id=auth.uid() or p.student_id=auth.uid() or exists(select 1 from public.profiles x where x.id=auth.uid() and x.role='admin'))));
drop policy if exists recurring_series_access on public.recurring_lesson_series;
create policy recurring_series_access on public.recurring_lesson_series for select using (teacher_id=auth.uid() or student_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists recurring_exceptions_access on public.recurring_lesson_exceptions;
create policy recurring_exceptions_access on public.recurring_lesson_exceptions for select using (exists(select 1 from public.recurring_lesson_series s where s.id=recurring_lesson_exceptions.series_id and (s.teacher_id=auth.uid() or s.student_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))));

create index if not exists idx_teacher_proposals_teacher on public.teacher_proposals(teacher_id,status,created_at desc);
create index if not exists idx_teacher_proposals_student on public.teacher_proposals(student_id,status,created_at desc);
create index if not exists idx_recurring_series_enrollment on public.recurring_lesson_series(enrollment_id,active);
