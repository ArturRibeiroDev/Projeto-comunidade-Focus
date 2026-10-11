alter table public.project_integrations
  add column channel_kind text not null default 'DISCORD_TEXT_CHANNEL'
    check (channel_kind in ('DISCORD_TEXT_CHANNEL', 'DISCORD_VOICE_CHANNEL')),
  add column voice_creation_started_at timestamptz;

alter table public.project_integrations drop constraint project_integrations_project_id_provider_key;
alter table public.project_integrations
  add constraint project_integrations_project_provider_kind_key
  unique (project_id, provider, channel_kind);

create or replace function private.queue_discord_lifecycle() returns trigger
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
  insert into public.project_integrations(project_id, provider, channel_kind)
  values
    (new.id, 'discord', 'DISCORD_TEXT_CHANNEL'),
    (new.id, 'discord', 'DISCORD_VOICE_CHANNEL')
  on conflict (project_id, provider, channel_kind) do nothing;
  insert into public.integration_events(project_id, provider, event_type)
  values (new.id, 'discord', event_name) on conflict do nothing;
  return new;
end;
$$;

create or replace function public.admin_discord_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'connectedUsers', (select count(*) from public.user_integrations where provider = 'discord'),
    'connectedProjects', (
      select count(distinct project_id)
      from public.project_integrations
      where provider = 'discord' and external_id is not null
    ),
    'pendingEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'PENDING'),
    'processingEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'PROCESSING'),
    'completedEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'COMPLETED'),
    'retryableFailedEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'FAILED' and failure_kind = 'RETRYABLE'),
    'finalFailedEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'FAILED' and failure_kind = 'FINAL'),
    'failedEvents', (select count(*) from public.integration_events where provider = 'discord' and status = 'FAILED'),
    'latestEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'projectId', e.project_id,
        'eventType', e.event_type,
        'status', e.status,
        'attempts', e.attempts,
        'failureKind', e.failure_kind,
        'lastError', e.last_error,
        'lastAttemptedAt', e.last_attempted_at,
        'nextAttemptAt', e.retry_after,
        'createdAt', e.created_at
      ) order by e.created_at desc)
      from (
        select id, project_id, event_type, status, attempts, failure_kind, last_error,
          last_attempted_at, retry_after, created_at
        from public.integration_events
        where provider = 'discord'
        order by created_at desc
        limit 10
      ) e
    ), '[]'::jsonb));
end;
$$;
