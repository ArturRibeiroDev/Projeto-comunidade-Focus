alter table public.integration_events
  add column failure_kind text check (failure_kind in ('RETRYABLE', 'FINAL')),
  add column last_attempted_at timestamptz;

create index integration_events_worker_idx on public.integration_events
  (status, retry_after, created_at)
  where provider = 'discord' and status in ('PENDING', 'PROCESSING', 'FAILED');

update public.integration_events set
  failure_kind = case
    when status = 'FAILED' and retry_after is not null then 'RETRYABLE'
    when status = 'FAILED' then 'FINAL'
    else null
  end
where status = 'FAILED' and failure_kind is null;

create or replace function public.discord_claim_event(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.integration_events%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  select * into target from public.integration_events
  where project_id = p_project_id and provider = 'discord' and
    (status = 'PENDING' or (status = 'PROCESSING' and lease_until < now()))
    and (retry_after is null or retry_after <= now())
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.integration_events set status = 'PROCESSING', attempts = attempts + 1,
    lease_until = now() + interval '2 minutes', processing_token = gen_random_uuid(),
    retry_after = null, failure_kind = null, last_attempted_at = now()
  where id = target.id returning * into target;
  return to_jsonb(target);
end;
$$;

create or replace function public.discord_claim_events(p_limit integer default 10)
returns setof public.integration_events
language plpgsql security definer set search_path = '' as $$
declare safe_limit integer := least(greatest(coalesce(p_limit, 10), 1), 10);
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return query
  with candidates as (
    select e.id
    from public.integration_events e
    where e.provider = 'discord' and (
      (e.status = 'PENDING' and (e.retry_after is null or e.retry_after <= now())) or
      (e.status = 'FAILED' and e.failure_kind = 'RETRYABLE' and
        (e.retry_after is null or e.retry_after <= now()) and e.attempts < 5) or
      (e.status = 'PROCESSING' and e.lease_until < now())
    ) and not exists (
      select 1 from public.integration_events earlier
      where earlier.project_id = e.project_id
        and earlier.provider = e.provider
        and earlier.created_at < e.created_at
        and (earlier.status in ('PENDING', 'PROCESSING') or
          (earlier.status = 'FAILED' and earlier.failure_kind = 'RETRYABLE' and earlier.attempts < 5))
    )
    order by coalesce(e.retry_after, e.created_at), e.created_at
    for update skip locked
    limit safe_limit
  ),
  claimed as (
    update public.integration_events e set
      status = 'PROCESSING',
      attempts = e.attempts + 1,
      lease_until = now() + interval '2 minutes',
      processing_token = gen_random_uuid(),
      retry_after = null,
      failure_kind = null,
      last_attempted_at = now()
    from candidates c
    where e.id = c.id
    returning e.*
  )
  select * from claimed order by created_at;
end;
$$;

create or replace function public.discord_retry_event(p_event_id uuid) returns uuid
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
    retry_after = null, lease_until = null, processing_token = null, failure_kind = null
    where id = p_event_id;
  if private.is_admin() then
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id)
    values (auth.uid(), 'DISCORD_EVENT_RETRIED', 'integration_event', p_event_id::text);
  end if;
  return target.project_id;
end;
$$;

create or replace function public.admin_discord_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'connectedUsers', (select count(*) from public.user_integrations where provider = 'discord'),
    'connectedProjects', (select count(*) from public.project_integrations where provider = 'discord' and external_id is not null),
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

revoke all on function public.discord_claim_events(integer) from public, anon, authenticated;
grant execute on function public.discord_claim_events(integer) to service_role;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'focusedu-discord-events-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets
              where name = 'focusedu_project_url') || '/functions/v1/discord-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets
                   where name = 'focusedu_publishable_key'),
        'x-focusedu-worker-secret', (select decrypted_secret from vault.decrypted_secrets
                   where name = 'focusedu_discord_worker_secret')
      ),
      body := jsonb_build_object('action', 'worker', 'limit', 10),
      timeout_milliseconds := 10000
    ) as request_id;
  $$
);
