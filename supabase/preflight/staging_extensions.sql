-- Run manually BEFORE migrations, only against a confirmed clean staging project.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if current_setting('focusedu.preflight.environment', true) is distinct from 'staging' then
    raise exception 'Confirm staging with PGOPTIONS=-c focusedu.preflight.environment=staging';
  end if;
  if to_regclass('public.projects') is not null or to_regclass('public.profiles') is not null then
    raise exception 'Clean staging only: application tables already exist; stop and review migration history';
  end if;
  if not exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') or
     not exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_net') or
     not exists (select 1 from pg_catalog.pg_available_extensions where name = 'supabase_vault') then
    raise exception 'Required Supabase extensions are unavailable; do not continue migrations';
  end if;
  if not ('pg_cron' = any(regexp_split_to_array(current_setting('shared_preload_libraries'), '\s*,\s*'))) then
    raise exception 'pg_cron must be preloaded by the provider; enable Cron in the staging Dashboard';
  end if;
  if current_setting('cron.database_name', true) is distinct from current_database() then
    raise exception 'cron.database_name must match the connected database';
  end if;
end;
$$;

create schema if not exists extensions;
create schema if not exists vault;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_cron' and n.nspname = 'pg_catalog'
  ) then
    raise exception 'pg_cron has an unexpected schema; never drop or relocate it automatically';
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is null or
     to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null or
     to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null or
     to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Cron/pg_net/Vault API incompatible with the historical worker migration';
  end if;
  if exists (select 1 from vault.secrets where name in (
    'focusedu_project_url', 'focusedu_publishable_key', 'focusedu_discord_worker_secret'
  )) then
    raise exception 'Clean staging only: worker Vault configuration already exists; stop and review';
  end if;
end;
$$;
commit;

select e.extname, e.extversion, n.nspname as extension_schema
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pg_cron', 'pg_net', 'supabase_vault')
order by e.extname;
