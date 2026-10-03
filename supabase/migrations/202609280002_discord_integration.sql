create table public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'discord'),
  provider_user_id text not null check (provider_user_id ~ '^[0-9]{17,22}$'),
  provider_username text,
  provider_avatar text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider),
  unique (provider, provider_user_id)
);

create function private.sync_discord_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare discord_id text;
begin
  if tg_op = 'DELETE' then
    if old.provider = 'discord' then
      delete from public.user_integrations where user_id = old.user_id and provider = 'discord';
    end if;
    return old;
  end if;
  if new.provider <> 'discord' then return new; end if;
  discord_id := coalesce(new.provider_id, new.identity_data->>'sub');
  if discord_id !~ '^[0-9]{17,22}$' then
    raise exception 'Identidade Discord inválida';
  end if;
  insert into public.user_integrations
    (user_id, provider, provider_user_id, provider_username, provider_avatar)
  values (new.user_id, 'discord', discord_id,
    left(coalesce(new.identity_data->>'username', new.identity_data->>'name'), 120),
    left(new.identity_data->>'avatar_url', 500))
  on conflict (user_id, provider) do update set
    provider_user_id = excluded.provider_user_id,
    provider_username = excluded.provider_username,
    provider_avatar = excluded.provider_avatar,
    updated_at = now();
  return new;
end;
$$;
create trigger sync_discord_identity after insert or update or delete on auth.identities
for each row execute function private.sync_discord_identity();

insert into public.user_integrations
  (user_id, provider, provider_user_id, provider_username, provider_avatar)
select user_id, 'discord', provider_id,
  left(coalesce(identity_data->>'username', identity_data->>'name'), 120),
  left(identity_data->>'avatar_url', 500)
from auth.identities
where provider = 'discord' and provider_id ~ '^[0-9]{17,22}$'
on conflict (user_id, provider) do update set
  provider_user_id = excluded.provider_user_id,
  provider_username = excluded.provider_username,
  provider_avatar = excluded.provider_avatar,
  updated_at = now();

create table public.project_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider = 'discord'),
  external_id text,
  external_name text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'READ_ONLY', 'ARCHIVED', 'FAILED')),
  member_count integer not null default 0 check (member_count >= 0),
  synced_count integer not null default 0 check (synced_count >= 0 and synced_count <= member_count),
  last_error text check (length(last_error) <= 300),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider),
  unique (provider, external_id)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null check (provider = 'discord'),
  event_type text not null check (event_type in
    ('PROJECT_STARTED', 'PROJECT_COMPLETED', 'PROJECT_CANCELLED', 'PROJECT_ARCHIVED', 'DISCORD_RESYNC_REQUESTED')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (length(last_error) <= 300),
  retry_after timestamptz,
  lease_until timestamptz,
  processing_token uuid,
  external_message_id text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index integration_events_pending_idx on public.integration_events
  (project_id, created_at) where status in ('PENDING', 'PROCESSING');
create unique index integration_events_lifecycle_once_idx on public.integration_events
  (project_id, provider, event_type) where event_type <> 'DISCORD_RESYNC_REQUESTED';

create function private.queue_discord_lifecycle() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_name text;
begin
  if old.status = new.status then return new; end if;
  event_name := case new.status
    when 'ACTIVE' then 'PROJECT_STARTED'
    when 'COMPLETED' then 'PROJECT_COMPLETED'
    when 'CANCELLED' then 'PROJECT_CANCELLED'
    when 'ARCHIVED' then 'PROJECT_ARCHIVED'
    else null end;
  if event_name is null then return new; end if;
  insert into public.project_integrations(project_id, provider)
  values (new.id, 'discord') on conflict (project_id, provider) do nothing;
  insert into public.integration_events(project_id, provider, event_type)
  values (new.id, 'discord', event_name) on conflict do nothing;
  return new;
end;
$$;
create trigger queue_discord_lifecycle after update of status on public.projects
for each row execute function private.queue_discord_lifecycle();

alter table public.user_integrations enable row level security;
alter table public.project_integrations enable row level security;
alter table public.integration_events enable row level security;
grant execute on function private.is_admin() to authenticated;
revoke all on public.user_integrations, public.project_integrations, public.integration_events
  from anon, authenticated;
grant select on public.user_integrations, public.project_integrations, public.integration_events
  to authenticated;
create policy user_integrations_read_self on public.user_integrations for select to authenticated
  using (user_id = (select auth.uid()));
create policy project_integrations_read on public.project_integrations for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and
    (p.owner_id = (select auth.uid()) or (select private.is_admin()) or
      exists (select 1 from public.project_members m
        where m.project_id = p.id and m.user_id = (select auth.uid())))));
create policy integration_events_read on public.integration_events for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and
    (p.owner_id = (select auth.uid()) or (select private.is_admin()))));

create function public.discord_request_resync(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare event_id uuid;
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.owner_id <> auth.uid() and not private.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if target.status = 'FORMING' then raise exception 'O projeto ainda não foi iniciado'; end if;
  select id into event_id from public.integration_events
    where project_id = p_project_id and event_type = 'DISCORD_RESYNC_REQUESTED'
      and status in ('PENDING', 'PROCESSING') order by created_at desc limit 1;
  if event_id is null then
    insert into public.integration_events(project_id, provider, event_type)
    values (p_project_id, 'discord', 'DISCORD_RESYNC_REQUESTED') returning id into event_id;
  end if;
  if private.is_admin() then
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id)
    values (auth.uid(), 'DISCORD_RESYNC_REQUESTED', 'project', p_project_id::text);
  end if;
  return event_id;
end;
$$;

create function public.discord_retry_event(p_event_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target public.integration_events%rowtype;
declare owner_id uuid;
begin
  perform private.require_active();
  select * into target from public.integration_events where id = p_event_id for update;
  if not found then raise exception 'Evento não encontrado'; end if;
  select p.owner_id into owner_id from public.projects p where p.id = target.project_id;
  if owner_id <> auth.uid() and not private.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if target.status <> 'FAILED' then raise exception 'Evento não está em falha'; end if;
  if target.retry_after > now() then raise exception 'Aguarde o limite de chamadas do Discord'; end if;
  update public.integration_events set status = 'PENDING', last_error = null,
    retry_after = null, lease_until = null, processing_token = null where id = p_event_id;
  if private.is_admin() then
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id)
    values (auth.uid(), 'DISCORD_EVENT_RETRIED', 'integration_event', p_event_id::text);
  end if;
  return target.project_id;
end;
$$;

create function public.discord_claim_event(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.integration_events%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  select * into target from public.integration_events
  where project_id = p_project_id and
    (status = 'PENDING' or (status = 'PROCESSING' and lease_until < now()))
    and (retry_after is null or retry_after <= now())
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.integration_events set status = 'PROCESSING', attempts = attempts + 1,
    lease_until = now() + interval '2 minutes', processing_token = gen_random_uuid()
  where id = target.id returning * into target;
  return to_jsonb(target);
end;
$$;

create function public.admin_discord_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'connectedUsers', (select count(*) from public.user_integrations where provider = 'discord'),
    'connectedProjects', (select count(*) from public.project_integrations where external_id is not null),
    'pendingEvents', (select count(*) from public.integration_events where status in ('PENDING', 'PROCESSING')),
    'failedEvents', (select count(*) from public.integration_events where status = 'FAILED'));
end;
$$;

revoke all on function public.discord_request_resync(uuid), public.discord_retry_event(uuid),
  public.discord_claim_event(uuid), public.admin_discord_overview() from public, anon;
revoke all on function public.discord_claim_event(uuid) from authenticated;
grant execute on function public.discord_request_resync(uuid), public.discord_retry_event(uuid),
  public.admin_discord_overview() to authenticated;
grant execute on function public.discord_claim_event(uuid) to service_role;
revoke all on function private.sync_discord_identity(), private.queue_discord_lifecycle()
  from public, anon, authenticated;
