-- Platform audit hardening: preserve before/after snapshots for administrative changes.
-- JSONB keeps the audit layer generic across navigation, widgets, flags and future configuration.

alter table public.platform_activity_log
  add column if not exists before_data jsonb,
  add column if not exists after_data jsonb;

create index if not exists platform_activity_log_action_created_idx
  on public.platform_activity_log(action, created_at desc);

comment on column public.platform_activity_log.before_data is 'Configuration/entity state before the audited change.';
comment on column public.platform_activity_log.after_data is 'Configuration/entity state after the audited change.';
