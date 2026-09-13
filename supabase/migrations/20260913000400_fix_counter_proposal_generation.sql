-- Fix counter-proposal acceptance so the accepted recurring series immediately schedules sessions.
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
  perform public.generate_recurring_series_sessions(v_series);
  return v_series;
end;
$$;
