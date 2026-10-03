create table public.platform_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  platform_role text not null default 'MEMBER' check (platform_role in ('MEMBER', 'MODERATOR', 'ADMIN')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE', 'SUSPENDED')),
  suspended_at timestamptz,
  suspended_by uuid references public.profiles(id) on delete set null,
  suspension_reason text check (length(suspension_reason) <= 500),
  created_at timestamptz not null default now()
);
insert into public.platform_accounts(user_id, created_at)
select id, created_at from public.profiles on conflict do nothing;

create function private.create_platform_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.platform_accounts(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger profile_platform_account after insert on public.profiles
for each row execute function private.create_platform_account();

create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  max_owned_open_projects_per_user integer not null default 3 check (max_owned_open_projects_per_user between 0 and 50),
  max_project_creations_per_day integer not null default 3 check (max_project_creations_per_day between 0 and 50),
  max_projects_joined_simultaneously integer not null default 5 check (max_projects_joined_simultaneously between 0 and 50),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(singleton) values (true);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_recent_idx on public.admin_audit_log(created_at desc);

alter table public.projects add column moderation_status text not null default 'PENDING'
  check (moderation_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column moderation_reason text check (length(moderation_reason) <= 500),
  add column moderated_at timestamptz,
  add column content_version integer not null default 0,
  add column reviewed_version integer not null default 0;
update public.projects set moderation_status = 'APPROVED';

alter table public.projects drop constraint projects_duration_check;
alter table public.projects alter column duration set default '';
alter table public.projects add constraint projects_duration_check check (length(duration) <= 80);
alter table public.project_templates drop constraint project_templates_suggested_duration_check;
alter table public.project_templates alter column suggested_duration set default '';
alter table public.project_templates add constraint project_templates_suggested_duration_check check (length(suggested_duration) <= 80);

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_accounts
    where user_id = auth.uid() and platform_role in ('MODERATOR', 'ADMIN') and account_status = 'ACTIVE');
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_accounts
    where user_id = auth.uid() and platform_role = 'ADMIN' and account_status = 'ACTIVE');
$$;
create function private.require_active() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  if not exists (select 1 from public.platform_accounts where user_id = auth.uid() and account_status = 'ACTIVE') then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = 'P0001';
  end if;
end;
$$;

create function private.check_project_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare limits public.platform_settings%rowtype;
declare owned_count integer;
declare daily_count integer;
declare joined_count integer;
begin
  perform private.require_active();
  if new.owner_id <> auth.uid() then raise exception 'Proprietário inválido' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into limits from public.platform_settings where singleton;
  select count(*) into owned_count from public.projects where owner_id = auth.uid() and status in ('FORMING', 'ACTIVE');
  if owned_count >= limits.max_owned_open_projects_per_user then
    raise exception 'OWNED_PROJECT_LIMIT:%', limits.max_owned_open_projects_per_user;
  end if;
  select count(*) into daily_count from public.projects where owner_id = auth.uid() and created_at >= now() - interval '24 hours';
  if daily_count >= limits.max_project_creations_per_day then
    raise exception 'DAILY_PROJECT_LIMIT:%', limits.max_project_creations_per_day;
  end if;
  select count(*) into joined_count from public.project_members m join public.projects p on p.id = m.project_id
    where m.user_id = auth.uid() and p.status in ('FORMING', 'ACTIVE');
  if joined_count >= limits.max_projects_joined_simultaneously then
    raise exception 'JOINED_PROJECT_LIMIT:%', limits.max_projects_joined_simultaneously;
  end if;
  new.moderation_status := case when new.origin = 'template' then 'APPROVED' else 'PENDING' end;
  new.moderation_reason := null;
  return new;
end;
$$;
create trigger projects_creation_limits before insert on public.projects
for each row execute function private.check_project_creation();

create or replace function public.replicate_project(p_source_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare source public.projects%rowtype;
declare v_project_id uuid;
declare owner_role text;
begin
  perform private.require_active();
  select * into source from public.projects where id = p_source_project_id
    and (moderation_status = 'APPROVED' or owner_id = uid);
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

create or replace function public.update_project(
  p_project_id uuid, p_name text, p_description text, p_objective text,
  p_max_members integer, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.owner_id <> auth.uid() then raise exception 'Somente o responsável pode editar o projeto' using errcode = '42501'; end if;
  if target.status <> 'FORMING' then raise exception 'Somente projetos em formação podem ser editados'; end if;
  if jsonb_typeof(p_composition) is distinct from 'array' or jsonb_array_length(p_composition) > 30 then
    raise exception 'Composição sugerida inválida';
  end if;
  update public.projects set
    name = trim(p_name), description = trim(p_description), objective = coalesce(p_objective, ''),
    max_members = p_max_members, duration = coalesce(trim(p_duration), ''), suggested_composition = p_composition,
    content_version = content_version + 1,
    moderation_status = case when origin <> 'template' and moderation_status = 'APPROVED' then 'PENDING' else moderation_status end,
    moderation_reason = case when origin <> 'template' and moderation_status = 'APPROVED' then null else moderation_reason end
  where id = p_project_id;
  delete from public.project_technologies where project_id = p_project_id;
  delete from public.project_areas where project_id = p_project_id;
  perform private.attach_project_skills(p_project_id, p_technologies, p_areas);
end;
$$;

create or replace function private.enforce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare member_count integer;
declare joined_count integer;
declare max_joined integer;
begin
  perform private.require_active();
  new.user_id := auth.uid();
  new.joined_at := now();
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into target from public.projects where id = new.project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.status <> 'FORMING' then raise exception 'Este projeto não aceita novos membros'; end if;
  if target.owner_id <> auth.uid() and target.moderation_status <> 'APPROVED' then
    raise exception 'Projeto ainda não disponível para participação';
  end if;
  select count(*) into member_count from public.project_members where project_id = new.project_id;
  if member_count >= target.max_members then raise exception 'Squad completa'; end if;
  select max_projects_joined_simultaneously into max_joined from public.platform_settings where singleton;
  select count(*) into joined_count from public.project_members m join public.projects p on p.id = m.project_id
    where m.user_id = auth.uid() and p.status in ('FORMING', 'ACTIVE');
  if joined_count >= max_joined then raise exception 'JOINED_PROJECT_LIMIT:%', max_joined; end if;
  return new;
end;
$$;

create function private.check_community_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_active();
  return coalesce(new, old);
end;
$$;
create trigger project_members_active_delete before delete on public.project_members
for each row execute function private.check_community_write();

create or replace function private.protect_project() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform private.require_active();
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
    new.owner_id := auth.uid();
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
    if new.status = 'ACTIVE' and old.status = 'FORMING' and old.moderation_status <> 'APPROVED' then
      raise exception 'Projeto aguardando revisão';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'FORMING' and new.status in ('ACTIVE', 'CANCELLED')) or
      (old.status = 'ACTIVE' and new.status in ('COMPLETED', 'CANCELLED')) or
      (old.status in ('COMPLETED', 'CANCELLED') and new.status = 'ARCHIVED')
    ) then raise exception 'Transição de projeto inválida'; end if;
    if old.status <> 'FORMING' and new.status = old.status and
       (to_jsonb(new) - 'updated_at' - 'moderation_status' - 'moderation_reason') is distinct from
       (to_jsonb(old) - 'updated_at' - 'moderation_status' - 'moderation_reason') then
      raise exception 'Projeto fora de formação não pode ser editado';
    end if;
    if new.max_members < (select count(*) from public.project_members where project_id = old.id) then
      raise exception 'O limite não pode ser menor que a squad atual';
    end if;
  end if;
  return new;
end;
$$;

drop policy projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (
  moderation_status = 'APPROVED' or owner_id = (select auth.uid()) or (select private.is_staff())
);
drop policy project_tech_read on public.project_technologies;
create policy project_tech_read on public.project_technologies for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
drop policy project_areas_read on public.project_areas;
create policy project_areas_read on public.project_areas for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));
drop policy members_read on public.project_members;
create policy members_read on public.project_members for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

alter table public.platform_accounts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.platform_accounts, public.platform_settings, public.admin_audit_log from anon, authenticated;
grant select on public.platform_accounts to authenticated;
create policy account_read_self on public.platform_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.platform_accounts),
    'forming', (select count(*) from public.projects where status = 'FORMING'),
    'active', (select count(*) from public.projects where status = 'ACTIVE'),
    'completed', (select count(*) from public.projects where status = 'COMPLETED'),
    'pending', (select count(*) from public.projects where moderation_status = 'PENDING'),
    'cancelled', (select count(*) from public.projects where status = 'CANCELLED'),
    'suspended', (select count(*) from public.platform_accounts where account_status = 'SUSPENDED')
  );
end;
$$;

create function public.admin_users() returns table (
  user_id uuid, name text, avatar_url text, email text, platform_role text, account_status text,
  created_at timestamptz, active_projects bigint, suspension_reason text
) language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return query select a.user_id, p.name, p.avatar_url, u.email::text, a.platform_role, a.account_status,
    a.created_at, (select count(*) from public.project_members m join public.projects pr on pr.id = m.project_id
      where m.user_id = a.user_id and pr.status in ('FORMING', 'ACTIVE')),
    a.suspension_reason
  from public.platform_accounts a join public.profiles p on p.id = a.user_id
  join auth.users u on u.id = a.user_id order by a.created_at desc;
end;
$$;

create function public.admin_set_user(p_user_id uuid, p_role text default null,
  p_status text default null, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare target public.platform_accounts%rowtype;
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('MEMBER', 'MODERATOR') then
    raise exception 'Somente MEMBER e MODERATOR podem ser definidos pela interface';
  end if;
  if p_status is not null and p_status not in ('ACTIVE', 'SUSPENDED') then raise exception 'Status inválido'; end if;
  select * into target from public.platform_accounts where user_id = p_user_id for update;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if target.platform_role = 'ADMIN' and (p_role is not null or p_status = 'SUSPENDED') then
    raise exception 'Conta ADMIN protegida. Use bootstrap manual para alterações sensíveis.';
  end if;
  if p_status = 'SUSPENDED' and length(trim(coalesce(p_reason, ''))) > 500 then raise exception 'Motivo muito longo'; end if;
  update public.platform_accounts set
    platform_role = coalesce(p_role, platform_role), account_status = coalesce(p_status, account_status),
    suspended_at = case when p_status = 'SUSPENDED' then now() when p_status = 'ACTIVE' then null else suspended_at end,
    suspended_by = case when p_status = 'SUSPENDED' then actor when p_status = 'ACTIVE' then null else suspended_by end,
    suspension_reason = case when p_status = 'SUSPENDED' then nullif(trim(p_reason), '') when p_status = 'ACTIVE' then null else suspension_reason end
  where user_id = p_user_id;
  if p_role is not null and p_role <> target.platform_role then
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
    values (actor, 'ROLE_CHANGED', 'user', p_user_id::text, jsonb_build_object('from', target.platform_role, 'to', p_role));
  end if;
  if p_status is not null and p_status <> target.account_status then
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id)
    values (actor, case when p_status = 'SUSPENDED' then 'USER_SUSPENDED' else 'USER_REACTIVATED' end, 'user', p_user_id::text);
  end if;
end;
$$;

create function public.admin_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return (select to_jsonb(s) - 'singleton' from public.platform_settings s where singleton);
end;
$$;
create function public.admin_update_settings(p_owned integer, p_daily integer, p_joined integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  if p_owned is null or p_daily is null or p_joined is null or
     p_owned not between 0 and 50 or p_daily not between 0 and 50 or p_joined not between 0 and 50 then
    raise exception 'Limites devem ser inteiros entre 0 e 50';
  end if;
  update public.platform_settings set max_owned_open_projects_per_user = p_owned,
    max_project_creations_per_day = p_daily, max_projects_joined_simultaneously = p_joined,
    updated_at = now() where singleton;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'SETTINGS_UPDATED', 'settings', 'platform',
    jsonb_build_object('owned', p_owned, 'daily', p_daily, 'joined', p_joined));
end;
$$;

create function public.admin_projects() returns table (
  id uuid, name text, owner_id uuid, owner_name text, origin text, status text,
  moderation_status text, moderation_reason text, members bigint, created_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return query select pr.id, pr.name, pr.owner_id, pf.name, pr.origin, pr.status,
    pr.moderation_status, pr.moderation_reason,
    (select count(*) from public.project_members m where m.project_id = pr.id), pr.created_at
  from public.projects pr join public.profiles pf on pf.id = pr.owner_id order by pr.created_at desc;
end;
$$;

create function public.moderate_project(p_project_id uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  if not private.is_staff() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  if p_decision not in ('APPROVED', 'REJECTED', 'CANCELLED') then raise exception 'Decisão inválida'; end if;
  if p_decision in ('REJECTED', 'CANCELLED') and length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Informe um motivo de até 500 caracteres';
  end if;
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.origin = 'template' then raise exception 'Execuções de template não passam por moderação'; end if;
  if p_decision = 'CANCELLED' then
    if target.status not in ('FORMING', 'ACTIVE') then raise exception 'Projeto já encerrado'; end if;
    update public.projects set status = 'CANCELLED', cancelled_at = now(), cancellation_reason = trim(p_reason)
      where id = p_project_id;
  else
    if target.moderation_status <> 'PENDING' then raise exception 'Projeto não está pendente'; end if;
    update public.projects set moderation_status = p_decision, moderated_at = now(),
      reviewed_version = case when p_decision = 'REJECTED' then target.content_version else reviewed_version end,
      moderation_reason = case when p_decision = 'REJECTED' then trim(p_reason) else null end
      where id = p_project_id;
  end if;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), case p_decision when 'APPROVED' then 'PROJECT_APPROVED' when 'REJECTED' then 'PROJECT_REJECTED' else 'PROJECT_MODERATED' end,
    'project', p_project_id::text, jsonb_build_object('decision', p_decision, 'reason', p_reason));
end;
$$;

create function public.resubmit_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id for update;
  if not found or target.owner_id <> auth.uid() or target.status <> 'FORMING' or target.moderation_status <> 'REJECTED' then
    raise exception 'Projeto não pode ser reenviado';
  end if;
  if target.content_version <= target.reviewed_version then raise exception 'Edite o projeto antes de reenviar'; end if;
  update public.projects set moderation_status = 'PENDING', moderation_reason = null where id = p_project_id;
end;
$$;

create function public.admin_audit_recent() returns table (
  id uuid, actor_name text, action text, target_type text, target_id text, metadata jsonb, created_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return query select l.id, p.name, l.action, l.target_type, l.target_id, l.metadata, l.created_at
    from public.admin_audit_log l join public.profiles p on p.id = l.actor_user_id
    order by l.created_at desc limit 100;
end;
$$;

create function public.admin_templates() returns setof public.project_templates
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return query select * from public.project_templates order by created_at desc;
end;
$$;

create function public.admin_template_skills(p_template_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'technologies', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb)
      from public.project_template_technologies l join public.skills s on s.id = l.skill_id where l.template_id = p_template_id),
    'areas', (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb)
      from public.project_template_areas l join public.skills s on s.id = l.skill_id where l.template_id = p_template_id)
  );
end;
$$;

create function public.admin_save_template(p_template_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
declare item text;
declare v_features text[];
declare v_criteria text[];
declare v_stacks text[];
declare v_outcomes text[];
declare v_composition jsonb;
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Template inválido'; end if;
  select coalesce(array_agg(value), '{}') into v_features from jsonb_array_elements_text(coalesce(p_data->'suggested_features', '[]'::jsonb));
  select coalesce(array_agg(value), '{}') into v_criteria from jsonb_array_elements_text(coalesce(p_data->'acceptance_criteria', '[]'::jsonb));
  select coalesce(array_agg(value), '{}') into v_stacks from jsonb_array_elements_text(coalesce(p_data->'possible_stacks', '[]'::jsonb));
  select coalesce(array_agg(value), '{}') into v_outcomes from jsonb_array_elements_text(coalesce(p_data->'outcomes', '[]'::jsonb));
  v_composition := coalesce(p_data->'suggested_composition', '[]'::jsonb);
  if jsonb_typeof(v_composition) <> 'array' or jsonb_array_length(v_composition) > 30 or
     cardinality(v_features) > 30 or cardinality(v_criteria) > 30 or cardinality(v_stacks) > 30 or cardinality(v_outcomes) > 30 then
    raise exception 'Listas do template inválidas';
  end if;
  if p_template_id is null then
    insert into public.project_templates(name, description, category, problem, objective, suggested_features,
      acceptance_criteria, difficulty, suggested_duration, recommended_max_members, suggested_composition,
      possible_stacks, outcomes, audience, evolution_ideas, official)
    values (trim(p_data->>'name'), trim(p_data->>'description'), coalesce(nullif(trim(p_data->>'category'), ''), 'Comunidade'),
      coalesce(p_data->>'problem', ''), coalesce(p_data->>'objective', ''), v_features, v_criteria,
      p_data->>'difficulty', '', (p_data->>'recommended_max_members')::integer, v_composition,
      v_stacks, v_outcomes, coalesce(p_data->>'audience', ''), '{}', true)
    returning id into result;
  else
    update public.project_templates set name = trim(p_data->>'name'), description = trim(p_data->>'description'),
      category = coalesce(nullif(trim(p_data->>'category'), ''), 'Comunidade'), problem = coalesce(p_data->>'problem', ''),
      objective = coalesce(p_data->>'objective', ''), suggested_features = v_features,
      acceptance_criteria = v_criteria, difficulty = p_data->>'difficulty',
      recommended_max_members = (p_data->>'recommended_max_members')::integer,
      suggested_composition = v_composition, possible_stacks = v_stacks, outcomes = v_outcomes,
      audience = coalesce(p_data->>'audience', '') where id = p_template_id and official
    returning id into result;
    if result is null then raise exception 'Template oficial não encontrado'; end if;
  end if;
  delete from public.project_template_technologies where template_id = result;
  delete from public.project_template_areas where template_id = result;
  if jsonb_typeof(coalesce(p_data->'technologies', '[]'::jsonb)) <> 'array' or
     jsonb_typeof(coalesce(p_data->'areas', '[]'::jsonb)) <> 'array' then raise exception 'Skills inválidas'; end if;
  if jsonb_array_length(coalesce(p_data->'technologies', '[]'::jsonb)) > 30 or
     jsonb_array_length(coalesce(p_data->'areas', '[]'::jsonb)) > 30 then raise exception 'Muitas skills'; end if;
  for item in select value from jsonb_array_elements_text(coalesce(p_data->'technologies', '[]'::jsonb)) loop
    insert into public.project_template_technologies(template_id, skill_id)
      values (result, private.ensure_skill(item, 'technology')) on conflict do nothing;
  end loop;
  for item in select value from jsonb_array_elements_text(coalesce(p_data->'areas', '[]'::jsonb)) loop
    insert into public.project_template_areas(template_id, skill_id)
      values (result, private.ensure_skill(item, 'area')) on conflict do nothing;
  end loop;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id)
    values (auth.uid(), case when p_template_id is null then 'TEMPLATE_CREATED' else 'TEMPLATE_UPDATED' end, 'template', result::text);
  return result;
end;
$$;

create function public.admin_set_template_archived(p_template_id uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso administrativo negado' using errcode = '42501'; end if;
  update public.project_templates set archived = p_archived where id = p_template_id and official;
  if not found then raise exception 'Template oficial não encontrado'; end if;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_archived then 'TEMPLATE_ARCHIVED' else 'TEMPLATE_RESTORED' end,
    'template', p_template_id::text, jsonb_build_object('archived', p_archived));
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff() to authenticated;
revoke all on function public.admin_overview(), public.admin_users(), public.admin_set_user(uuid,text,text,text),
  public.admin_settings(), public.admin_update_settings(integer,integer,integer), public.admin_projects(),
  public.moderate_project(uuid,text,text), public.resubmit_project(uuid), public.admin_audit_recent(),
  public.admin_templates(), public.admin_template_skills(uuid), public.admin_save_template(uuid,jsonb), public.admin_set_template_archived(uuid,boolean)
  from public, anon;
grant execute on function public.admin_overview(), public.admin_users(), public.admin_set_user(uuid,text,text,text),
  public.admin_settings(), public.admin_update_settings(integer,integer,integer), public.admin_projects(),
  public.moderate_project(uuid,text,text), public.resubmit_project(uuid), public.admin_audit_recent(),
  public.admin_templates(), public.admin_template_skills(uuid), public.admin_save_template(uuid,jsonb), public.admin_set_template_archived(uuid,boolean)
  to authenticated;
