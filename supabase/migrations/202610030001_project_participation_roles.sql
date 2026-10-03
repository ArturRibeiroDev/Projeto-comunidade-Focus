create function private.canonical_area_list(p_areas text[])
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare result text[];
begin
  if coalesce(cardinality(p_areas), 0) = 0 or cardinality(p_areas) > 30 then
    raise exception 'INVALID_PROJECT_AREAS';
  end if;
  select array_agg(area.name order by requested.ordinality)
    into result
  from unnest(p_areas) with ordinality requested(value, ordinality)
  join public.skills area on area.kind = 'area' and lower(area.name) = lower(trim(requested.value));
  if cardinality(result) is distinct from cardinality(p_areas) then
    raise exception 'INVALID_PROJECT_AREAS';
  end if;
  return result;
end;
$$;

create function private.require_project_area_role(p_project_id uuid, p_role text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare result text;
begin
  select area.name into result
  from public.project_areas link
  join public.skills area on area.id = link.skill_id and area.kind = 'area'
  where link.project_id = p_project_id and lower(area.name) = lower(trim(coalesce(p_role, '')))
  limit 1;
  if result is null then raise exception 'INVALID_PROJECT_ROLE'; end if;
  return result;
end;
$$;

create function public.create_project_from_template(p_template_id uuid, p_owner_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.project_templates%rowtype;
declare new_project_id uuid;
declare canonical_role text;
begin
  perform private.require_active();
  select * into source from public.project_templates
    where id = p_template_id and not archived and official;
  if not found then raise exception 'Template indisponível'; end if;
  insert into public.projects(template_id, owner_id, name, description, category, problem, objective,
    origin, max_members, duration, difficulty, suggested_composition, possible_stacks, outcomes)
  values (source.id, uid, source.name, source.description, source.category, source.problem, source.objective,
    'template', source.recommended_max_members, source.suggested_duration, source.difficulty,
    source.suggested_composition, source.possible_stacks, source.outcomes)
  returning id into new_project_id;
  insert into public.project_technologies(project_id, skill_id)
    select new_project_id, link.skill_id from public.project_template_technologies link where link.template_id = source.id;
  insert into public.project_areas(project_id, skill_id)
    select new_project_id, link.skill_id from public.project_template_areas link where link.template_id = source.id;
  canonical_role := private.require_project_area_role(new_project_id, p_owner_role);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (new_project_id, uid, canonical_role, 'Iniciou a squad a partir de um template Focus.');
  return new_project_id;
end;
$$;

create function public.replicate_project(p_source_project_id uuid, p_owner_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.projects%rowtype;
declare new_project_id uuid;
declare canonical_role text;
begin
  perform private.require_active();
  select * into source from public.projects where id = p_source_project_id
    and (moderation_status = 'APPROVED' or owner_id = uid);
  if not found then raise exception 'Projeto indisponível'; end if;
  insert into public.projects(template_id, source_project_id, owner_id, name, description,
    category, problem, objective, origin, max_members, duration, difficulty,
    suggested_composition, possible_stacks, outcomes)
  values (source.template_id, source.id, uid, source.name, source.description,
    source.category, source.problem, source.objective, 'replica', source.max_members,
    source.duration, source.difficulty, source.suggested_composition, source.possible_stacks, source.outcomes)
  returning id into new_project_id;
  insert into public.project_technologies(project_id, skill_id)
    select new_project_id, link.skill_id from public.project_technologies link where link.project_id = source.id;
  insert into public.project_areas(project_id, skill_id)
    select new_project_id, link.skill_id from public.project_areas link where link.project_id = source.id;
  canonical_role := private.require_project_area_role(new_project_id, p_owner_role);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (new_project_id, uid, canonical_role, 'Iniciou a squad a partir de um projeto existente.');
  return new_project_id;
end;
$$;

create function public.create_community_project(
  p_name text, p_description text, p_category text, p_max_members integer,
  p_difficulty text, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[], p_stacks text[], p_outcomes text[], p_owner_role text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare new_project_id uuid;
declare canonical_role text;
declare canonical_areas text[] := private.canonical_area_list(p_areas);
begin
  perform private.require_active();
  if coalesce(array_length(p_stacks, 1), 0) > 30 or coalesce(array_length(p_outcomes, 1), 0) > 30 or
     jsonb_typeof(p_composition) is distinct from 'array' or jsonb_array_length(p_composition) > 30 then
    raise exception 'Escopo inválido';
  end if;
  insert into public.projects(owner_id, name, description, category, status, origin, max_members,
    difficulty, duration, suggested_composition, possible_stacks, outcomes)
  values (uid, trim(p_name), trim(p_description), coalesce(nullif(trim(p_category), ''), 'Comunidade'),
    'FORMING', 'community', p_max_members, p_difficulty, trim(p_duration),
    p_composition, coalesce(p_stacks, '{}'), coalesce(p_outcomes, '{}'))
  returning id into new_project_id;
  perform private.attach_project_skills(new_project_id, p_technologies, canonical_areas);
  canonical_role := private.require_project_area_role(new_project_id, p_owner_role);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (new_project_id, uid, canonical_role, 'Criou o projeto e está formando a squad inicial.');
  return new_project_id;
end;
$$;

create function public.create_planned_project_from_template(
  p_template_id uuid, p_start date, p_end date, p_owner_role text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_project_id uuid;
begin
  new_project_id := public.create_project_from_template(p_template_id, p_owner_role);
  perform private.set_project_plan(new_project_id, p_start, p_end);
  return new_project_id;
end;
$$;

create function public.replicate_planned_project(
  p_source_project_id uuid, p_start date, p_end date, p_owner_role text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_project_id uuid;
begin
  new_project_id := public.replicate_project(p_source_project_id, p_owner_role);
  perform private.set_project_plan(new_project_id, p_start, p_end);
  return new_project_id;
end;
$$;

create function public.create_planned_community_project(
  p_name text, p_description text, p_category text, p_max_members integer,
  p_difficulty text, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[], p_stacks text[], p_outcomes text[],
  p_start date, p_end date, p_owner_role text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_project_id uuid;
begin
  new_project_id := public.create_community_project(p_name, p_description, p_category, p_max_members,
    p_difficulty, p_duration, p_composition, p_technologies, p_areas, p_stacks, p_outcomes, p_owner_role);
  perform private.set_project_plan(new_project_id, p_start, p_end);
  return new_project_id;
end;
$$;

create or replace function public.request_project_join(
  p_project_id uuid, p_main_role text, p_contribution_intent text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target public.projects%rowtype;
declare member_count integer;
declare pending_count integer;
declare max_joined integer;
declare request_id uuid;
declare canonical_role text;
begin
  perform private.require_active();
  if length(trim(coalesce(p_main_role, ''))) not between 1 and 80 then raise exception 'INVALID_ROLE'; end if;
  if length(coalesce(p_contribution_intent, '')) > 1200 then raise exception 'INVALID_INTENT'; end if;
  if not private.has_discord_integration(uid) then raise exception 'DISCORD_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  if target.moderation_status <> 'APPROVED' then raise exception 'PROJECT_NOT_APPROVED'; end if;
  canonical_role := private.require_project_area_role(p_project_id, p_main_role);
  if exists (select 1 from public.project_members where project_id = p_project_id and user_id = uid) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (select 1 from public.project_join_requests
    where project_id = p_project_id and user_id = uid and status = 'PENDING') then
    raise exception 'JOIN_REQUEST_PENDING';
  end if;
  select count(*) into member_count from public.project_members where project_id = p_project_id;
  select count(*) into pending_count from public.project_join_requests
    where project_id = p_project_id and status = 'PENDING';
  if member_count + pending_count >= target.max_members then raise exception 'PROJECT_FULL'; end if;
  select max_projects_joined_simultaneously into max_joined from public.platform_settings where singleton;
  if private.active_membership_count(uid) >= max_joined then
    raise exception 'JOINED_PROJECT_LIMIT:%', max_joined;
  end if;
  insert into public.project_join_requests(project_id, user_id, main_role, contribution_intent)
  values (p_project_id, uid, canonical_role, trim(coalesce(p_contribution_intent, '')))
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.decide_project_join_request(
  p_request_id uuid, p_decision text, p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target_request public.project_join_requests%rowtype;
declare target public.projects%rowtype;
declare member_count integer;
begin
  perform private.require_active();
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'INVALID_DECISION'; end if;
  select * into target_request from public.project_join_requests where id = p_request_id;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_request.user_id::text, 0));
  select * into target from public.projects where id = target_request.project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.owner_id <> uid then raise exception 'ONLY_OWNER_CAN_DECIDE_JOIN_REQUEST' using errcode = '42501'; end if;
  select * into target_request from public.project_join_requests where id = p_request_id for update;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  if target_request.status <> 'PENDING' then raise exception 'JOIN_REQUEST_NOT_PENDING'; end if;
  if target_request.user_id = uid then raise exception 'OWNER_CANNOT_APPROVE_SELF' using errcode = '42501'; end if;
  if p_decision = 'REJECTED' then
    update public.project_join_requests set status = 'REJECTED', decided_at = now(), decided_by = uid,
      decision_reason = nullif(trim(p_reason), '') where id = p_request_id;
    return target_request.project_id;
  end if;
  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  if target.moderation_status <> 'APPROVED' then raise exception 'PROJECT_NOT_APPROVED'; end if;
  if exists (select 1 from public.project_members
    where project_id = target_request.project_id and user_id = target_request.user_id) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if not exists (select 1 from public.platform_accounts
    where user_id = target_request.user_id and account_status = 'ACTIVE') then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if not private.has_discord_integration(target_request.user_id) then raise exception 'DISCORD_REQUIRED'; end if;
  perform private.require_project_area_role(target_request.project_id, target_request.main_role);
  select count(*) into member_count from public.project_members where project_id = target_request.project_id;
  if member_count >= target.max_members then raise exception 'PROJECT_FULL'; end if;
  perform set_config('focusedu.membership_write', 'trusted', true);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (target_request.project_id, target_request.user_id, target_request.main_role,
    target_request.contribution_intent);
  update public.project_join_requests set status = 'APPROVED', decided_at = now(), decided_by = uid,
    decision_reason = nullif(trim(p_reason), '') where id = p_request_id;
  return target_request.project_id;
end;
$$;

revoke all on function private.canonical_area_list(text[]) from public, anon, authenticated;
revoke all on function private.require_project_area_role(uuid,text) from public, anon, authenticated;
revoke all on function public.create_project_from_template(uuid) from public, anon, authenticated;
revoke all on function public.replicate_project(uuid) from public, anon, authenticated;
revoke all on function public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[]) from public, anon, authenticated;
revoke all on function public.create_planned_project_from_template(uuid,date,date) from public, anon, authenticated;
revoke all on function public.replicate_planned_project(uuid,date,date) from public, anon, authenticated;
revoke all on function public.create_planned_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],date,date) from public, anon, authenticated;

revoke all on function public.create_project_from_template(uuid,text) from public, anon;
revoke all on function public.replicate_project(uuid,text) from public, anon;
revoke all on function public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],text) from public, anon;
revoke all on function public.create_planned_project_from_template(uuid,date,date,text) from public, anon;
revoke all on function public.replicate_planned_project(uuid,date,date,text) from public, anon;
revoke all on function public.create_planned_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],date,date,text) from public, anon;
grant execute on function public.create_planned_project_from_template(uuid,date,date,text) to authenticated;
grant execute on function public.replicate_planned_project(uuid,date,date,text) to authenticated;
grant execute on function public.create_planned_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],date,date,text) to authenticated;
grant execute on function public.create_project_from_template(uuid,text) to authenticated;
grant execute on function public.replicate_project(uuid,text) to authenticated;
grant execute on function public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],text) to authenticated;
grant execute on function public.request_project_join(uuid,text,text) to authenticated;
grant execute on function public.decide_project_join_request(uuid,text,text) to authenticated;
