begin;
create temp table participation_role_ids(person text primary key, id uuid not null) on commit drop;
insert into participation_role_ids values
  ('template_owner', gen_random_uuid()), ('community_owner', gen_random_uuid()),
  ('replica_owner', gen_random_uuid()), ('candidate', gen_random_uuid()),
  ('no_discord', gen_random_uuid());
grant select on participation_role_ids to authenticated;
insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', person) from participation_role_ids;
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', '35000000000000000' || row_number() over (order by person)
from participation_role_ids where person <> 'no_discord';
update public.profiles set main_role = 'Outra'
where id = (select id from participation_role_ids where person = 'template_owner');

set local role authenticated;
do $$
declare
  template_owner uuid;
  community_owner uuid;
  replica_owner uuid;
  candidate uuid;
  no_discord uuid;
  template_project uuid;
  community_project uuid;
  replica_project uuid;
  request_id uuid;
begin
  if not exists (
    select 1
    from public.project_templates template
    join public.project_template_areas link on link.template_id = template.id
    join public.skills area on area.id = link.skill_id and area.kind = 'area'
    where template.id = '00000000-0000-4000-8000-000000000006'::uuid
      and template.name = 'Dashboard de Dados Públicos'
      and template.official
      and area.name = 'Backend'
  ) then
    raise exception 'Dashboard de Dados Públicos does not offer Backend';
  end if;

  select id into template_owner from participation_role_ids where person = 'template_owner';
  select id into community_owner from participation_role_ids where person = 'community_owner';
  select id into replica_owner from participation_role_ids where person = 'replica_owner';
  select id into candidate from participation_role_ids where person = 'candidate';
  select id into no_discord from participation_role_ids where person = 'no_discord';

  if has_function_privilege('authenticated', 'public.create_project_from_template(uuid)'::regprocedure, 'EXECUTE') or
     has_function_privilege('authenticated', 'public.replicate_project(uuid)'::regprocedure, 'EXECUTE') or
     has_function_privilege('authenticated', 'public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[])'::regprocedure, 'EXECUTE') then
    raise exception 'Legacy creation RPC remains executable by authenticated users';
  end if;

  perform set_config('request.jwt.claim.sub', template_owner::text, true);
  template_project := public.create_planned_project_from_template(
    '00000000-0000-4000-8000-000000000006', null, null, 'Backend');
  if not exists (select 1 from public.projects where id = template_project and owner_id = template_owner) or
     not exists (select 1 from public.project_members where project_id = template_project
       and user_id = template_owner and main_role = 'Backend') then
    raise exception 'Template owner role/membership was not preserved';
  end if;
  begin
    perform public.create_planned_project_from_template(
      '00000000-0000-4000-8000-000000000006', null, null, 'Outra');
    raise exception 'Template accepted an unconfigured owner role';
  exception when others then
    if sqlerrm <> 'INVALID_PROJECT_ROLE' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', community_owner::text, true);
  community_project := public.create_planned_community_project(
    'Role smoke community', 'Temporary', 'Test', 4, 'Misto', '', '[]'::jsonb,
    '{}', array['Backend', 'QA'], '{}', '{}', null, null, 'QA');
  if not exists (select 1 from public.project_members where project_id = community_project
    and user_id = community_owner and main_role = 'QA') then
    raise exception 'Community owner role/membership was not preserved';
  end if;
  begin
    perform public.create_planned_community_project(
      'Invalid role community', 'Temporary', 'Test', 4, 'Misto', '', '[]'::jsonb,
      '{}', array['Backend'], '{}', '{}', null, null, 'Outra');
    raise exception 'Community project accepted arbitrary area/role';
  exception when others then
    if sqlerrm <> 'INVALID_PROJECT_ROLE' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', replica_owner::text, true);
  replica_project := public.replicate_planned_project(template_project, null, null, 'Backend');
  if not exists (select 1 from public.projects where id = replica_project and owner_id = replica_owner) or
     not exists (select 1 from public.project_members where project_id = replica_project
       and user_id = replica_owner and main_role = 'Backend') then
    raise exception 'Replicated project owner role/membership was not preserved';
  end if;

  perform set_config('request.jwt.claim.sub', no_discord::text, true);
  begin
    perform public.request_project_join(template_project, 'Backend');
    raise exception 'Join request without Discord succeeded';
  exception when others then
    if sqlerrm <> 'DISCORD_REQUIRED' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', candidate::text, true);
  request_id := public.request_project_join(template_project, 'backend', 'Role validation smoke');
  if not exists (select 1 from public.project_join_requests
    where id = request_id and main_role = 'Backend') then
    raise exception 'Join request did not store canonical project role';
  end if;
  begin
    perform public.request_project_join(template_project, 'Arbitrary job title');
    raise exception 'Join request accepted arbitrary role';
  exception when others then
    if sqlerrm <> 'INVALID_PROJECT_ROLE' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', template_owner::text, true);
  perform public.decide_project_join_request(request_id, 'APPROVED');
  if not exists (select 1 from public.project_members
    where project_id = template_project and user_id = candidate and main_role = 'Backend') then
    raise exception 'Approval did not preserve validated role';
  end if;
  perform public.transition_project(template_project, 'ACTIVE');
  if not exists (select 1 from public.projects where id = template_project and status = 'ACTIVE') then
    raise exception 'Lifecycle start failed after role validation';
  end if;
end;
$$;
reset role;
rollback;
