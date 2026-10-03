-- Read-only catalog assertions: execute with a privileged staging connection.
begin;
do $$
declare t record;
declare f record;
declare c record;
declare browser_functions text[] := array[
  'update_my_profile', 'create_community_project', 'create_project_from_template', 'replicate_project',
  'update_project', 'transition_project', 'create_planned_project_from_template', 'replicate_planned_project',
  'create_planned_community_project', 'update_project_with_plan', 'admin_overview', 'admin_users',
  'admin_set_user', 'admin_settings', 'admin_update_settings', 'admin_projects', 'moderate_project',
  'resubmit_project', 'admin_audit_recent', 'admin_templates', 'admin_template_skills',
  'admin_save_template', 'admin_set_template_archived', 'discord_request_resync', 'discord_retry_event',
  'admin_discord_overview', 'request_project_join', 'decide_project_join_request',
  'cancel_project_join_request', 'leave_project', 'get_project_discord_readiness', 'get_my_gamification'
];
begin
  for t in select oid, relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
  loop
    if not t.relrowsecurity then raise exception 'RLS disabled: %', t.relname; end if;
    if has_table_privilege('anon', t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'ANON table grant: %', t.relname;
    end if;
    if has_table_privilege('authenticated', t.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'Unexpected authenticated table write: %', t.relname;
    end if;
    for c in select attname, attnum from pg_attribute
      where attrelid = t.oid and attnum > 0 and not attisdropped
    loop
      if has_column_privilege('anon', t.oid, c.attnum, 'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'ANON column grant: %.%', t.relname, c.attname;
      end if;
      if has_column_privilege('authenticated', t.oid, c.attnum, 'INSERT,REFERENCES') or
        (has_column_privilege('authenticated', t.oid, c.attnum, 'UPDATE') and not
          (t.relname = 'profiles' and c.attname = any(array['name','avatar_url','bio','main_role',
            'secondary_roles','availability','interests','github_url','linkedin_url']))) then
        raise exception 'Unexpected column write: %.%', t.relname, c.attname;
      end if;
    end loop;
    if t.relname in ('platform_settings', 'admin_audit_log') and
      has_table_privilege('authenticated', t.oid, 'SELECT') then
      raise exception 'Privileged read exposed: %', t.relname;
    end if;
  end loop;
  for f in
  select
    p.oid,
    p.proname,
    n.nspname,
    p.prosecdef,
    p.proconfig,
    (
      n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
      and pg_get_function_result(p.oid) = 'event_trigger'
      and coalesce('search_path=pg_catalog' = any(p.proconfig), false)
      and exists (
        select 1
        from pg_event_trigger e
        where e.evtfoid = p.oid
          and e.evtname = 'ensure_rls'
      )
    ) as managed_rls_auto_enable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prokind = 'f'
loop
  if f.prosecdef
    and not coalesce('search_path=""' = any(f.proconfig), false)
    and not f.managed_rls_auto_enable
  then
    raise exception 'Unsafe definer search_path: %.%', f.nspname, f.proname;
  end if;

  if has_function_privilege('anon', f.oid, 'EXECUTE')
    and not f.managed_rls_auto_enable
  then
    raise exception 'ANON execute exposed: %.%', f.nspname, f.proname;
  end if;

  if has_function_privilege('authenticated', f.oid, 'EXECUTE')
    and not (
      f.managed_rls_auto_enable
      or (f.nspname = 'public' and f.proname = any(browser_functions))
      or (f.nspname = 'private' and f.proname in ('is_admin', 'is_staff'))
    )
  then
    raise exception 'Unexpected browser execute: %.%', f.nspname, f.proname;
  end if;
end loop;
end $$;
select c.relname as table_name, c.relrowsecurity as rls,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
order by c.relname;
rollback;
