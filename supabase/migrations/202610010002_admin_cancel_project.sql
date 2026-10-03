create or replace function public.transition_project(
  p_project_id uuid, p_target_status text,
  p_repository_url text default null, p_demo_url text default null,
  p_completion_summary text default null, p_cancellation_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
declare finished_at timestamptz;
declare missing_discord integer;
declare uid uuid := auth.uid();
declare admin_cancel boolean := false;
declare cancel_reason text := nullif(trim(coalesce(p_cancellation_reason, '')), '');
begin
  perform private.require_active();
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;

  admin_cancel := p_target_status = 'CANCELLED' and target.owner_id <> uid and private.is_admin();
  if target.owner_id <> uid and not admin_cancel then
    raise exception 'Somente o responsavel pode alterar o projeto' using errcode = '42501';
  end if;
  if admin_cancel and length(cancel_reason) not between 1 and 500 then
    raise exception 'ADMIN_CANCEL_REASON_REQUIRED';
  end if;
  if target.status = p_target_status then return; end if;

  if p_target_status = 'ACTIVE' and target.status = 'FORMING' then
    select count(*) into missing_discord
    from public.project_members m
    where m.project_id = p_project_id and not private.has_discord_integration(m.user_id);
    if missing_discord > 0 then raise exception 'PROJECT_START_DISCORD_REQUIRED:%', missing_discord; end if;
    update public.projects set status = 'ACTIVE', started_at = now() where id = p_project_id;
    update public.project_join_requests
    set status = 'CANCELLED', decided_at = now(), decided_by = uid,
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
      status = 'CANCELLED', cancelled_at = now(), cancellation_reason = cancel_reason
    where id = p_project_id;
    update public.project_join_requests
    set status = 'CANCELLED', decided_at = now(), decided_by = uid,
      decision_reason = 'Projeto cancelado.'
    where project_id = p_project_id and status = 'PENDING';
    if admin_cancel then
      insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, metadata)
      values (
        uid,
        'PROJECT_ADMIN_CANCELLED',
        'project',
        p_project_id::text,
        jsonb_build_object('reason', cancel_reason, 'previous_status', target.status)
      );
    end if;
  elsif p_target_status = 'ARCHIVED' and target.status in ('COMPLETED', 'CANCELLED') then
    update public.projects set status = 'ARCHIVED', archived_at = now() where id = p_project_id;
  else
    raise exception 'Transicao de projeto invalida';
  end if;
end;
$$;

revoke all on function public.transition_project(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.transition_project(uuid,text,text,text,text,text) to authenticated;
