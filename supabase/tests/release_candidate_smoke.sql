-- STAGING ONLY. Privileged connection; fixtures, policies and failure injection roll back.
begin;
create temp table rc_users(label text primary key, id uuid not null) on commit drop;
insert into rc_users values ('owner', gen_random_uuid()), ('candidate', gen_random_uuid()),
  ('other', gen_random_uuid()), ('admin', gen_random_uuid()), ('moderator', gen_random_uuid());
grant select on rc_users to authenticated, anon;
insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', 'RC ' || label) from rc_users;
update public.platform_accounts set platform_role = 'ADMIN' where user_id = (select id from rc_users where label = 'admin');
update public.platform_accounts set platform_role = 'MODERATOR' where user_id = (select id from rc_users where label = 'moderator');
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', '33000000000000000' || row_number() over (order by label)
from rc_users where label <> 'owner';
create temp table rc_projects(label text primary key, id uuid not null) on commit drop;
grant select, insert on rc_projects to authenticated;

set local role authenticated;
do $$
declare v_project_id uuid;
declare owner_id uuid := (select id from rc_users where label = 'owner');
declare member_id uuid := (select id from rc_users where label = 'candidate');
declare reason text;
begin
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  v_project_id := public.create_planned_project_from_template('00000000-0000-4000-8000-000000000002', null, null, 'Backend');
  insert into rc_projects values ('forming', v_project_id);
  begin
    perform public.transition_project(v_project_id, 'ACTIVE');
    raise exception 'Start without Discord succeeded';
  exception when others then
    if sqlerrm not like 'PROJECT_START_DISCORD_REQUIRED:%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  begin
    perform public.transition_project(v_project_id, 'CANCELLED', p_cancellation_reason => 'Unauthorized');
    raise exception 'MEMBER cancelled another project';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', (select id::text from rc_users where label = 'moderator'), true);
  begin
    perform public.transition_project(v_project_id, 'CANCELLED', p_cancellation_reason => 'Unauthorized');
    raise exception 'MODERATOR used global ADMIN cancel';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', (select id::text from rc_users where label = 'admin'), true);
  foreach reason in array array[null::text, '', '   '] loop
    begin
      perform public.transition_project(v_project_id, 'CANCELLED', p_cancellation_reason => reason);
      raise exception 'ADMIN cancelled without reason';
    exception when others then
      if sqlerrm <> 'ADMIN_CANCEL_REASON_REQUIRED' then raise; end if;
    end;
  end loop;
  perform public.transition_project(v_project_id, 'CANCELLED', p_cancellation_reason => 'RC audit');
  if not exists (select 1 from public.admin_audit_recent() where target_id = v_project_id::text
    and action = 'PROJECT_ADMIN_CANCELLED' and metadata->>'reason' = 'RC audit'
    and metadata->>'previous_status' = 'FORMING') then raise exception 'ADMIN cancel audit missing'; end if;
  if not exists (select 1 from public.integration_events where project_id = v_project_id
    and event_type = 'PROJECT_CANCELLED') then raise exception 'ADMIN cancel outbox missing'; end if;
end $$;
reset role;

insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', '330000000000000099' from rc_users where label = 'owner';

set local role authenticated;
do $$
declare v_owner_id uuid := (select id from rc_users where label = 'owner');
declare v_candidate_id uuid := (select id from rc_users where label = 'candidate');
declare v_other_id uuid := (select id from rc_users where label = 'other');
declare v_project_id uuid;
declare first_request uuid;
declare second_request uuid;
begin
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  v_project_id := public.create_project_from_template('00000000-0000-4000-8000-000000000002', 'Backend');
  insert into rc_projects values ('completion', v_project_id);
  perform public.update_project(v_project_id, 'RC capacity', 'RC scope', '', 3, '', '[]', '{}', '{}');
  perform set_config('request.jwt.claim.sub', v_candidate_id::text, true);
  first_request := public.request_project_join(v_project_id, 'QA');
  perform set_config('request.jwt.claim.sub', v_other_id::text, true);
  second_request := public.request_project_join(v_project_id, 'Backend');
  if exists (select 1 from public.project_join_requests where id = first_request) then
    raise exception 'Candidate read another candidate request'; end if;
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform public.update_project(v_project_id, 'RC capacity', 'RC scope', '', 2, '', '[]', '{}', '{}');
  perform public.decide_project_join_request(first_request, 'APPROVED');
  begin
    perform public.decide_project_join_request(second_request, 'APPROVED');
    raise exception 'Owner approval exceeded max_members';
  exception when others then if sqlerrm <> 'PROJECT_FULL' then raise; end if; end;
  if (select count(*) from public.project_members where project_id = v_project_id) <> 2 then
    raise exception 'Unexpected member count'; end if;
  perform public.transition_project(v_project_id, 'ACTIVE');
  if exists (select 1 from public.project_join_requests where project_id = v_project_id and status = 'PENDING') then
    raise exception 'Start left requests pending'; end if;
end $$;
reset role;

-- Catalog coverage only. Real avatar authorization requires scripts/storage-smoke.mjs.
do $$
declare expected record;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects' and c.relrowsecurity) then
    raise exception 'Storage objects RLS is disabled'; end if;
  if not exists (select 1 from storage.buckets where id = 'avatars' and public
    and file_size_limit = 2097152
    and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
    and allowed_mime_types <@ array['image/jpeg', 'image/png', 'image/webp']) then
    raise exception 'Avatar bucket configuration mismatch'; end if;
  for expected in select * from (values
    ('avatars_select_own', 'SELECT'), ('avatars_insert_own', 'INSERT'),
    ('avatars_update_own', 'UPDATE'), ('avatars_delete_own', 'DELETE')
  ) as policies(policy_name, command) loop
    if not has_table_privilege('authenticated', 'storage.objects', expected.command) then
      raise exception 'Storage authenticated grant missing: %', expected.command; end if;
    if not exists (select 1 from pg_policies p where p.schemaname = 'storage'
      and p.tablename = 'objects' and p.policyname = expected.policy_name
      and p.cmd = expected.command and p.permissive = 'PERMISSIVE'
      and 'authenticated'::name = any(p.roles)
      and (expected.command = 'INSERT' or p.qual is not null)
      and (expected.command not in ('INSERT', 'UPDATE') or p.with_check is not null)) then
      raise exception 'Avatar policy missing or incomplete: %', expected.policy_name; end if;
  end loop;
end $$;

\echo 'PENDING Storage API authorization: run node scripts/storage-smoke.mjs against confirmed staging.'

create function pg_temp.fail_gamification() returns trigger language plpgsql as $$
begin raise exception 'Injected gamification failure'; end $$;
create trigger rc_gamification_failure before insert on public.gamification_events
for each row execute function pg_temp.fail_gamification();
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from rc_users where label = 'owner'), true);
select public.transition_project((select id from rc_projects where label = 'completion'), 'COMPLETED');
do $$ begin
  if not exists (select 1 from public.projects where id = (select id from rc_projects where label = 'completion')
    and status = 'COMPLETED') then raise exception 'Gamification blocked completion'; end if;
  if not exists (select 1 from public.evidences where project_id = (select id from rc_projects where label = 'completion')
    and kind = 'completion') then raise exception 'Gamification removed evidence'; end if;
end $$;
reset role;
drop trigger rc_gamification_failure on public.gamification_events;

-- Replay remains privileged and idempotent after operational repair.
select private.award_project_completion(id, completed_at) from public.projects
where id = (select id from rc_projects where label = 'completion');
select private.award_project_completion(id, completed_at) from public.projects
where id = (select id from rc_projects where label = 'completion');
do $$ begin
  if (select count(*) from public.gamification_events where source_id =
    (select id from rc_projects where label = 'completion')) <> 2 then
    raise exception 'Gamification replay duplicated or lost events'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform public.admin_overview(); raise exception 'ANON accessed ADMIN';
  exception when insufficient_privilege then null; end;
  begin perform public.get_my_gamification(); raise exception 'ANON accessed gamification';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.profiles; raise exception 'ANON read profiles';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
