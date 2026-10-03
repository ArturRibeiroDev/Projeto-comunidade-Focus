alter table public.projects
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column cancelled_at timestamptz,
  add column archived_at timestamptz,
  add column cancellation_reason text check (length(cancellation_reason) <= 500),
  add column repository_url text check (repository_url is null or repository_url ~* '^https?://[^[:space:]]+$'),
  add column demo_url text check (demo_url is null or demo_url ~* '^https?://[^[:space:]]+$'),
  add column completion_summary text check (length(completion_summary) <= 1200);

alter table public.projects drop constraint projects_status_check;
alter table public.projects disable trigger projects_updated_at;
update public.projects set status = case status
  when 'Aberto' then 'FORMING'
  when 'Em formação' then 'FORMING'
  when 'Em andamento' then 'ACTIVE'
  when 'Concluído' then 'COMPLETED'
  when 'Cancelado' then 'CANCELLED'
  when 'Arquivado' then 'ARCHIVED'
end;
alter table public.projects enable trigger projects_updated_at;
alter table public.projects alter column status set default 'FORMING';
alter table public.projects add constraint projects_status_check
  check (status in ('FORMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'));

alter table public.evidences
  add column kind text not null default 'participation' check (kind in ('participation', 'join', 'completion')),
  add column role text check (role is null or length(trim(role)) between 1 and 80);
create unique index evidences_one_completion_per_member
  on public.evidences(user_id, project_id, kind) where kind = 'completion';

create or replace function private.protect_project() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
    new.owner_id = auth.uid();
    if new.status <> 'FORMING' or new.started_at is not null or new.completed_at is not null or
       new.cancelled_at is not null or new.archived_at is not null then
      raise exception 'Novo projeto deve iniciar em formação';
    end if;
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or
       new.origin is distinct from old.origin or new.template_id is distinct from old.template_id or
       new.source_project_id is distinct from old.source_project_id or new.created_at is distinct from old.created_at then
      raise exception 'Origem e proprietário não podem ser alterados' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'FORMING' and new.status in ('ACTIVE', 'CANCELLED')) or
      (old.status = 'ACTIVE' and new.status in ('COMPLETED', 'CANCELLED')) or
      (old.status in ('COMPLETED', 'CANCELLED') and new.status = 'ARCHIVED')
    ) then
      raise exception 'Transição de projeto inválida';
    end if;
    if old.status <> 'FORMING' and new.status = old.status and
       (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'Projeto fora de formação não pode ser editado';
    end if;
    if new.max_members < (select count(*) from public.project_members where project_id = old.id) then
      raise exception 'O limite não pode ser menor que a squad atual';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare member_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  new.user_id = auth.uid();
  new.joined_at = now();
  select * into target from public.projects where id = new.project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.status <> 'FORMING' then raise exception 'Este projeto não aceita novos membros'; end if;
  select count(*) into member_count from public.project_members where project_id = new.project_id;
  if member_count >= target.max_members then raise exception 'Squad completa'; end if;
  return new;
end;
$$;

create function private.prevent_membership_leave() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_status text;
begin
  if auth.uid() is null then return old; end if;
  if old.user_id <> auth.uid() then raise exception 'Participação de outro membro não pode ser removida' using errcode = '42501'; end if;
  select status into project_status from public.projects where id = old.project_id for update;
  if not found then return old; end if;
  if project_status <> 'FORMING' then
    raise exception 'Este projeto já está em andamento ou encerrado. Fale com o responsável pela squad.';
  end if;
  return old;
end;
$$;
create trigger project_members_leave before delete on public.project_members
  for each row execute function private.prevent_membership_leave();

create or replace function private.record_join_evidence() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_name text;
begin
  select name into project_name from public.projects where id = new.project_id;
  insert into public.evidences(user_id, project_id, kind, role, label)
  values (new.user_id, new.project_id, 'join', new.main_role,
    'Entrou no projeto ' || project_name || ' como ' || new.main_role);
  return new;
end;
$$;

create or replace function public.create_community_project(
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
    'FORMING', 'community', p_max_members, p_difficulty, trim(p_duration),
    p_composition, coalesce(p_stacks, '{}'), coalesce(p_outcomes, '{}'))
  returning id into project_id;
  perform private.attach_project_skills(project_id, p_technologies, p_areas);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (project_id, uid, owner_role, 'Criou o projeto e está formando a squad inicial.');
  return project_id;
end;
$$;

create function public.update_project(
  p_project_id uuid, p_name text, p_description text, p_objective text,
  p_max_members integer, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.owner_id <> auth.uid() then raise exception 'Somente o responsável pode editar o projeto' using errcode = '42501'; end if;
  if target.status <> 'FORMING' then raise exception 'Somente projetos em formação podem ser editados'; end if;
  if jsonb_typeof(p_composition) is distinct from 'array' or jsonb_array_length(p_composition) > 30 then
    raise exception 'Composição sugerida inválida';
  end if;
  update public.projects set
    name = trim(p_name), description = trim(p_description), objective = coalesce(p_objective, ''),
    max_members = p_max_members, duration = trim(p_duration), suggested_composition = p_composition
  where id = p_project_id;
  delete from public.project_technologies where project_id = p_project_id;
  delete from public.project_areas where project_id = p_project_id;
  perform private.attach_project_skills(p_project_id, p_technologies, p_areas);
end;
$$;

create function public.transition_project(
  p_project_id uuid, p_target_status text,
  p_repository_url text default null, p_demo_url text default null,
  p_completion_summary text default null, p_cancellation_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare finished_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.owner_id <> auth.uid() then raise exception 'Somente o responsável pode alterar o projeto' using errcode = '42501'; end if;
  if target.status = p_target_status then return; end if;

  if p_target_status = 'ACTIVE' and target.status = 'FORMING' then
    update public.projects set status = 'ACTIVE', started_at = now() where id = p_project_id;
  elsif p_target_status = 'COMPLETED' and target.status = 'ACTIVE' then
    finished_at := now();
    update public.projects set
      status = 'COMPLETED', completed_at = finished_at,
      repository_url = nullif(trim(p_repository_url), ''), demo_url = nullif(trim(p_demo_url), ''),
      completion_summary = nullif(trim(p_completion_summary), '')
    where id = p_project_id;
    insert into public.evidences(user_id, project_id, kind, role, label, recorded_at)
    select m.user_id, p_project_id, 'completion', m.main_role,
      'Concluiu o projeto ' || target.name || ' como ' || m.main_role, finished_at
    from public.project_members m where m.project_id = p_project_id
    on conflict (user_id, project_id, kind) where kind = 'completion' do nothing;
  elsif p_target_status = 'CANCELLED' and target.status in ('FORMING', 'ACTIVE') then
    update public.projects set
      status = 'CANCELLED', cancelled_at = now(), cancellation_reason = nullif(trim(p_cancellation_reason), '')
    where id = p_project_id;
  elsif p_target_status = 'ARCHIVED' and target.status in ('COMPLETED', 'CANCELLED') then
    update public.projects set status = 'ARCHIVED', archived_at = now() where id = p_project_id;
  else
    raise exception 'Transição de projeto inválida';
  end if;
end;
$$;

revoke update on public.projects from authenticated;
drop policy projects_update_owner on public.projects;
revoke all on function public.update_project(uuid,text,text,text,integer,text,jsonb,text[],text[]) from public, anon;
revoke all on function public.transition_project(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.update_project(uuid,text,text,text,integer,text,jsonb,text[],text[]) to authenticated;
grant execute on function public.transition_project(uuid,text,text,text,text,text) to authenticated;
revoke all on function private.prevent_membership_leave() from public, anon, authenticated;
