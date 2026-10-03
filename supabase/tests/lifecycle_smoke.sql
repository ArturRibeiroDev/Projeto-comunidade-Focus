-- Runs against a development database; all test records are rolled back.
begin;
create temp table focusedu_lifecycle_ids (person text primary key, id uuid not null) on commit drop;
insert into focusedu_lifecycle_ids(person, id)
values ('a', gen_random_uuid()), ('b', gen_random_uuid()), ('c', gen_random_uuid()), ('moderator', gen_random_uuid());
grant select on focusedu_lifecycle_ids to authenticated;
insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', 'FocusEdu Lifecycle Test') from focusedu_lifecycle_ids;
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', case person
  when 'a' then '100000000000000001'
  when 'b' then '100000000000000002'
  when 'c' then '100000000000000003'
  else '100000000000000004'
end
from focusedu_lifecycle_ids;
update public.platform_accounts set platform_role = 'MODERATOR'
where user_id = (select id from focusedu_lifecycle_ids where person = 'moderator');
set local role authenticated;

do $$
declare
  a uuid;
  b uuid;
  c uuid;
  moderator_id uuid;
  v_template_id uuid;
  v_project_id uuid;
  v_community_id uuid;
begin
  select id into a from focusedu_lifecycle_ids where person = 'a';
  select id into b from focusedu_lifecycle_ids where person = 'b';
  select id into c from focusedu_lifecycle_ids where person = 'c';
  select id into moderator_id from focusedu_lifecycle_ids where person = 'moderator';
  select id into v_template_id from public.project_templates where name = 'Sistema de Biblioteca';
  perform set_config('request.jwt.claim.sub', a::text, true);

  v_project_id := public.create_project_from_template(v_template_id, 'Backend');
  if not exists (select 1 from public.projects where id = v_project_id and status = 'FORMING' and owner_id = a) then
    raise exception 'Template execution did not start in FORMING';
  end if;
  begin
    update public.projects set name = 'Direct update' where id = v_project_id;
    raise exception 'Authenticated client updated project directly';
  exception when insufficient_privilege then null;
  end;
  perform public.update_project(v_project_id, 'Biblioteca da squad', 'Descrição atualizada', 'Objetivo', 3,
    '5 semanas', '[{"role":"QA","amount":1}]'::jsonb, array['TypeScript'], array['Backend','QA']);
  if not exists (select 1 from public.projects where id = v_project_id and name = 'Biblioteca da squad' and objective = 'Objetivo') then
    raise exception 'FORMING edit failed';
  end if;
  if not exists (select 1 from public.project_technologies where project_id = v_project_id) then
    raise exception 'Technology edit failed';
  end if;

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform public.request_project_join(v_project_id, 'Backend', 'Quero contribuir com APIs.');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.decide_project_join_request(
    (select id from public.project_join_requests where project_id = v_project_id and user_id = b),
    'APPROVED'
  );
  perform set_config('request.jwt.claim.sub', b::text, true);
  begin
    perform public.update_project(v_project_id, 'Unauthorized', 'Unauthorized', '', 3, '5 semanas', '[]', '{}', '{}');
    raise exception 'Member edited owner project';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.transition_project(v_project_id, 'ACTIVE');
    raise exception 'Member started owner project';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.transition_project(v_project_id, 'ACTIVE');
  if not exists (select 1 from public.projects where id = v_project_id and status = 'ACTIVE' and started_at is not null) then
    raise exception 'Start transition failed';
  end if;
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.request_project_join(v_project_id, 'QA', '');
    raise exception 'ACTIVE accepted a public join';
  exception when others then
    if sqlerrm != 'PROJECT_NOT_FORMING' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', b::text, true);
  begin
    perform public.leave_project(v_project_id);
    raise exception 'ACTIVE allowed silent leave';
  exception when others then
    if sqlerrm not like 'Este projeto já está em andamento%' then raise; end if;
  end;
  begin
    perform public.transition_project(v_project_id, 'COMPLETED');
    raise exception 'Member completed owner project';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.transition_project(v_project_id, 'COMPLETED', 'https://example.com/repo',
    'https://example.com/demo', 'Entrega validada');
  perform public.transition_project(v_project_id, 'COMPLETED');
  if not exists (select 1 from public.projects where id = v_project_id and status = 'COMPLETED' and
    completed_at is not null and repository_url = 'https://example.com/repo') then
    raise exception 'Completion details missing';
  end if;
  if (select count(*) from public.evidences where project_id = v_project_id and user_id = a and kind = 'completion') != 1 then
    raise exception 'Owner completion evidence missing or duplicated';
  end if;
  perform set_config('request.jwt.claim.sub', b::text, true);
  if (select count(*) from public.evidences where project_id = v_project_id and user_id = b and kind = 'completion' and role = 'Backend') != 1 then
    raise exception 'Member completion evidence missing or duplicated';
  end if;
  begin
    perform public.transition_project(v_project_id, 'ARCHIVED');
    raise exception 'Member archived owner project';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.transition_project(v_project_id, 'ARCHIVED');
  if not exists (select 1 from public.projects where id = v_project_id and status = 'ARCHIVED' and archived_at is not null) then
    raise exception 'Archive transition failed';
  end if;
  begin
    perform public.transition_project(v_project_id, 'ACTIVE');
    raise exception 'ARCHIVED reopened';
  exception when others then
    if sqlerrm != 'Transicao de projeto invalida' then raise; end if;
  end;

  v_community_id := public.create_community_project('Projeto teste', 'Descrição', 'Comunidade', 2,
    'Misto', '4 semanas', '[]', array['PostgreSQL'], array['QA'], array['PostgreSQL'], array['Entrega'], 'QA');
  perform public.transition_project(v_community_id, 'CANCELLED', p_cancellation_reason => 'Escopo suspenso');
  if not exists (select 1 from public.projects where id = v_community_id and status = 'CANCELLED' and
    cancelled_at is not null and cancellation_reason = 'Escopo suspenso') then
    raise exception 'Cancellation transition failed';
  end if;
  if exists (select 1 from public.evidences where project_id = v_community_id and kind = 'completion') then
    raise exception 'Cancellation created completion evidence';
  end if;
  perform public.transition_project(v_community_id, 'ARCHIVED');

  v_community_id := public.create_community_project('Projeto em execução', 'Descrição', 'Comunidade', 2,
    'Misto', '4 semanas', '[]', array['PostgreSQL'], array['QA'], array['PostgreSQL'], array['Entrega'], 'QA');
  perform set_config('request.jwt.claim.sub', moderator_id::text, true);
  perform public.moderate_project(v_community_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.transition_project(v_community_id, 'ACTIVE');
  perform public.transition_project(v_community_id, 'CANCELLED', p_cancellation_reason => 'Execução interrompida');
  if not exists (select 1 from public.projects where id = v_community_id and status = 'CANCELLED' and
    started_at is not null and cancelled_at is not null) then
    raise exception 'ACTIVE cancellation failed';
  end if;
end;
$$;

reset role;
rollback;
