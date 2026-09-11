-- Teach With Joy: enrollment, session ledger, attendance, teacher availability and contract benefits.
-- Apply this migration to the connected Supabase project before using the new workspace screens.

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  contract_type text not null default 'monthly' check (contract_type in ('monthly','three_month')),
  start_date date not null,
  end_date date not null,
  monthly_sessions integer not null default 20 check (monthly_sessions > 0),
  total_sessions integer not null default 20 check (total_sessions > 0),
  postponements_total integer not null default 0 check (postponements_total >= 0),
  postponements_used integer not null default 0 check (postponements_used between 0 and postponements_total),
  ebook_total integer not null default 0 check (ebook_total >= 0),
  payment_amount numeric(12,2) not null default 0 check (payment_amount >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','partial','refunded')),
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  session_number integer not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text not null default 'unassigned' check (status in ('unassigned','scheduled','confirmed','in_progress','completed','student_absent','teacher_absent','student_cancelled','teacher_cancelled','postponed','holiday','no_show','technical_issue')),
  counts_as_session boolean not null default true,
  postponement_used boolean not null default false,
  makeup_for uuid references public.sessions(id) on delete set null,
  meeting_provider text not null default 'teach_with_joy' check (meeting_provider in ('teach_with_joy','zoom','microsoft_teams','google_meet','other')),
  meeting_url text,
  notes text,
  attendance_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, session_number)
);

create table if not exists public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Manila',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(teacher_id, day_of_week, start_time, end_time)
);

create table if not exists public.preferred_schedules (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  priority integer not null default 1 check (priority > 0),
  status text not null default 'requested' check (status in ('requested','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(enrollment_id, day_of_week, start_time, end_time)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  country_code text not null check (country_code in ('PH','KR')),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(holiday_date, country_code, name)
);

create table if not exists public.enrollment_payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','partial','refunded')),
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ebook_entitlements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  title text not null,
  status text not null default 'available' check (status in ('available','claimed','delivered')),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.touch_program_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_enrollments_updated_at on public.enrollments;
create trigger trg_enrollments_updated_at before update on public.enrollments for each row execute function public.touch_program_updated_at();

drop trigger if exists trg_sessions_updated_at on public.sessions;
create trigger trg_sessions_updated_at before update on public.sessions for each row execute function public.touch_program_updated_at();

create or replace function public.create_enrollment_session_ledger()
returns trigger language plpgsql as $$
begin
  insert into public.sessions (enrollment_id, session_number, student_id, teacher_id)
  select new.id, g, new.student_id, new.teacher_id from generate_series(1, new.total_sessions) g;
  if new.ebook_total > 0 then
    insert into public.ebook_entitlements (enrollment_id, title)
    select new.id, 'Free e-book ' || g from generate_series(1, new.ebook_total) g;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_enrollment_ledger on public.enrollments;
create trigger trg_create_enrollment_ledger after insert on public.enrollments for each row execute function public.create_enrollment_session_ledger();

alter table public.enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.preferred_schedules enable row level security;
alter table public.holidays enable row level security;
alter table public.enrollment_payments enable row level security;
alter table public.ebook_entitlements enable row level security;

create policy enrollments_admin_all on public.enrollments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enrollments_student_select on public.enrollments for select to authenticated using (student_id = (select auth.uid()));
create policy enrollments_teacher_select on public.enrollments for select to authenticated using (teacher_id = (select auth.uid()));

create policy sessions_admin_all on public.sessions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy sessions_student_select on public.sessions for select to authenticated using (student_id = (select auth.uid()));
create policy sessions_teacher_all on public.sessions for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

create policy teacher_availability_admin_all on public.teacher_availability for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy teacher_availability_teacher_all on public.teacher_availability for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy teacher_availability_student_select on public.teacher_availability for select to authenticated using (is_active = true);

create policy preferred_schedules_admin_all on public.preferred_schedules for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy preferred_schedules_student_all on public.preferred_schedules for all to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = (select auth.uid()))) with check (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = (select auth.uid())));
create policy preferred_schedules_teacher_select on public.preferred_schedules for select to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.teacher_id = (select auth.uid())));

create policy holidays_authenticated_select on public.holidays for select to authenticated using (is_active = true);
create policy holidays_admin_all on public.holidays for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy enrollment_payments_admin_all on public.enrollment_payments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy enrollment_payments_student_select on public.enrollment_payments for select to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = (select auth.uid())));
create policy enrollment_payments_teacher_select on public.enrollment_payments for select to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.teacher_id = (select auth.uid())));

create policy ebook_entitlements_admin_all on public.ebook_entitlements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ebook_entitlements_student_select on public.ebook_entitlements for select to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.student_id = (select auth.uid())));
create policy ebook_entitlements_teacher_select on public.ebook_entitlements for select to authenticated using (exists (select 1 from public.enrollments e where e.id = enrollment_id and e.teacher_id = (select auth.uid())));

create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_teacher on public.enrollments(teacher_id);
create index if not exists idx_sessions_enrollment on public.sessions(enrollment_id);
create index if not exists idx_sessions_scheduled_start on public.sessions(scheduled_start);
create index if not exists idx_sessions_teacher on public.sessions(teacher_id);
create index if not exists idx_sessions_student on public.sessions(student_id);
create index if not exists idx_holidays_date on public.holidays(holiday_date);
