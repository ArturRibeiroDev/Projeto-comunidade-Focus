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
  where id = p_request_id;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  -- Match membership/request locks: user, project, then request.
  perform pg_advisory_xact_lock(hashtextextended(target_request.user_id::text, 0));

  select * into target
  from public.projects
  where id = target_request.project_id
  for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.owner_id <> uid then raise exception 'ONLY_OWNER_CAN_DECIDE_JOIN_REQUEST' using errcode = '42501'; end if;
  select * into target_request from public.project_join_requests where id = p_request_id for update;
  if not found then raise exception 'JOIN_REQUEST_NOT_FOUND'; end if;
  if target_request.status <> 'PENDING' then raise exception 'JOIN_REQUEST_NOT_PENDING'; end if;
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
    lease_until = now() + interval '15 minutes', processing_token = gen_random_uuid(),
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
      lease_until = now() + interval '15 minutes',
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
