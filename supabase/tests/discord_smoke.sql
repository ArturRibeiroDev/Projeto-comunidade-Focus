begin;
create temp table discord_test_ids(person text primary key, id uuid not null) on commit drop;
insert into discord_test_ids values
  ('owner', gen_random_uuid()), ('other', gen_random_uuid()), ('moderator', gen_random_uuid()),
  ('linked', gen_random_uuid());
grant select on discord_test_ids to authenticated;
insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', person) from discord_test_ids;
update public.platform_accounts set platform_role = 'MODERATOR'
where user_id = (select id from discord_test_ids where person = 'moderator');

insert into auth.identities(user_id, provider, provider_id, identity_data)
values ((select id from discord_test_ids where person = 'owner'), 'discord',
  '123456789012345678', '{"username":"focus_owner"}');
do $$ begin
  if (select count(*) from public.user_integrations where provider_user_id = '123456789012345678') <> 1 then
    raise exception 'Auth identity was not synchronized';
  end if;
end $$;
insert into auth.identities(user_id, provider, provider_id, identity_data)
values ((select id from discord_test_ids where person = 'linked'), 'discord',
  'legacy-provider-id', '{"sub":"234567890123456789","username":"focus_linked"}');
do $$ begin
  if (select count(*) from public.user_integrations where provider_user_id = '234567890123456789') <> 1 then
    raise exception 'Discord sub was not synchronized';
  end if;
end $$;

set local role authenticated;
do $$
declare owner_id uuid;
declare other_id uuid;
declare moderator_id uuid;
declare linked_id uuid;
declare v_project_id uuid;
declare linked_project_id uuid;
declare resync_id uuid;
begin
  select id into owner_id from discord_test_ids where person = 'owner';
  select id into other_id from discord_test_ids where person = 'other';
  select id into moderator_id from discord_test_ids where person = 'moderator';
  select id into linked_id from discord_test_ids where person = 'linked';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  if (select count(*) from public.user_integrations) <> 1 then
    raise exception 'Owner cannot read own integration';
  end if;
  begin
    insert into public.user_integrations(user_id, provider, provider_user_id)
    values (owner_id, 'discord', '999999999999999999');
    raise exception 'Browser spoofed Discord ID';
  exception when insufficient_privilege then null;
  end;

  v_project_id := public.create_community_project('Discord smoke', 'Descrição', 'Comunidade', 3,
    'Misto', '', '[]', '{}', array['Backend'], '{}', '{}', 'Backend');
  perform set_config('request.jwt.claim.sub', moderator_id::text, true);
  perform public.moderate_project(v_project_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  if (select count(*) from public.user_integrations) <> 0 then
    raise exception 'Other user read Discord integration';
  end if;
  begin
    perform public.discord_request_resync(v_project_id);
    raise exception 'Non-owner requested resync';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.discord_claim_event(v_project_id);
    raise exception 'Browser claimed event';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.transition_project(v_project_id, 'ACTIVE');
  if not exists (
    select 1 from public.user_integrations
    where user_id = owner_id and provider = 'discord'
      and provider_user_id = '123456789012345678'
  ) then
    raise exception 'OAuth Discord identity changed during project start';
  end if;
  perform public.transition_project(v_project_id, 'ACTIVE');
  if (select count(*) from public.integration_events
      where project_id = v_project_id and event_type = 'PROJECT_STARTED') <> 1 then
    raise exception 'Start event not idempotent';
  end if;
  resync_id := public.discord_request_resync(v_project_id);
  if public.discord_request_resync(v_project_id) <> resync_id then
    raise exception 'Duplicate pending resync';
  end if;
  perform public.transition_project(v_project_id, 'COMPLETED');
  perform public.transition_project(v_project_id, 'ARCHIVED');
  if not exists (
    select 1 from public.user_integrations
    where user_id = owner_id and provider = 'discord'
      and provider_user_id = '123456789012345678'
  ) then
    raise exception 'OAuth Discord identity changed during project lifecycle';
  end if;

  perform set_config('request.jwt.claim.sub', linked_id::text, true);
  linked_project_id := public.create_community_project('Linked identity project', 'Descrição',
    'Comunidade', 3, 'Misto', '', '[]', '{}', array['Backend'], '{}', '{}', 'Backend');
  perform set_config('request.jwt.claim.sub', moderator_id::text, true);
  perform public.moderate_project(linked_project_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', linked_id::text, true);
  perform public.transition_project(linked_project_id, 'ACTIVE');
  if not exists (
    select 1 from public.user_integrations
    where user_id = linked_id and provider = 'discord'
      and provider_user_id = '234567890123456789'
  ) then
    raise exception 'Linked Discord identity changed during project start';
  end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if (select count(*) from public.integration_events e where e.project_id = v_project_id) <> 4 then
    raise exception 'Lifecycle events missing: %',
      (select count(*) from public.integration_events e where e.project_id = v_project_id);
  end if;
end;
$$;
reset role;

create temp table discord_test_project as
select id from public.projects where name = 'Discord smoke';
grant select on discord_test_project to authenticated, service_role;
update public.integration_events set status = 'FAILED', last_error = 'Discord API: HTTP 503'
where project_id = (select id from discord_test_project) and event_type = 'PROJECT_STARTED';
update public.project_integrations set status = 'FAILED', last_error = 'Discord API: HTTP 503'
where project_id = (select id from discord_test_project);
set local role authenticated;
do $$
declare owner_id uuid;
declare other_id uuid;
declare event_id uuid;
begin
  select id into owner_id from discord_test_ids where person = 'owner';
  select id into other_id from discord_test_ids where person = 'other';
  select id into event_id from public.integration_events
    where project_id = (select id from discord_test_project) and event_type = 'PROJECT_STARTED';
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  begin
    perform public.discord_retry_event(event_id);
    raise exception 'Non-owner retried event';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not exists (
    select 1 from public.project_integrations
    where project_id = (select id from discord_test_project)
      and provider = 'discord' and status = 'FAILED'
  ) then
    raise exception 'Failed channel state was not isolated to project integration';
  end if;
  if not exists (
    select 1 from public.user_integrations
    where user_id = owner_id and provider = 'discord'
      and provider_user_id = '123456789012345678'
  ) then
    raise exception 'Failed project sync altered the owner Discord identity';
  end if;
  perform public.discord_retry_event(event_id);
  if (select status from public.integration_events where id = event_id) <> 'PENDING' then
    raise exception 'Owner retry did not queue event';
  end if;
end;
$$;
reset role;
set local role service_role;
do $$
declare claimed jsonb;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  claimed := public.discord_claim_event((select id from discord_test_project));
  if claimed is null or claimed->>'status' <> 'PROCESSING' then
    raise exception 'Service role did not claim event';
  end if;
end;
$$;
reset role;

delete from auth.identities where provider_id = '123456789012345678';
do $$ begin
  if exists (select 1 from public.user_integrations where provider_user_id = '123456789012345678') then
    raise exception 'Unlinked identity was retained';
  end if;
end $$;
rollback;
