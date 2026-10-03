begin;
create temp table admin_smoke_baseline(user_count bigint) on commit drop;
insert into admin_smoke_baseline select count(*) from public.platform_accounts;
grant select on admin_smoke_baseline to authenticated;
create temp table admin_smoke_ids(project_id uuid) on commit drop;
grant select, insert on admin_smoke_ids to authenticated;

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'member-a@example.test', '{"name":"Member A"}'),
  ('10000000-0000-4000-8000-000000000002', 'member-b@example.test', '{"name":"Member B"}'),
  ('10000000-0000-4000-8000-000000000003', 'moderator@example.test', '{"name":"Moderator"}'),
  ('10000000-0000-4000-8000-000000000004', 'admin@example.test', '{"name":"Admin"}');

update public.platform_accounts set platform_role = 'MODERATOR'
where user_id = '10000000-0000-4000-8000-000000000003';
update public.platform_accounts set platform_role = 'ADMIN'
where user_id = '10000000-0000-4000-8000-000000000004';
insert into public.user_integrations(user_id, provider, provider_user_id) values
  ('10000000-0000-4000-8000-000000000002', 'discord', '320000000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
declare first_project uuid;
declare second_project uuid;
declare third_project uuid;
begin
  first_project := public.create_planned_community_project('Teste A', 'Descrição A', 'Comunidade', 5,
    'Misto', '', '[]', '{}', array['Backend'], '{}', '{}', null, null, 'Backend');
  insert into admin_smoke_ids values (first_project);
  if not exists (select 1 from public.projects where id = first_project and moderation_status = 'PENDING') then
    raise exception 'Community Project não começou pendente';
  end if;
  if not exists (select 1 from public.project_members where project_id = first_project and user_id = auth.uid()) then
    raise exception 'Owner não é membro da squad';
  end if;
  begin
    perform public.moderate_project(first_project, 'APPROVED', null);
    raise exception 'MEMBER aprovou projeto';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.projects set moderation_status = 'APPROVED' where id = first_project;
    raise exception 'MEMBER alterou moderação diretamente';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_save_template(null, '{"name":"Invasão","description":"Teste","difficulty":"Misto","recommended_max_members":5}'::jsonb);
    raise exception 'MEMBER criou template oficial';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_accounts set platform_role = 'ADMIN' where user_id = auth.uid();
    raise exception 'MEMBER promoveu próprio papel';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.platform_settings set max_project_creations_per_day = 50;
    raise exception 'MEMBER alterou settings';
  exception when insufficient_privilege then null;
  end;

  second_project := public.create_planned_project_from_template('00000000-0000-4000-8000-000000000001', null, null, 'Backend');
  third_project := public.create_planned_project_from_template('00000000-0000-4000-8000-000000000002', null, null, 'QA');
  begin
    perform public.create_planned_project_from_template('00000000-0000-4000-8000-000000000003', null, null, 'Backend');
    raise exception 'Limite de ownership não funcionou';
  exception when others then
    if sqlerrm not like 'OWNED_PROJECT_LIMIT:%' then raise; end if;
  end;
  perform public.transition_project(second_project, 'CANCELLED');
  begin
    perform public.create_planned_project_from_template('00000000-0000-4000-8000-000000000003', null, null, 'Backend');
    raise exception 'Limite de 24h não funcionou';
  exception when others then
    if sqlerrm not like 'DAILY_PROJECT_LIMIT:%' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.projects where owner_id = '10000000-0000-4000-8000-000000000001' and moderation_status = 'PENDING') then
    raise exception 'MEMBER B leu projeto pendente de A';
  end if;
  if exists (select 1 from public.project_members where project_id in
    (select id from public.projects where owner_id = '10000000-0000-4000-8000-000000000001' and moderation_status = 'PENDING')) then
    raise exception 'MEMBER B leu membros de projeto pendente';
  end if;
  begin
    perform public.replicate_project((select project_id from admin_smoke_ids limit 1), 'Backend');
    raise exception 'MEMBER B replicou projeto pendente de A';
  exception when others then
    if sqlerrm <> 'Projeto indisponível' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$
declare pending_id uuid;
begin
  select id into pending_id from public.projects where owner_id = '10000000-0000-4000-8000-000000000001' and moderation_status = 'PENDING' limit 1;
  if pending_id is null then raise exception 'MODERATOR não leu pendente'; end if;
  perform public.moderate_project(pending_id, 'APPROVED', null);
  begin
    perform public.admin_set_user('10000000-0000-4000-8000-000000000002', 'MODERATOR', null, null);
    raise exception 'MODERATOR alterou papel';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_update_settings(3, 3, 5);
    raise exception 'MODERATOR alterou settings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_overview();
    raise exception 'MODERATOR leu visão administrativa';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare project_id uuid;
begin
  select admin_smoke_ids.project_id into project_id from admin_smoke_ids limit 1;
  perform public.update_project(project_id, 'Teste A editado', 'Descrição A', 'Objetivo', 5, '', '[]', '{}', array['Backend']);
  if not exists (select 1 from public.projects where id = project_id and moderation_status = 'PENDING') then
    raise exception 'Edição de aprovado não voltou à revisão';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select public.moderate_project((select project_id from admin_smoke_ids limit 1), 'REJECTED', 'Ajustar descrição');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
declare project_id uuid;
begin
  select admin_smoke_ids.project_id into project_id from admin_smoke_ids limit 1;
  begin
    perform public.resubmit_project(project_id);
    raise exception 'Reenvio sem edição foi aceito';
  exception when others then
    if sqlerrm <> 'Edite o projeto antes de reenviar' then raise; end if;
  end;
  perform public.update_project(project_id, 'Teste A corrigido', 'Descrição melhorada', 'Objetivo', 5, '', '[]', '{}', array['Backend']);
  perform public.resubmit_project(project_id);
  if not exists (select 1 from public.projects where id = project_id and moderation_status = 'PENDING') then
    raise exception 'Reenvio não ficou pendente';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select public.moderate_project((select project_id from admin_smoke_ids limit 1), 'APPROVED');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
do $$
declare template_id uuid;
begin
  if (public.admin_overview()->>'users')::integer <> (select user_count + 4 from admin_smoke_baseline) then
    raise exception 'Contagem admin incorreta';
  end if;
  perform public.admin_update_settings(4, 10, 1);
  if (public.admin_settings()->>'max_projects_joined_simultaneously')::integer <> 1 then
    raise exception 'Settings não aplicados';
  end if;
  begin
    perform public.admin_update_settings(-1, 3, 5);
    raise exception 'Settings inválidos aceitos';
  exception when others then
    if sqlerrm <> 'Limites devem ser inteiros entre 0 e 50' then raise; end if;
  end;
  begin
    perform public.admin_set_user(auth.uid(), 'MEMBER', null, null);
    raise exception 'Último ADMIN removido';
  exception when others then
    if sqlerrm not like 'Conta ADMIN protegida%' then raise; end if;
  end;
  template_id := public.admin_save_template(null, '{"name":"Teste oficial","description":"Escopo Focus","difficulty":"Misto","recommended_max_members":5}'::jsonb);
  perform public.admin_set_template_archived(template_id, true);
  if not exists (select 1 from public.admin_templates() where id = template_id and archived) then raise exception 'Template não arquivado'; end if;
  perform public.admin_set_template_archived(template_id, false);
  if (select count(*) from public.admin_audit_recent()) < 4 then raise exception 'Auditoria incompleta'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
declare first_id uuid;
declare second_id uuid;
declare request_id uuid;
begin
  select project_id into first_id from admin_smoke_ids limit 1;
  select id into second_id from public.projects where owner_id = '10000000-0000-4000-8000-000000000001'
    and id <> first_id and status = 'FORMING' and moderation_status = 'APPROVED' limit 1;
  request_id := public.request_project_join(first_id, 'Backend');
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
  perform public.decide_project_join_request(request_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
  begin
    perform public.request_project_join(second_id, 'QA');
    raise exception 'Limite de participação não funcionou';
  exception when others then
    if sqlerrm not like 'JOINED_PROJECT_LIMIT:%' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select public.admin_set_user('10000000-0000-4000-8000-000000000002', null, 'SUSPENDED', 'Teste de suspensão');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
begin
  begin
    perform public.create_planned_project_from_template('00000000-0000-4000-8000-000000000001', null, null, 'Backend');
    raise exception 'SUSPENDED criou projeto';
  exception when others then
    if sqlerrm <> 'ACCOUNT_SUSPENDED' then raise; end if;
  end;
  begin
    perform public.request_project_join(
      (select id from public.projects where moderation_status = 'APPROVED' and status = 'FORMING' limit 1), 'Backend');
    raise exception 'SUSPENDED entrou em squad';
  exception when others then
    if sqlerrm <> 'ACCOUNT_SUSPENDED' then raise; end if;
  end;
end;
$$;

reset role;
rollback;
