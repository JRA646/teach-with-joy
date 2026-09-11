revoke execute on function public.record_session_attendance(uuid,text,text,text,text,text) from public;
grant execute on function public.record_session_attendance(uuid,text,text,text,text,text) to authenticated;
create or replace function public.touch_program_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
