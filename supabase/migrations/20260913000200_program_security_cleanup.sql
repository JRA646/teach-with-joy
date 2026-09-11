alter function public.protect_session_accounting_fields() set search_path = public;

revoke execute on function public.generate_enrollment_session_schedule(uuid) from anon;
grant execute on function public.generate_enrollment_session_schedule(uuid) to authenticated;

revoke execute on function public.record_session_attendance(uuid,text,text,text,text,text) from anon;
grant execute on function public.record_session_attendance(uuid,text,text,text,text,text) to authenticated;
