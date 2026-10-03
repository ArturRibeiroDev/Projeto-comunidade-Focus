create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  avatar_url text not null default '',
  bio text not null default '' check (length(bio) <= 1200),
  main_role text not null default 'Outra' check (length(main_role) between 1 and 80),
  secondary_roles text[] not null default '{}',
  availability text not null default '',
  interests text[] not null default '{}',
  github_url text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint github_url_http check (github_url is null or github_url ~* '^https?://[^[:space:]]+$'),
  constraint linkedin_url_http check (linkedin_url is null or linkedin_url ~* '^https?://[^[:space:]]+$')
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('technology', 'area')),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index skills_kind_name_unique on public.skills(kind, lower(name));

create table public.profile_skills (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, skill_id)
);
create index profile_skills_skill_idx on public.profile_skills(skill_id);

create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null check (length(trim(description)) between 1 and 1000),
  category text not null default 'Comunidade',
  problem text not null default '',
  objective text not null default '',
  suggested_features text[] not null default '{}',
  acceptance_criteria text[] not null default '{}',
  difficulty text not null check (difficulty in ('Iniciante', 'Intermediário', 'Avançado', 'Misto')),
  suggested_duration text not null check (length(trim(suggested_duration)) between 1 and 80),
  recommended_max_members integer not null check (recommended_max_members between 2 and 50),
  suggested_composition jsonb not null default '[]'::jsonb check (jsonb_typeof(suggested_composition) = 'array'),
  possible_stacks text[] not null default '{}',
  outcomes text[] not null default '{}',
  official boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_template_technologies (
  template_id uuid not null references public.project_templates(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  primary key (template_id, skill_id)
);
create index project_template_technologies_skill_idx on public.project_template_technologies(skill_id);

create table public.project_template_areas (
  template_id uuid not null references public.project_templates(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  primary key (template_id, skill_id)
);
create index project_template_areas_skill_idx on public.project_template_areas(skill_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.project_templates(id) on delete set null,
  source_project_id uuid references public.projects(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null check (length(trim(description)) between 1 and 1000),
  category text not null default 'Comunidade',
  problem text not null default '',
  objective text not null default '',
  status text not null default 'Em formação' check (status in ('Aberto', 'Em formação', 'Em andamento', 'Concluído', 'Cancelado', 'Arquivado')),
  origin text not null check (origin in ('template', 'community', 'replica')),
  max_members integer not null check (max_members between 2 and 50),
  duration text not null check (length(trim(duration)) between 1 and 80),
  difficulty text not null check (difficulty in ('Iniciante', 'Intermediário', 'Avançado', 'Misto')),
  suggested_composition jsonb not null default '[]'::jsonb check (jsonb_typeof(suggested_composition) = 'array'),
  possible_stacks text[] not null default '{}',
  outcomes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_origin_source check (
    (origin = 'template' and template_id is not null and source_project_id is null) or
    (origin = 'community' and template_id is null and source_project_id is null) or
    (origin = 'replica' and source_project_id is not null)
  )
);
create index projects_owner_idx on public.projects(owner_id);
create index projects_template_idx on public.projects(template_id) where template_id is not null;
create index projects_status_idx on public.projects(status);

create table public.project_technologies (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  primary key (project_id, skill_id)
);
create index project_technologies_skill_idx on public.project_technologies(skill_id);

create table public.project_areas (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete restrict,
  primary key (project_id, skill_id)
);
create index project_areas_skill_idx on public.project_areas(skill_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  main_role text not null check (length(trim(main_role)) between 1 and 80),
  contribution_intent text not null default '' check (length(contribution_intent) <= 1200),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id);

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  label text not null check (length(trim(label)) between 1 and 300),
  technology text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index evidences_user_date_idx on public.evidences(user_id, recorded_at desc);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger project_templates_updated_at before update on public.project_templates for each row execute function private.touch_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'Membro Focus'), 120),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create function private.protect_project() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
    new.owner_id = auth.uid();
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.origin is distinct from old.origin or
       new.template_id is distinct from old.template_id or new.source_project_id is distinct from old.source_project_id or
       new.created_at is distinct from old.created_at then
      raise exception 'Origem e proprietário não podem ser alterados' using errcode = '42501';
    end if;
    if new.max_members < (select count(*) from public.project_members where project_id = old.id) then
      raise exception 'O limite não pode ser menor que a squad atual';
    end if;
  end if;
  return new;
end;
$$;
create trigger projects_protect before insert or update on public.projects for each row execute function private.protect_project();

create function private.enforce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target public.projects%rowtype;
  member_count integer;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  new.user_id = auth.uid();
  new.joined_at = now();
  select * into target from public.projects where id = new.project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.status in ('Concluído', 'Cancelado', 'Arquivado') then
    raise exception 'Este projeto não aceita novos membros';
  end if;
  select count(*) into member_count from public.project_members where project_id = new.project_id;
  if member_count >= target.max_members then raise exception 'Squad completa'; end if;
  return new;
end;
$$;
create trigger project_members_capacity before insert on public.project_members for each row execute function private.enforce_membership();

create function private.record_join_evidence() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_name text;
begin
  select name into project_name from public.projects where id = new.project_id;
  insert into public.evidences(user_id, project_id, label)
  values (new.user_id, new.project_id, 'Entrou no projeto ' || project_name || ' como ' || new.main_role);
  return new;
end;
$$;
create trigger project_members_evidence after insert on public.project_members for each row execute function private.record_join_evidence();

-- Explicit grants complement RLS. Templates and evidence are read-only to browser clients.
revoke all on public.profiles, public.skills, public.profile_skills, public.project_templates,
  public.project_template_technologies, public.project_template_areas, public.projects,
  public.project_technologies, public.project_areas, public.project_members, public.evidences from anon, authenticated;
grant select on public.profiles, public.skills, public.profile_skills, public.project_templates,
  public.project_template_technologies, public.project_template_areas, public.projects,
  public.project_technologies, public.project_areas, public.project_members to authenticated;
grant update(name, avatar_url, bio, main_role, secondary_roles, availability, interests, github_url, linkedin_url)
  on public.profiles to authenticated;
grant select, update on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant select on public.evidences to authenticated;

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;
alter table public.project_templates enable row level security;
alter table public.project_template_technologies enable row level security;
alter table public.project_template_areas enable row level security;
alter table public.projects enable row level security;
alter table public.project_technologies enable row level security;
alter table public.project_areas enable row level security;
alter table public.project_members enable row level security;
alter table public.evidences enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy skills_read on public.skills for select to authenticated using (true);
create policy profile_skills_read on public.profile_skills for select to authenticated using (true);
create policy templates_read on public.project_templates for select to authenticated using (not archived);
create policy template_tech_read on public.project_template_technologies for select to authenticated
  using (exists (select 1 from public.project_templates t where t.id = template_id and not t.archived));
create policy template_areas_read on public.project_template_areas for select to authenticated
  using (exists (select 1 from public.project_templates t where t.id = template_id and not t.archived));
create policy projects_read on public.projects for select to authenticated using (true);
create policy projects_insert_self on public.projects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update_owner on public.projects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy project_tech_read on public.project_technologies for select to authenticated using (true);
create policy project_areas_read on public.project_areas for select to authenticated using (true);
create policy members_read on public.project_members for select to authenticated using (true);
create policy members_insert_self on public.project_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy members_delete_self on public.project_members for delete to authenticated
  using (user_id = (select auth.uid()));
create policy evidence_read_self on public.evidences for select to authenticated
  using (user_id = (select auth.uid()));
