-- Membership changes serialize with approval and lifecycle transitions.
create or replace function private.prevent_membership_leave() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target public.projects;
begin
  if auth.uid() is null then return old; end if;
  select * into target from public.projects where id = old.project_id for update;
  if not found then return old; end if;
  if old.user_id <> auth.uid() and target.owner_id <> auth.uid() then
    raise exception 'Participação de outro membro não pode ser removida' using errcode = '42501';
  end if;
  if old.user_id = target.owner_id then raise exception 'OWNER_CANNOT_LEAVE'; end if;
  if target.status <> 'FORMING' then
    raise exception 'Este projeto já está em andamento ou encerrado. Fale com o responsável pela squad.';
  end if;
  return old;
end;
$$;

create function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.projects;
begin
  perform private.require_active();
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into target from public.projects where id = p_project_id for update;
  if not found or target.owner_id <> auth.uid() then
    raise exception 'OWNER_REQUIRED';
  end if;
  if p_user_id = target.owner_id then raise exception 'OWNER_CANNOT_LEAVE'; end if;
  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
end;
$$;

create function public.update_my_project_role(p_project_id uuid, p_main_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.projects;
  canonical_role text;
begin
  perform private.require_active();
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if target.status <> 'FORMING' then raise exception 'PROJECT_NOT_FORMING'; end if;
  if not exists (select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()) then
    raise exception 'MEMBER_REQUIRED';
  end if;
  canonical_role := private.require_project_area_role(p_project_id, p_main_role);
  update public.project_members set main_role = canonical_role
  where project_id = p_project_id and user_id = auth.uid();
end;
$$;

revoke all on function public.remove_project_member(uuid,uuid) from public, anon;
revoke all on function public.update_my_project_role(uuid,text) from public, anon;
grant execute on function public.remove_project_member(uuid,uuid) to authenticated;
grant execute on function public.update_my_project_role(uuid,text) to authenticated;
