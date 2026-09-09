create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  page text not null unique,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_theme (
  id integer primary key default 1 check (id = 1),
  primary_color text not null default '#6849d7',
  primary_dark text not null default '#5d3bc5',
  accent_color text not null default '#eee8ff',
  background_color text not null default '#f7f6fb',
  surface_color text not null default '#ffffff',
  text_color text not null default '#111827',
  muted_color text not null default '#667085',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.admin_users enable row level security;
alter table public.site_content enable row level security;
alter table public.site_theme enable row level security;

drop policy if exists admin_users_self_select on public.admin_users;
create policy admin_users_self_select on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read on public.site_content
  for select to anon, authenticated
  using (true);

drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write on public.site_content
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists site_theme_public_read on public.site_theme;
create policy site_theme_public_read on public.site_theme
  for select to anon, authenticated
  using (true);

drop policy if exists site_theme_admin_write on public.site_theme;
create policy site_theme_admin_write on public.site_theme
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.site_content (page, content) values
('home', '{"heroEyebrow":"PERSONALIZED ONLINE LESSONS","heroTitle":"Learn smarter, achieve more.","heroText":"One-on-one lessons, flexible scheduling, and supportive teachers—all in one calm learning experience.","heroImage":"https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1400&q=85","heroPrimary":"Book a Session","heroSecondary":"Explore Scheduling","whyEyebrow":"WHY TEACHWITHJOY","whyTitle":"A calmer way to learn.","whyText":"Skip the scattered messages and complicated booking flows. TeachWithJoy gives students a clear path from choosing a subject to attending the lesson.","testimonial":"Joy is an amazing teacher.","testimonialText":"The lessons are easy to understand and very engaging. The whole experience feels organized and personal.","testimonialAuthor":"Anna, Student","ctaEyebrow":"READY WHEN YOU ARE","ctaTitle":"Make your next lesson your best one.","ctaText":"Create your account and discover teachers, schedules, and pricing in one place."}'::jsonb),
('about', '{"eyebrow":"ABOUT TEACHWITHJOY","title":"Teaching that feels personal.","text":"TeachWithJoy connects learners with thoughtful teachers through simple scheduling, focused one-on-one lessons, and a workspace that keeps every session organized.","bodyTitle":"Built around better teaching.","bodyText":"TeachWithJoy is designed to make learning feel less transactional and more human. Students get clarity, teachers get structure, and both sides spend less time managing logistics."}'::jsonb),
('schedule', '{"eyebrow":"SCHEDULING","title":"Find a time that fits your life.","text":"Choose a subject, browse real teacher availability, and reserve a session without the back-and-forth. Your upcoming lessons stay in one place."}'::jsonb),
('pricing', '{"eyebrow":"PRICING","title":"Simple plans for steady progress.","text":"Start with flexible lesson credits or choose a monthly plan when you are ready to make learning a consistent habit."}'::jsonb),
('contact', '{"eyebrow":"CONTACT","title":"We are here to help.","text":"Questions about lessons, schedules, or getting started? Reach the TeachWithJoy team and we will help you find the right next step.","email":"hello@teachwithjoy.app","supportHours":"Monday–Friday, 9:00 AM–6:00 PM","onlineText":"Serving learners wherever they are"}'::jsonb)
on conflict (page) do nothing;

insert into public.site_theme (id) values (1) on conflict (id) do nothing;

comment on table public.admin_users is 'Users allowed to access the TeachWithJoy content management area. Add the auth.users id here to bootstrap an administrator.';
