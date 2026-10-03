create table public.project_join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  main_role text not null check (length(trim(main_role)) between 1 and 80),
  contribution_intent text not null default '' check (length(contribution_intent) <= 1200),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_reason text check (decision_reason is null or length(trim(decision_reason)) between 1 and 500),
  constraint project_join_request_decision_check check (
    (status = 'PENDING' and decided_at is null and decided_by is null) or
    (status <> 'PENDING' and decided_at is not null)
  )
);
create index project_join_requests_project_status_idx
  on public.project_join_requests(project_id, status, requested_at desc);
create index project_join_requests_user_idx on public.project_join_requests(user_id, requested_at desc);
create unique index project_join_requests_one_pending
  on public.project_join_requests(project_id, user_id) where status = 'PENDING';

alter table public.project_join_requests enable row level security;
revoke all on public.project_join_requests from public, anon, authenticated;
grant select on public.project_join_requests to authenticated;
create policy join_requests_read_participants on public.project_join_requests for select to authenticated
  using (
    user_id = (select auth.uid()) or
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.owner_id = (select auth.uid()) or (select private.is_staff()))
    )
  );

create table public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('PROJECT_COMPLETED')),
  points integer not null check (points > 0 and points <= 1000),
  source_type text not null check (source_type in ('project')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, source_type, source_id)
);
create index gamification_events_user_idx on public.gamification_events(user_id, created_at desc);

create table public.gamification_achievements (
  code text primary key,
  name text not null,
  description text not null,
  sort_order integer not null unique
);
insert into public.gamification_achievements(code, name, description, sort_order) values
  ('FIRST_PROJECT', 'Primeiro projeto', 'Concluiu seu primeiro projeto em squad.', 10),
  ('THREE_PROJECTS', 'Trinca de entregas', 'Concluiu 3 projetos em squad.', 20),
  ('FIVE_PROJECTS', 'Cinco entregas', 'Concluiu 5 projetos em squad.', 30),
  ('TEAM_BUILDER', 'Lideranca de squad', 'Concluiu um projeto como lider/owner.', 40),
  ('MULTIDISCIPLINARY', 'Multidisciplinar', 'Concluiu projetos com evidencias em 3 areas distintas.', 50)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_code text not null references public.gamification_achievements(code) on delete restrict,
  unlocked_at timestamptz not null default now(),
  source_type text not null default 'project' check (source_type in ('project')),
  source_id uuid,
  primary key (user_id, achievement_code)
);
create index user_achievements_recent_idx on public.user_achievements(user_id, unlocked_at desc);

alter table public.gamification_events enable row level security;
alter table public.gamification_achievements enable row level security;
alter table public.user_achievements enable row level security;
revoke all on public.gamification_events, public.gamification_achievements, public.user_achievements
  from public, anon, authenticated;
grant select on public.gamification_events, public.gamification_achievements, public.user_achievements
  to authenticated;
create policy gamification_events_read_self on public.gamification_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy gamification_achievements_read on public.gamification_achievements for select to authenticated
  using (true);
create policy user_achievements_read on public.user_achievements for select to authenticated
  using (
    user_id = (select auth.uid()) or
    exists (select 1 from public.profiles p where p.id = user_id)
  );

create function private.has_discord_integration(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_integrations ui
    where ui.user_id = p_user_id
      and ui.provider = 'discord'
      and ui.provider_user_id ~ '^[0-9]{17,22}$'
  );
$$;

create function private.active_membership_count(p_user_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.project_members m
  join public.projects p on p.id = m.project_id
  where m.user_id = p_user_id and p.status in ('FORMING', 'ACTIVE');
$$;

create function private.award_project_completion(p_project_id uuid, p_finished_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare member record;
declare completed_count integer;
declare area_count integer;
declare project_owner uuid;
begin
  select owner_id into project_owner from public.projects where id = p_project_id;

  for member in
    select m.user_id
    from public.project_members m
    where m.project_id = p_project_id
  loop
    insert into public.gamification_events(user_id, event_type, points, source_type, source_id, created_at)
    values (member.user_id, 'PROJECT_COMPLETED', 100, 'project', p_project_id, p_finished_at)
    on conflict do nothing;

    select count(*) into completed_count
    from public.gamification_events
    where user_id = member.user_id and event_type = 'PROJECT_COMPLETED';

    if completed_count >= 1 then
      insert into public.user_achievements(user_id, achievement_code, unlocked_at, source_id)
      values (member.user_id, 'FIRST_PROJECT', p_finished_at, p_project_id)
      on conflict do nothing;
    end if;
    if completed_count >= 3 then
      insert into public.user_achievements(user_id, achievement_code, unlocked_at, source_id)
      values (member.user_id, 'THREE_PROJECTS', p_finished_at, p_project_id)
      on conflict do nothing;
    end if;
    if completed_count >= 5 then
      insert into public.user_achievements(user_id, achievement_code, unlocked_at, source_id)
      values (member.user_id, 'FIVE_PROJECTS', p_finished_at, p_project_id)
      on conflict do nothing;
    end if;
    if member.user_id = project_owner then
      insert into public.user_achievements(user_id, achievement_code, unlocked_at, source_id)
      values (member.user_id, 'TEAM_BUILDER', p_finished_at, p_project_id)
      on conflict do nothing;
    end if;

    select count(distinct pa.skill_id) into area_count
    from public.gamification_events ge
    join public.project_areas pa on pa.project_id = ge.source_id
    where ge.user_id = member.user_id
      and ge.event_type = 'PROJECT_COMPLETED'
      and ge.source_type = 'project';
    if area_count >= 3 then
      insert into public.user_achievements(user_id, achievement_code, unlocked_at, source_id)
      values (member.user_id, 'MULTIDISCIPLINARY', p_finished_at, p_project_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function private.enforce_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare member_count integer;
declare joined_count integer;
declare max_joined integer;
declare trusted_write boolean := coalesce(current_setting('focusedu.membership_write', true), '') = 'trusted';
begin
  perform private.require_active();
  if not trusted_write then
    new.user_id := auth.uid();
  elsif new.user_id is null then
    raise exception 'Membro invalido';
  end if;
  new.joined_at := now();
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select * into target from public.projects where id = new.project_id for update;
  if not found then raise exception 'Projeto nao encontrado'; end if;
  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  if target.owner_id <> new.user_id and target.moderation_status <> 'APPROVED' then
    raise exception 'PROJECT_NOT_APPROVED';
  end if;
  select count(*) into member_count from public.project_members where project_id = new.project_id;
  if member_count >= target.max_members then raise exception 'PROJECT_FULL'; end if;
  select max_projects_joined_simultaneously into max_joined from public.platform_settings where singleton;
  select private.active_membership_count(new.user_id) into joined_count;
  if joined_count >= max_joined then raise exception 'JOINED_PROJECT_LIMIT:%', max_joined; end if;
  return new;
end;
$$;

create or replace function public.request_project_join(
  p_project_id uuid,
  p_main_role text,
  p_contribution_intent text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target public.projects%rowtype;
declare member_count integer;
declare pending_count integer;
declare max_joined integer;
declare request_id uuid;
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
  if exists (select 1 from public.project_members where project_id = p_project_id and user_id = uid) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (
    select 1 from public.project_join_requests
    where project_id = p_project_id and user_id = uid and status = 'PENDING'
  ) then
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
  values (p_project_id, uid, trim(p_main_role), trim(coalesce(p_contribution_intent, '')))
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.decide_project_join_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target_request public.project_join_requests%rowtype;
declare target public.projects%rowtype;
declare member_count integer;
begin
  perform private.require_active();
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'INVALID_DECISION'; end if;

  select * into target_request
  from public.project_join_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  if target_request.status <> 'PENDING' then raise exception 'JOIN_REQUEST_NOT_PENDING'; end if;

  select * into target
  from public.projects
  where id = target_request.project_id
  for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.owner_id <> uid then raise exception 'ONLY_OWNER_CAN_DECIDE_JOIN_REQUEST' using errcode = '42501'; end if;
  if target_request.user_id = uid then raise exception 'OWNER_CANNOT_APPROVE_SELF' using errcode = '42501'; end if;

  if p_decision = 'REJECTED' then
    update public.project_join_requests
    set status = 'REJECTED', decided_at = now(), decided_by = uid,
      decision_reason = nullif(trim(p_reason), '')
    where id = p_request_id;
    return target_request.project_id;
  end if;

  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  if target.moderation_status <> 'APPROVED' then raise exception 'PROJECT_NOT_APPROVED'; end if;
  if exists (
    select 1 from public.project_members
    where project_id = target_request.project_id and user_id = target_request.user_id
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if not exists (
    select 1 from public.platform_accounts
    where user_id = target_request.user_id and account_status = 'ACTIVE'
  ) then raise exception 'ACCOUNT_SUSPENDED'; end if;
  if not private.has_discord_integration(target_request.user_id) then raise exception 'DISCORD_REQUIRED'; end if;

  select count(*) into member_count from public.project_members where project_id = target_request.project_id;
  if member_count >= target.max_members then raise exception 'PROJECT_FULL'; end if;

  perform set_config('focusedu.membership_write', 'trusted', true);
  insert into public.project_members(project_id, user_id, main_role, contribution_intent)
  values (
    target_request.project_id,
    target_request.user_id,
    target_request.main_role,
    target_request.contribution_intent
  );

  update public.project_join_requests
  set status = 'APPROVED', decided_at = now(), decided_by = uid,
    decision_reason = nullif(trim(p_reason), '')
  where id = p_request_id;
  return target_request.project_id;
end;
$$;

create or replace function public.cancel_project_join_request(p_request_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target_request public.project_join_requests%rowtype;
begin
  perform private.require_active();
  select * into target_request from public.project_join_requests where id = p_request_id for update;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  if target_request.user_id <> uid then raise exception 'JOIN_REQUEST_CANCEL_DENIED' using errcode = '42501'; end if;
  if target_request.status <> 'PENDING' then raise exception 'JOIN_REQUEST_NOT_PENDING'; end if;
  update public.project_join_requests
  set status = 'CANCELLED', decided_at = now(), decided_by = uid
  where id = p_request_id;
  return target_request.project_id;
end;
$$;

create or replace function public.leave_project(p_project_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare target_owner uuid;
begin
  perform private.require_active();
  select owner_id into target_owner from public.projects where id = p_project_id;
  if target_owner = uid then raise exception 'OWNER_CANNOT_LEAVE_PROJECT'; end if;
  delete from public.project_members
  where project_id = p_project_id and user_id = uid;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
end;
$$;

create or replace function public.get_project_discord_readiness(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.owner_id <> auth.uid() and not private.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'readyCount', (
      select count(*)
      from public.project_members m
      where m.project_id = p_project_id and private.has_discord_integration(m.user_id)
    ),
    'memberCount', (
      select count(*) from public.project_members m where m.project_id = p_project_id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id,
        'name', p.name,
        'avatarUrl', p.avatar_url,
        'role', m.main_role,
        'discordConnected', private.has_discord_integration(m.user_id)
      ) order by p.name)
      from public.project_members m
      join public.profiles p on p.id = m.user_id
      where m.project_id = p_project_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_my_gamification() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
declare total_points integer;
begin
  perform private.require_active();
  select coalesce(sum(points), 0)::integer into total_points
  from public.gamification_events
  where user_id = uid;
  return jsonb_build_object(
    'points', total_points,
    'level', case
      when total_points >= 900 then 5
      when total_points >= 500 then 4
      when total_points >= 250 then 3
      when total_points >= 100 then 2
      else 1
    end,
    'currentLevelPoints', case
      when total_points >= 900 then 900
      when total_points >= 500 then 500
      when total_points >= 250 then 250
      when total_points >= 100 then 100
      else 0
    end,
    'nextLevelPoints', case
      when total_points >= 900 then null
      when total_points >= 500 then 900
      when total_points >= 250 then 500
      when total_points >= 100 then 250
      else 100
    end,
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code,
        'name', a.name,
        'description', a.description,
        'unlockedAt', ua.unlocked_at
      ) order by a.sort_order)
      from public.gamification_achievements a
      left join public.user_achievements ua
        on ua.achievement_code = a.code and ua.user_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.transition_project(
  p_project_id uuid, p_target_status text,
  p_repository_url text default null, p_demo_url text default null,
  p_completion_summary text default null, p_cancellation_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare finished_at timestamptz;
declare missing_discord integer;
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.owner_id <> auth.uid() then raise exception 'Somente o responsavel pode alterar o projeto' using errcode = '42501'; end if;
  if target.status = p_target_status then return; end if;

  if p_target_status = 'ACTIVE' and target.status = 'FORMING' then
    select count(*) into missing_discord
    from public.project_members m
    where m.project_id = p_project_id and not private.has_discord_integration(m.user_id);
    if missing_discord > 0 then raise exception 'PROJECT_START_DISCORD_REQUIRED:%', missing_discord; end if;
    update public.projects set status = 'ACTIVE', started_at = now() where id = p_project_id;
    update public.project_join_requests
    set status = 'CANCELLED', decided_at = now(), decided_by = auth.uid(),
      decision_reason = 'Projeto iniciado antes da decisao.'
    where project_id = p_project_id and status = 'PENDING';
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
    perform private.award_project_completion(p_project_id, finished_at);
  elsif p_target_status = 'CANCELLED' and target.status in ('FORMING', 'ACTIVE') then
    update public.projects set
      status = 'CANCELLED', cancelled_at = now(), cancellation_reason = nullif(trim(p_cancellation_reason), '')
    where id = p_project_id;
    update public.project_join_requests
    set status = 'CANCELLED', decided_at = now(), decided_by = auth.uid(),
      decision_reason = 'Projeto cancelado.'
    where project_id = p_project_id and status = 'PENDING';
  elsif p_target_status = 'ARCHIVED' and target.status in ('COMPLETED', 'CANCELLED') then
    update public.projects set status = 'ARCHIVED', archived_at = now() where id = p_project_id;
  else
    raise exception 'Transicao de projeto invalida';
  end if;
end;
$$;

revoke insert, delete on public.project_members from authenticated;
drop policy if exists members_insert_self on public.project_members;
drop policy if exists members_delete_self on public.project_members;

revoke all on function public.request_project_join(uuid,text,text) from public, anon;
revoke all on function public.decide_project_join_request(uuid,text,text) from public, anon;
revoke all on function public.cancel_project_join_request(uuid) from public, anon;
revoke all on function public.leave_project(uuid) from public, anon;
revoke all on function public.get_project_discord_readiness(uuid) from public, anon;
revoke all on function public.get_my_gamification() from public, anon;
grant execute on function public.request_project_join(uuid,text,text) to authenticated;
grant execute on function public.decide_project_join_request(uuid,text,text) to authenticated;
grant execute on function public.cancel_project_join_request(uuid) to authenticated;
grant execute on function public.leave_project(uuid) to authenticated;
grant execute on function public.get_project_discord_readiness(uuid) to authenticated;
grant execute on function public.get_my_gamification() to authenticated;

revoke all on function private.has_discord_integration(uuid), private.active_membership_count(uuid),
  private.award_project_completion(uuid,timestamptz) from public, anon, authenticated;
