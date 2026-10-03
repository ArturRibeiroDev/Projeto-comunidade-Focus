create or replace function public.replicate_project(p_source_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.projects%rowtype;
declare v_project_id uuid;
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
  returning id into v_project_id;
  insert into public.project_technologies(project_id, skill_id)
    select v_project_id, link.skill_id from public.project_technologies link where link.project_id = source.id;
  insert into public.project_areas(project_id, skill_id)
    select v_project_id, link.skill_id from public.project_areas link where link.project_id = source.id;
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (v_project_id, uid, owner_role, 'Iniciou a squad a partir de um projeto existente.');
  return v_project_id;
end;
$$;
