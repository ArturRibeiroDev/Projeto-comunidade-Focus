create function private.ensure_skill(p_name text, p_kind text) returns uuid
language plpgsql set search_path = '' as $$
declare result uuid;
declare normalized text := trim(p_name);
begin
  if p_kind not in ('technology', 'area') or length(normalized) not between 1 and 80 then
    raise exception 'Área ou tecnologia inválida';
  end if;
  insert into public.skills(kind, name) values (p_kind, normalized)
  on conflict do nothing;
  select id into result from public.skills where kind = p_kind and lower(name) = lower(normalized);
  return result;
end;
$$;

create function private.attach_project_skills(p_project_id uuid, p_technologies text[], p_areas text[])
returns void language plpgsql set search_path = '' as $$
declare item text;
begin
  if coalesce(array_length(p_technologies, 1), 0) > 30 or coalesce(array_length(p_areas, 1), 0) > 30 then
    raise exception 'Muitas tecnologias ou áreas';
  end if;
  foreach item in array coalesce(p_technologies, '{}') loop
    insert into public.project_technologies(project_id, skill_id)
    values (p_project_id, private.ensure_skill(item, 'technology')) on conflict do nothing;
  end loop;
  foreach item in array coalesce(p_areas, '{}') loop
    insert into public.project_areas(project_id, skill_id)
    values (p_project_id, private.ensure_skill(item, 'area')) on conflict do nothing;
  end loop;
end;
$$;

create function public.update_my_profile(
  p_name text, p_avatar_url text, p_bio text, p_main_role text,
  p_secondary_roles text[], p_availability text, p_interests text[],
  p_github_url text, p_linkedin_url text, p_technologies text[], p_areas text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare item text;
begin
  if uid is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if coalesce(array_length(p_secondary_roles, 1), 0) > 20 or coalesce(array_length(p_interests, 1), 0) > 30 or
     coalesce(array_length(p_technologies, 1), 0) > 30 or coalesce(array_length(p_areas, 1), 0) > 30 then
    raise exception 'Lista muito extensa';
  end if;
  update public.profiles set
    name = trim(p_name), avatar_url = coalesce(p_avatar_url, ''), bio = coalesce(p_bio, ''),
    main_role = trim(p_main_role), secondary_roles = coalesce(p_secondary_roles, '{}'),
    availability = coalesce(p_availability, ''), interests = coalesce(p_interests, '{}'),
    github_url = nullif(trim(p_github_url), ''), linkedin_url = nullif(trim(p_linkedin_url), '')
  where id = uid;
  if not found then raise exception 'Perfil não encontrado'; end if;

  delete from public.profile_skills where profile_id = uid;
  foreach item in array coalesce(p_technologies, '{}') loop
    insert into public.profile_skills(profile_id, skill_id)
    values (uid, private.ensure_skill(item, 'technology')) on conflict do nothing;
  end loop;
  foreach item in array coalesce(p_areas, '{}') loop
    insert into public.profile_skills(profile_id, skill_id)
    values (uid, private.ensure_skill(item, 'area')) on conflict do nothing;
  end loop;
end;
$$;

create function public.create_community_project(
  p_name text, p_description text, p_category text, p_max_members integer,
  p_difficulty text, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[], p_stacks text[], p_outcomes text[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare project_id uuid;
declare owner_role text;
begin
  if uid is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if coalesce(array_length(p_stacks, 1), 0) > 30 or coalesce(array_length(p_outcomes, 1), 0) > 30 or
     jsonb_typeof(p_composition) is distinct from 'array' or jsonb_array_length(p_composition) > 30 then
    raise exception 'Escopo inválido';
  end if;
  select main_role into owner_role from public.profiles where id = uid;
  if owner_role is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.projects(owner_id, name, description, category, status, origin, max_members,
    difficulty, duration, suggested_composition, possible_stacks, outcomes)
  values (uid, trim(p_name), trim(p_description), coalesce(nullif(trim(p_category), ''), 'Comunidade'),
    'Em formação', 'community', p_max_members, p_difficulty, trim(p_duration),
    p_composition, coalesce(p_stacks, '{}'), coalesce(p_outcomes, '{}'))
  returning id into project_id;
  perform private.attach_project_skills(project_id, p_technologies, p_areas);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (project_id, uid, owner_role, 'Criou o projeto e está formando a squad inicial.');
  return project_id;
end;
$$;

create function public.create_project_from_template(p_template_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.project_templates%rowtype;
declare project_id uuid;
declare owner_role text;
begin
  if uid is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into source from public.project_templates where id = p_template_id and not archived and official;
  if not found then raise exception 'Template indisponível'; end if;
  select main_role into owner_role from public.profiles where id = uid;
  if owner_role is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.projects(template_id, owner_id, name, description, category, problem, objective,
    origin, max_members, duration, difficulty, suggested_composition, possible_stacks, outcomes)
  values (source.id, uid, source.name, source.description, source.category, source.problem, source.objective,
    'template', source.recommended_max_members, source.suggested_duration, source.difficulty,
    source.suggested_composition, source.possible_stacks, source.outcomes)
  returning id into project_id;
  insert into public.project_technologies(project_id, skill_id)
    select project_id, skill_id from public.project_template_technologies where template_id = source.id;
  insert into public.project_areas(project_id, skill_id)
    select project_id, skill_id from public.project_template_areas where template_id = source.id;
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (project_id, uid, owner_role, 'Iniciou a squad a partir de um template Focus.');
  return project_id;
end;
$$;

create function public.replicate_project(p_source_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.projects%rowtype;
declare project_id uuid;
declare owner_role text;
begin
  if uid is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into source from public.projects where id = p_source_project_id;
  if not found then raise exception 'Projeto indisponível'; end if;
  select main_role into owner_role from public.profiles where id = uid;
  if owner_role is null then raise exception 'Perfil não encontrado'; end if;
  insert into public.projects(template_id, source_project_id, owner_id, name, description,
    category, problem, objective, origin, max_members, duration, difficulty,
    suggested_composition, possible_stacks, outcomes)
  values (source.template_id, source.id, uid, source.name, source.description,
    source.category, source.problem, source.objective, 'replica', source.max_members,
    source.duration, source.difficulty, source.suggested_composition, source.possible_stacks, source.outcomes)
  returning id into project_id;
  insert into public.project_technologies(project_id, skill_id)
    select project_id, skill_id from public.project_technologies where project_id = source.id;
  insert into public.project_areas(project_id, skill_id)
    select project_id, skill_id from public.project_areas where project_id = source.id;
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (project_id, uid, owner_role, 'Iniciou a squad a partir de um projeto existente.');
  return project_id;
end;
$$;

revoke all on function public.update_my_profile(text,text,text,text,text[],text,text[],text,text,text[],text[]) from public, anon;
revoke all on function public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[]) from public, anon;
revoke all on function public.create_project_from_template(uuid) from public, anon;
revoke all on function public.replicate_project(uuid) from public, anon;
grant execute on function public.update_my_profile(text,text,text,text,text[],text,text[],text,text,text[],text[]) to authenticated;
grant execute on function public.create_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[]) to authenticated;
grant execute on function public.create_project_from_template(uuid) to authenticated;
grant execute on function public.replicate_project(uuid) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
