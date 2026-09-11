-- Teach With Joy: scheduling automation, payment ledger sync, protected session accounting,
-- and e-book catalog primitives.

create table if not exists public.ebooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  cover_url text,
  file_url text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ebook_claims (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  ebook_id uuid not null references public.ebooks(id) on delete restrict,
  entitlement_number integer not null check (entitlement_number > 0),
  claimed_at timestamptz not null default now(),
  unique(enrollment_id, entitlement_number),
  unique(enrollment_id, ebook_id)
);

alter table public.ebooks enable row level security;
alter table public.ebook_claims enable row level security;

drop policy if exists ebooks_catalog_read on public.ebooks;
create policy ebooks_catalog_read on public.ebooks for select to authenticated using (active = true or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists ebooks_catalog_admin on public.ebooks;
create policy ebooks_catalog_admin on public.ebooks for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists ebook_claims_student_read on public.ebook_claims;
create policy ebook_claims_student_read on public.ebook_claims for select using (exists (select 1 from public.enrollments e where e.id = ebook_claims.enrollment_id and e.student_id = auth.uid()));
drop policy if exists ebook_claims_admin_all on public.ebook_claims;
create policy ebook_claims_admin_all on public.ebook_claims for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists idx_ebook_claims_enrollment on public.ebook_claims(enrollment_id);
create index if not exists idx_ebooks_active on public.ebooks(active);

-- Keep one financial source of truth for enrollment payments.
create or replace function public.sync_enrollment_payment_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.payment_amount > 0 then
    insert into public.enrollment_payments (enrollment_id, amount, status, paid_at, notes)
    values (new.id, new.payment_amount, new.payment_status, case when new.payment_status = 'paid' then now() else null end, 'Initial enrollment payment');
  elsif tg_op = 'UPDATE' and (new.payment_amount is distinct from old.payment_amount or new.payment_status is distinct from old.payment_status) then
    update public.enrollment_payments
       set amount = new.payment_amount,
           status = new.payment_status,
           paid_at = case when new.payment_status = 'paid' and paid_at is null then now() when new.payment_status <> 'paid' then null else paid_at end,
           notes = coalesce(notes, 'Enrollment payment')
     where enrollment_id = new.id
       and notes = 'Initial enrollment payment';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_enrollment_payment_ledger on public.enrollments;
create trigger trg_sync_enrollment_payment_ledger
after insert or update of payment_amount, payment_status on public.enrollments
for each row execute function public.sync_enrollment_payment_ledger();

-- Protect session accounting fields from direct client edits. The controlled attendance RPC
-- temporarily marks its own transaction so it can update them safely.
create or replace function public.protect_session_accounting_fields()
returns trigger language plpgsql as $$
begin
  if current_setting('teach_with_joy.workflow', true) is distinct from 'attendance' then
    if new.counts_as_session is distinct from old.counts_as_session
       or new.postponement_used is distinct from old.postponement_used
       or new.makeup_for is distinct from old.makeup_for
       or new.session_number is distinct from old.session_number
       or new.enrollment_id is distinct from old.enrollment_id
       or new.student_id is distinct from old.student_id
       or new.teacher_id is distinct from old.teacher_id then
      raise exception 'Session accounting fields can only be changed by the controlled workflow';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_session_accounting_fields on public.sessions;
create trigger trg_protect_session_accounting_fields
before update on public.sessions
for each row execute function public.protect_session_accounting_fields();

-- Generate the contracted session schedule from approved preferred times, teacher availability,
-- and PH/KR holidays. Only unassigned contract sessions are scheduled; make-up rows remain manual.
create or replace function public.generate_enrollment_session_schedule(p_enrollment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_enrollment public.enrollments%rowtype;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_teacher boolean;
  v_session public.sessions%rowtype;
  v_pref record;
  v_date date;
  v_candidate_start timestamptz;
  v_candidate_end timestamptz;
  v_scheduled integer := 0;
  v_existing integer;
  v_horizon integer;
  v_teacher_has_availability boolean;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;
  select exists(select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') into v_admin;
  v_teacher := v_enrollment.teacher_id = v_uid;
  if not v_admin and not v_teacher then raise exception 'Only the assigned teacher or an administrator can generate a schedule'; end if;

  select count(*) into v_existing from public.sessions where enrollment_id = v_enrollment.id and scheduled_start is not null;
  if v_existing >= v_enrollment.total_sessions then
    return jsonb_build_object('scheduled', 0, 'message', 'All contract sessions are already scheduled');
  end if;

  select exists(select 1 from public.teacher_availability ta where ta.teacher_id = v_enrollment.teacher_id and ta.active = true) into v_teacher_has_availability;

  for v_session in
    select * from public.sessions
    where enrollment_id = v_enrollment.id
      and session_number <= v_enrollment.total_sessions
      and scheduled_start is null
      and status = 'unassigned'
    order by session_number
  loop
    v_candidate_start := null;
    v_horizon := greatest(365, v_enrollment.total_sessions * 30);
    for v_date in
      select v_enrollment.start_date + g
      from generate_series(0, v_horizon) g
    loop
      exit when v_candidate_start is not null;
      if exists(select 1 from public.holidays h where h.holiday_date = v_date and h.active = true) then
        continue;
      end if;
      if exists(select 1 from public.sessions s where s.enrollment_id = v_enrollment.id and s.scheduled_start::date = v_date) then
        continue;
      end if;

      if exists(select 1 from public.preferred_schedules ps where ps.enrollment_id = v_enrollment.id and ps.status = 'approved' and ps.day_of_week = extract(dow from v_date)::integer) then
        for v_pref in
          select ps.start_time, ps.end_time
          from public.preferred_schedules ps
          where ps.enrollment_id = v_enrollment.id
            and ps.status = 'approved'
            and ps.day_of_week = extract(dow from v_date)::integer
          order by ps.priority asc, ps.start_time asc
        loop
          if not v_teacher_has_availability or exists(
            select 1 from public.teacher_availability ta
            where ta.teacher_id = v_enrollment.teacher_id
              and ta.active = true
              and ta.day_of_week = extract(dow from v_date)::integer
              and ta.start_time <= v_pref.start_time
              and ta.end_time >= v_pref.end_time
          ) then
            v_candidate_start := (v_date + v_pref.start_time)::timestamp at time zone 'Asia/Manila';
            v_candidate_end := (v_date + v_pref.end_time)::timestamp at time zone 'Asia/Manila';
            exit;
          end if;
        end loop;
      end if;
    end loop;

    if v_candidate_start is not null then
      perform set_config('teach_with_joy.workflow', 'attendance', true);
      update public.sessions
         set scheduled_start = v_candidate_start,
             scheduled_end = v_candidate_end,
             status = 'scheduled',
             updated_at = now()
       where id = v_session.id;
      perform set_config('teach_with_joy.workflow', '', true);
      v_scheduled := v_scheduled + 1;
    end if;
  end loop;

  return jsonb_build_object('scheduled', v_scheduled, 'total_sessions', v_enrollment.total_sessions);
end;
$$;

grant execute on function public.generate_enrollment_session_schedule(uuid) to authenticated;

-- Ensure the attendance workflow can update protected accounting fields in its own transaction.
create or replace function public.record_session_attendance(
  p_session_id uuid,
  p_status text,
  p_lesson_plan text default null,
  p_progress_notes text default null,
  p_homework text default null,
  p_change_notes text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session public.sessions%rowtype;
  v_old_status text;
  v_old_counts boolean;
  v_is_admin boolean;
  v_counts boolean;
  v_new_session public.sessions%rowtype;
  v_max_number integer;
  v_enrollment public.enrollments%rowtype;
begin
  if p_status not in ('completed','student_absent','teacher_absent','student_cancelled','teacher_cancelled','postponed','holiday','no_show','technical_issue','scheduled','confirmed','in_progress') then raise exception 'Invalid session status'; end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  v_old_status := v_session.status;
  v_old_counts := v_session.counts_as_session;
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') into v_is_admin;
  if not v_is_admin and v_session.teacher_id <> auth.uid() then raise exception 'Only the assigned teacher or an administrator can update this session'; end if;
  v_counts := case when p_status in ('completed','student_absent','student_cancelled','no_show','technical_issue') then true when p_status in ('teacher_absent','teacher_cancelled','postponed','holiday') then false else v_session.counts_as_session end;
  perform set_config('teach_with_joy.workflow', 'attendance', true);
  update public.sessions set status=p_status, counts_as_session=v_counts, lesson_plan=coalesce(p_lesson_plan,lesson_plan), progress_notes=coalesce(p_progress_notes,progress_notes), homework=coalesce(p_homework,homework), change_notes=coalesce(p_change_notes,change_notes), attendance_marked_at=case when p_status in ('completed','student_absent','teacher_absent','student_cancelled','teacher_cancelled','postponed','holiday','no_show','technical_issue') then now() else attendance_marked_at end, updated_at=now() where id=p_session_id;
  if p_status='teacher_absent' then
    select * into v_enrollment from public.enrollments where id=v_session.enrollment_id;
    select coalesce(max(session_number),v_enrollment.total_sessions)+1 into v_max_number from public.sessions where enrollment_id=v_session.enrollment_id;
    insert into public.sessions(enrollment_id,session_number,student_id,teacher_id,status,counts_as_session,makeup_for,meeting_provider,notes) values(v_session.enrollment_id,v_max_number,v_session.student_id,v_session.teacher_id,'unassigned',false,v_session.id,v_session.meeting_provider,'Make-up required for teacher absence') returning * into v_new_session;
  elsif p_status='postponed' then
    select * into v_enrollment from public.enrollments where id=v_session.enrollment_id for update;
    if v_enrollment.postponements_used>=v_enrollment.postponements_total then raise exception 'No postponement privileges remaining'; end if;
    update public.enrollments set postponements_used=postponements_used+1,updated_at=now() where id=v_enrollment.id;
    select coalesce(max(session_number),v_enrollment.total_sessions)+1 into v_max_number from public.sessions where enrollment_id=v_session.enrollment_id;
    update public.sessions set postponement_used=true where id=v_session.id;
    insert into public.sessions(enrollment_id,session_number,student_id,teacher_id,status,counts_as_session,makeup_for,meeting_provider,notes) values(v_session.enrollment_id,v_max_number,v_session.student_id,v_session.teacher_id,'unassigned',false,v_session.id,v_session.meeting_provider,'Replacement session created by postponement') returning * into v_new_session;
  end if;
  perform set_config('teach_with_joy.workflow', '', true);
  insert into public.session_audit_log(session_id,changed_by,old_status,new_status,old_counts_as_session,new_counts_as_session,action,details) values(v_session.id,auth.uid(),v_old_status,p_status,v_old_counts,v_counts,'attendance',jsonb_build_object('lesson_plan',p_lesson_plan,'progress_notes',p_progress_notes,'homework',p_homework,'change_notes',p_change_notes));
  return jsonb_build_object('session_id',v_session.id,'status',p_status,'counts_as_session',v_counts,'replacement_session_id',case when v_new_session.id is null then null else v_new_session.id end);
end;
$$;

grant execute on function public.record_session_attendance(uuid,text,text,text,text,text) to authenticated;
revoke execute on function public.record_session_attendance(uuid,text,text,text,text,text) from public;

-- Teachers can update operational fields, but cannot bypass the controlled accounting trigger.
drop policy if exists sessions_teacher_update on public.sessions;
create policy sessions_teacher_update on public.sessions for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
