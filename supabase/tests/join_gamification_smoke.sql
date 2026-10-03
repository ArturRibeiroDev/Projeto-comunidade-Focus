-- Runs against a development database; all test records are rolled back.
begin;
create temp table focusedu_join_ids (person text primary key, id uuid not null) on commit drop;
insert into focusedu_join_ids(person, id)
values ('owner', gen_random_uuid()), ('candidate', gen_random_uuid()), ('missing_discord', gen_random_uuid());
grant select on focusedu_join_ids to authenticated;

insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', 'FocusEdu Join Test') from focusedu_join_ids;
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', case person
  when 'owner' then '200000000000000001'
  when 'candidate' then '200000000000000002'
end
from focusedu_join_ids
where person in ('owner', 'candidate');

set local role authenticated;

do $$
declare
  owner_id uuid;
  candidate_id uuid;
  missing_id uuid;
  template_id uuid;
  v_project_id uuid;
  request_id uuid;
begin
  select id into owner_id from focusedu_join_ids where person = 'owner';
  select id into candidate_id from focusedu_join_ids where person = 'candidate';
  select id into missing_id from focusedu_join_ids where person = 'missing_discord';
  select id into template_id from public.project_templates where name = 'Sistema de Biblioteca';

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  v_project_id := public.create_project_from_template(template_id, 'Backend');
  perform public.update_project(v_project_id, 'Squad com vaga', 'Descricao atualizada', 'Objetivo', 2,
    '', '[]', '{}', array['Backend', 'QA']);

  perform set_config('request.jwt.claim.sub', missing_id::text, true);
  begin
    perform public.request_project_join(v_project_id, 'QA', '');
    raise exception 'Request without Discord succeeded';
  exception when others then
    if sqlerrm != 'DISCORD_REQUIRED' then raise; end if;
  end;

  begin
    insert into public.project_members(project_id, main_role) values (v_project_id, 'QA');
    raise exception 'Direct project_members insert succeeded';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', candidate_id::text, true);
  request_id := public.request_project_join(v_project_id, 'Backend', 'Quero contribuir.');
  begin
    perform public.request_project_join(v_project_id, 'Backend', 'Duplicada.');
    raise exception 'Duplicate pending request succeeded';
  exception when others then
    if sqlerrm != 'JOIN_REQUEST_PENDING' then raise; end if;
  end;
  begin
    perform public.decide_project_join_request(request_id, 'APPROVED');
    raise exception 'Member approved own request';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.decide_project_join_request(request_id, 'APPROVED');
  if not exists (
    select 1 from public.project_members where project_id = v_project_id and user_id = candidate_id
  ) then
    raise exception 'Approval did not create membership';
  end if;
  perform public.transition_project(v_project_id, 'ACTIVE');
  perform public.transition_project(v_project_id, 'COMPLETED');
  perform public.transition_project(v_project_id, 'COMPLETED');
  perform set_config('request.jwt.claim.sub', candidate_id::text, true);
  if (
    select coalesce(sum(points), 0)
    from public.gamification_events
    where user_id = candidate_id and source_id = v_project_id
  ) != 100 then
    raise exception 'Gamification points not idempotent';
  end if;
  if not exists (
    select 1 from public.user_achievements
    where user_id = candidate_id and achievement_code = 'FIRST_PROJECT'
  ) then
    raise exception 'FIRST_PROJECT achievement missing';
  end if;
  begin
    insert into public.gamification_events(user_id, event_type, points, source_type, source_id)
    values (candidate_id, 'PROJECT_COMPLETED', 100, 'project', v_project_id);
    raise exception 'Direct gamification insert succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
