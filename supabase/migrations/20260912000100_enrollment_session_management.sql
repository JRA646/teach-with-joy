-- Teach With Joy: enrollment, session ledger, attendance, teacher availability and contract benefits.

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
  active boolean not null default true,
  unique(teacher_id, day_of_week, start_time, end_time)
);

create table if not exists public.preferred_schedules (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  priority integer not null default 1,
  status text not null default 'requested' check (status in ('requested','approved','rejected')),
  notes text,
  unique(enrollment_id, day_of_week, start_time)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  country_code text not null check (country_code in ('PH','KR')),
  name text not null,
  active boolean not null default true,
  unique(holiday_date, country_code)
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
  status text not null default 'available' check (status in ('available','claimed')),
  claimed_at timestamptz
);

create or replace function public.touch_program_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_enrollments_updated_at on public.enrollments;
create trigger trg_enrollments_updated_at before update on public.enrollments
for each row execute function public.touch_program_updated_at();

drop trigger if exists trg_sessions_updated_at on public.sessions;
create trigger trg_sessions_updated_at before update on public.sessions
for each row execute function public.touch_program_updated_at();

create or replace function public.create_enrollment_session_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sessions (enrollment_id, session_number, student_id, teacher_id)
  select new.id, n, new.student_id, new.teacher_id
  from generate_series(1, new.total_sessions) n;

  insert into public.ebook_entitlements (enrollment_id, title)
  select new.id, 'Free e-book #' || n
  from generate_series(1, new.ebook_total) n;

  return new;
end;
$$;

drop trigger if exists trg_create_enrollment_ledger on public.enrollments;
create trigger trg_create_enrollment_ledger after insert on public.enrollments
for each row execute function public.create_enrollment_session_ledger();

alter table public.enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.preferred_schedules enable row level security;
alter table public.holidays enable row level security;
alter table public.enrollment_payments enable row level security;
alter table public.ebook_entitlements enable row level security;

-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS, so use DROP/CREATE.
drop policy if exists enrollments_admin_all on public.enrollments;
create policy enrollments_admin_all on public.enrollments for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists enrollments_student_read on public.enrollments;
create policy enrollments_student_read on public.enrollments for select using (student_id = auth.uid());
drop policy if exists enrollments_teacher_read on public.enrollments;
create policy enrollments_teacher_read on public.enrollments for select using (teacher_id = auth.uid());

drop policy if exists sessions_admin_all on public.sessions;
create policy sessions_admin_all on public.sessions for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists sessions_student_read on public.sessions;
create policy sessions_student_read on public.sessions for select using (student_id = auth.uid());
drop policy if exists sessions_teacher_read on public.sessions;
create policy sessions_teacher_read on public.sessions for select using (teacher_id = auth.uid());

drop policy if exists availability_admin_all on public.teacher_availability;
create policy availability_admin_all on public.teacher_availability for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists availability_teacher_read on public.teacher_availability;
create policy availability_teacher_read on public.teacher_availability for select using (teacher_id = auth.uid());

drop policy if exists preferred_admin_all on public.preferred_schedules;
create policy preferred_admin_all on public.preferred_schedules for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists preferred_student_read on public.preferred_schedules;
create policy preferred_student_read on public.preferred_schedules for select using (exists (select 1 from public.enrollments e where e.id = preferred_schedules.enrollment_id and e.student_id = auth.uid()));

drop policy if exists holidays_read_authenticated on public.holidays;
create policy holidays_read_authenticated on public.holidays for select to authenticated using (true);

drop policy if exists payments_admin_all on public.enrollment_payments;
create policy payments_admin_all on public.enrollment_payments for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists payments_student_read on public.enrollment_payments;
create policy payments_student_read on public.enrollment_payments for select using (exists (select 1 from public.enrollments e where e.id = enrollment_payments.enrollment_id and e.student_id = auth.uid()));

drop policy if exists ebooks_admin_all on public.ebook_entitlements;
create policy ebooks_admin_all on public.ebook_entitlements for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists ebooks_student_read on public.ebook_entitlements;
create policy ebooks_student_read on public.ebook_entitlements for select using (exists (select 1 from public.enrollments e where e.id = ebook_entitlements.enrollment_id and e.student_id = auth.uid()));

create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_teacher on public.enrollments(teacher_id);
create index if not exists idx_sessions_enrollment on public.sessions(enrollment_id);
create index if not exists idx_sessions_student on public.sessions(student_id);
create index if not exists idx_sessions_teacher on public.sessions(teacher_id);
create index if not exists idx_sessions_schedule on public.sessions(scheduled_start);
create index if not exists idx_preferred_enrollment on public.preferred_schedules(enrollment_id);
create index if not exists idx_payments_enrollment on public.enrollment_payments(enrollment_id);
create index if not exists idx_ebooks_enrollment on public.ebook_entitlements(enrollment_id);