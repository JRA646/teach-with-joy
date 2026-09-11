alter table public.sessions add column if not exists lesson_plan text;
alter table public.sessions add column if not exists progress_notes text;
alter table public.sessions add column if not exists homework text;
alter table public.sessions add column if not exists change_notes text;

create table if not exists public.session_audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  old_status text,
  new_status text,
  old_counts_as_session boolean,
  new_counts_as_session boolean,
  action text not null default 'update',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.session_audit_log enable row level security;
drop policy if exists session_audit_admin_read on public.session_audit_log;
create policy session_audit_admin_read on public.session_audit_log for select using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists session_audit_teacher_read on public.session_audit_log;
create policy session_audit_teacher_read on public.session_audit_log for select using (exists (select 1 from public.sessions s where s.id = session_audit_log.session_id and s.teacher_id = (select auth.uid())));
drop policy if exists session_audit_student_read on public.session_audit_log;
create policy session_audit_student_read on public.session_audit_log for select using (exists (select 1 from public.sessions s where s.id = session_audit_log.session_id and s.student_id = (select auth.uid())));

drop policy if exists sessions_teacher_update on public.sessions;
create policy sessions_teacher_update on public.sessions for update to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

create index if not exists idx_session_audit_session on public.session_audit_log(session_id);
create index if not exists idx_session_audit_created on public.session_audit_log(created_at);

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
  v_is_admin boolean;
  v_counts boolean;
  v_new_session public.sessions%rowtype;
  v_max_number integer;
  v_enrollment public.enrollments%rowtype;
begin
  if p_status not in ('completed','student_absent','teacher_absent','student_cancelled','teacher_cancelled','postponed','holiday','no_show','technical_issue','scheduled','confirmed','in_progress') then raise exception 'Invalid session status'; end if;
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') into v_is_admin;
  if not v_is_admin and v_session.teacher_id <> (select auth.uid()) then raise exception 'Only the assigned teacher or an administrator can update this session'; end if;
  v_counts := case when p_status in ('completed','student_absent','student_cancelled','no_show','technical_issue') then true when p_status in ('teacher_absent','teacher_cancelled','postponed','holiday') then false else v_session.counts_as_session end;
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
  insert into public.session_audit_log(session_id,changed_by,old_status,new_status,old_counts_as_session,new_counts_as_session,action,details) values(v_session.id,(select auth.uid()),v_session.status,p_status,v_session.counts_as_session,v_counts,'attendance',jsonb_build_object('lesson_plan',p_lesson_plan,'progress_notes',p_progress_notes,'homework',p_homework,'change_notes',p_change_notes));
  return jsonb_build_object('session_id',v_session.id,'status',p_status,'counts_as_session',v_counts,'replacement_session_id',case when v_new_session.id is null then null else v_new_session.id end);
end;
$$;

grant execute on function public.record_session_attendance(uuid,text,text,text,text,text) to authenticated;
