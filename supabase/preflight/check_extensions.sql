-- Read-only: never selects decrypted secret values or submits HTTP requests.
begin read only;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_cron' and n.nspname = 'pg_catalog'
  ) or not exists (select 1 from pg_catalog.pg_extension where extname = 'pg_net') or
     not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    raise exception 'Required extensions missing or pg_cron schema incorrect';
  end if;
  if to_regprocedure('cron.schedule(text,text,text)') is null or
     to_regprocedure('cron.alter_job(bigint,text,text,text,text,boolean)') is null or
     to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null or
     to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Required worker SQL APIs missing';
  end if;
  if not has_function_privilege(current_user, 'cron.schedule(text,text,text)', 'EXECUTE') or
     not has_function_privilege(current_user, 'cron.alter_job(bigint,text,text,text,text,boolean)', 'EXECUTE') or
     not has_function_privilege(current_user, 'net.http_post(text,jsonb,jsonb,jsonb,integer)', 'EXECUTE') or
     not has_table_privilege(current_user, 'vault.decrypted_secrets', 'SELECT') then
    raise exception 'Operator cannot use the required worker SQL APIs';
  end if;
  if to_regclass('public.projects') is not null then
    if (select count(*) from cron.job where jobname = 'focusedu-discord-events-worker') <> 1 then
      raise exception 'Expected exactly one Discord worker job after migrations';
    end if;
    if exists (select 1 from cron.job where jobname = 'focusedu-discord-events-worker' and active) then
      raise exception 'Pause the Discord worker until Edge/Vault configuration is validated';
    end if;
  end if;
end;
$$;
select e.extname, e.extversion, n.nspname as extension_schema
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pg_cron', 'pg_net', 'supabase_vault')
order by e.extname;
select current_database(), current_setting('cron.database_name', true) as cron_database;
select jobid, jobname, schedule, active from cron.job
where jobname = 'focusedu-discord-events-worker';
rollback;
