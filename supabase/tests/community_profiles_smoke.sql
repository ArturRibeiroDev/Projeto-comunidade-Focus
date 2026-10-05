begin;
create temp table community_fixture(person text primary key, id uuid, member_key uuid) on commit drop;
insert into community_fixture(person, id) select 'Community smoke ' || lpad(i::text, 2, '0'), gen_random_uuid() from generate_series(1, 23) i;
insert into auth.users(id, raw_user_meta_data) select id, jsonb_build_object('name', person) from community_fixture;
update community_fixture f set member_key = p.community_id from public.profiles p where p.id = f.id;
grant select on community_fixture to authenticated;
update public.profiles set bio = 'Public bio', interests = array['APIs']
where id = (select id from community_fixture where person = 'Community smoke 02');
insert into public.profile_skills(profile_id, skill_id)
select f.id, s.id from community_fixture f cross join public.skills s
where f.person = 'Community smoke 02' and s.kind = 'area' and s.name = 'Backend';
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', '987654321012345678' from community_fixture where person = 'Community smoke 02';
set local role authenticated;
do $$
declare target uuid; reader uuid; member_key uuid; official uuid; pending uuid; response jsonb; page jsonb;
begin
  select f.id, f.member_key into target, member_key from community_fixture f where person = 'Community smoke 02';
  select id into reader from community_fixture where person = 'Community smoke 01';
  perform set_config('request.jwt.claim.sub', target::text, true);
  official := public.create_planned_project_from_template('00000000-0000-4000-8000-000000000006', null, null, 'Backend');
  perform public.transition_project(official, 'ACTIVE');
  perform public.transition_project(official, 'COMPLETED');
  pending := public.create_planned_community_project('PRIVATE_PENDING_NAME', 'Temporary', 'Test', 4, 'Misto', '', '[]'::jsonb,
    '{}', array['Backend'], '{}', '{}', null, null, 'Backend');
  perform set_config('request.jwt.claim.sub', reader::text, true);
  page := public.list_community_members('Community smoke', '', '', 0);
  if jsonb_array_length(page->'members') <> 20 or not (page->>'hasMore')::boolean then
    raise exception 'Community pagination did not cap the first page';
  end if;
  page := public.list_community_members('Community smoke', '', '', 1);
  if jsonb_array_length(page->'members') <> 3 or (page->>'hasMore')::boolean then
    raise exception 'Community pagination did not return remaining members';
  end if;
  page := public.list_community_members('Community smoke', 'Backend', 'APIs', 0);
  if jsonb_array_length(page->'members') <> 1 then raise exception 'Community filters failed'; end if;
  if page::text like '%' || target::text || '%' or
     (page->'members'->0) ?| array['email','user_id','id','platform_role','account_status','provider_user_id'] then
    raise exception 'Private data leaked in community list';
  end if;
  response := public.get_community_member(member_key);
  if response->>'name' <> 'Community smoke 02' or not (response->>'discordConnected')::boolean then
    raise exception 'Public profile missing community fields';
  end if;
  if response::text like '%' || target::text || '%' or response::text like '%987654321012345678%' or
     response::text like '%PRIVATE_PENDING_NAME%' or response ?| array['email','user_id','id','platform_role','account_status','provider_user_id'] then
    raise exception 'Private profile data leaked';
  end if;
  if exists(select 1 from jsonb_object_keys(response) k where k <> all(array[
    'memberKey','name','avatarUrl','primaryRole','bio','interests','areas','technologies','links','discordConnected','projects','evidence'])) then
    raise exception 'Unexpected public profile field';
  end if;
  if jsonb_array_length(response->'projects') <> 1 or jsonb_array_length(response->'evidence') <> 2 then
    raise exception 'Approved project history missing or private history exposed';
  end if;
  if exists(select 1 from public.evidences where user_id = target) or
     exists(select 1 from public.user_integrations where user_id = target) or
     exists(select 1 from public.projects where id = pending) then
    raise exception 'Private-table RLS was broadened';
  end if;
  if public.get_community_member(target) is not null then raise exception 'Auth UUID accepted as public key'; end if;
  begin
    perform public.list_community_members('', '', '', -1);
    raise exception 'Negative page accepted';
  exception when others then if sqlerrm <> 'INVALID_COMMUNITY_FILTER' then raise; end if; end;
  if has_function_privilege('anon', 'public.get_community_member(uuid)', 'EXECUTE') or
    has_function_privilege('anon', 'public.list_community_members(text,text,text,integer)', 'EXECUTE') then
    raise exception 'Anonymous community access';
  end if;
end $$;
reset role;
update public.platform_accounts set account_status = 'SUSPENDED'
where user_id = (select id from community_fixture where person = 'Community smoke 02');
set local role authenticated;
do $$
declare member_key uuid;
begin
  select f.member_key into member_key from community_fixture f where person = 'Community smoke 02';
  if public.get_community_member(member_key) is not null then raise exception 'Suspended profile exposed'; end if;
end $$;
reset role;
rollback;
