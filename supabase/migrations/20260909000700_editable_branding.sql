alter table public.site_theme add column if not exists site_name text not null default 'TeachWithJoy';
alter table public.site_theme add column if not exists footer_text text not null default 'Personalized learning, thoughtfully scheduled.';
alter table public.site_theme add column if not exists copyright_text text not null default '© 2026 TeachWithJoy. Learn with confidence.';
