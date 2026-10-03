begin;

create temp table discord_worker_ids(person text primary key, id uuid not null) on commit drop;
insert into discord_worker_ids values ('owner', gen_random_uuid()), ('other', gen_random_uuid());
grant select on discord_worker_ids to authenticated, service_role;

insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', person) from discord_worker_ids;

create temp table discord_worker_projects(label text primary key, id uuid not null) on commit drop;
grant select, insert on discord_worker_projects to authenticated, service_role;

update public.platform_settings
set max_owned_open_projects_per_user = 50,
  max_project_creations_per_day = 50,
  max_projects_joined_simultaneously = 50
where singleton;

set local role authenticated;
do $$
declare owner_id uuid;
declare project_id uuid;
declare label text;
begin
  select id into owner_id from discord_worker_ids where person = 'owner';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  foreach label in array array[
    'batch_a', 'batch_b', 'batch_c', 'retryable', 'final', 'max_attempts',
    'future_retry', 'manual_retry'
  ] loop
    project_id := public.create_community_project('Discord worker ' || label, 'Descrição',
      'Comunidade', 3, 'Misto', '4 semanas', '[]'::jsonb, '{}', array['Backend'], '{}', '{}', 'Backend');
    insert into discord_worker_projects values (label, project_id);
  end loop;
end $$;
reset role;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub',
    (select id::text from discord_worker_ids where person = 'owner'), true);
  begin
    perform public.discord_claim_events(1);
    raise exception 'Authenticated user claimed worker events';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

insert into public.integration_events(project_id, provider, event_type, created_at)
select id, 'discord', 'DISCORD_RESYNC_REQUESTED',
  now() + (row_number() over (order by label) * interval '1 second')
from discord_worker_projects
where label in ('batch_a', 'batch_b', 'batch_c');

set local role service_role;
do $$
declare claim_count integer;
declare second_count integer;
declare duplicated integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  create temp table discord_worker_claimed_once on commit drop as
    select id, attempts from public.discord_claim_events(2);
  select count(*) into claim_count from discord_worker_claimed_once;
  if claim_count <> 2 then
    raise exception 'Worker claim did not respect batch limit';
  end if;
  if exists (
    select 1 from public.integration_events e
    join discord_worker_claimed_once c on c.id = e.id
    where e.status <> 'PROCESSING' or e.attempts <> 1 or
      e.processing_token is null or e.last_attempted_at is null or e.lease_until < now() + interval '14 minutes'
  ) then
    raise exception 'Claimed events were not marked as PROCESSING atomically';
  end if;

  create temp table discord_worker_claimed_twice on commit drop as
    select id from public.discord_claim_events(10);
  select count(*) into second_count from discord_worker_claimed_twice;
  if second_count <> 1 then
    raise exception 'Second worker claim did not pick remaining eligible event';
  end if;
  select count(*) into duplicated
  from discord_worker_claimed_once once
  join discord_worker_claimed_twice twice on twice.id = once.id;
  if duplicated <> 0 then
    raise exception 'Worker claimed the same event twice';
  end if;
end $$;
reset role;

set local role service_role;
do $$
declare stale_id uuid;
declare claimed_id uuid;
declare claimed_attempts integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  select e.id into stale_id
  from public.integration_events e
  join discord_worker_projects p on p.id = e.project_id
  where p.label = 'batch_a';
  update public.integration_events
    set lease_until = now() - interval '1 second'
    where id = stale_id;
  select id, attempts into claimed_id, claimed_attempts
  from public.discord_claim_events(1)
  limit 1;
  if claimed_id <> stale_id or claimed_attempts <> 2 then
    raise exception 'Stale PROCESSING event was not reclaimed safely';
  end if;
end $$;
reset role;

insert into public.integration_events(project_id, provider, event_type, status, attempts,
  failure_kind, retry_after, last_error)
select id, 'discord', 'DISCORD_RESYNC_REQUESTED',
  case label when 'retryable' then 'FAILED' when 'final' then 'FAILED'
    when 'max_attempts' then 'FAILED' when 'future_retry' then 'FAILED' end,
  case label when 'max_attempts' then 5 else 1 end,
  case label when 'final' then 'FINAL' else 'RETRYABLE' end,
  case label when 'future_retry' then now() + interval '1 hour' else now() - interval '1 minute' end,
  'worker smoke'
from discord_worker_projects
where label in ('retryable', 'final', 'max_attempts', 'future_retry');

set local role service_role;
do $$
declare claim_count integer;
declare retryable_claimed integer;
declare blocked_claimed integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  create temp table discord_worker_failed_claims on commit drop as
    select e.id, p.label
    from public.discord_claim_events(10) e
    join discord_worker_projects p on p.id = e.project_id;
  select count(*) into claim_count from discord_worker_failed_claims;
  select count(*) into retryable_claimed from discord_worker_failed_claims
    where label = 'retryable';
  select count(*) into blocked_claimed from discord_worker_failed_claims
    where label in ('final', 'max_attempts', 'future_retry');
  if claim_count <> 1 or retryable_claimed <> 1 or blocked_claimed <> 0 then
    raise exception 'Worker did not distinguish retryable, final, max attempts, and backoff';
  end if;
end $$;
reset role;

insert into public.integration_events(project_id, provider, event_type, status, attempts,
  failure_kind, retry_after, last_error)
select id, 'discord', 'DISCORD_RESYNC_REQUESTED', 'FAILED', 5, 'FINAL', null, 'manual retry'
from discord_worker_projects
where label = 'manual_retry';

set local role authenticated;
do $$
declare owner_id uuid;
declare other_id uuid;
declare event_id uuid;
begin
  select id into owner_id from discord_worker_ids where person = 'owner';
  select id into other_id from discord_worker_ids where person = 'other';
  select e.id into event_id
  from public.integration_events e
  join discord_worker_projects p on p.id = e.project_id
  where p.label = 'manual_retry';

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  begin
    perform public.discord_retry_event(event_id);
    raise exception 'Non-owner retried worker failed event';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.discord_retry_event(event_id);
  if exists (
    select 1 from public.integration_events
    where id = event_id and (status <> 'PENDING' or failure_kind is not null or
      retry_after is not null or processing_token is not null)
  ) then
    raise exception 'Manual retry did not reset failed event';
  end if;
end $$;
reset role;

rollback;
