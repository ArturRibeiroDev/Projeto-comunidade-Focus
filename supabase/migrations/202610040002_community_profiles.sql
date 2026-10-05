-- A public navigation key is separate from the Auth identifier. Existing RLS remains intact.
alter table public.profiles add column community_id uuid not null default gen_random_uuid() unique;

create function private.community_member_summary(p_user_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'memberKey', p.community_id, 'name', p.name, 'avatarUrl', p.avatar_url,
    'primaryRole', p.main_role, 'bio', p.bio, 'interests', p.interests,
    'areas', coalesce((select jsonb_agg(s.name order by s.name) from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id where ps.profile_id = p.id and s.kind = 'area'), '[]'::jsonb),
    'technologies', coalesce((select jsonb_agg(s.name order by s.name) from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id where ps.profile_id = p.id and s.kind = 'technology'), '[]'::jsonb)
  ) from public.profiles p where p.id = p_user_id;
$$;
revoke all on function private.community_member_summary(uuid) from public, anon, authenticated;

create function public.list_community_members(
  p_search text default '', p_area text default '', p_interest text default '', p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_active();
  if p_page is null or p_page < 0 or p_page > 10000 or
    length(p_search) > 120 or length(p_area) > 120 or length(p_interest) > 120 then
    raise exception 'INVALID_COMMUNITY_FILTER';
  end if;
  with matches as (
    select p.id, p.name from public.profiles p
    join public.platform_accounts a on a.user_id = p.id and a.account_status = 'ACTIVE'
    where (coalesce(p_search, '') = '' or strpos(lower(p.name), lower(trim(p_search))) > 0)
      and (coalesce(p_area, '') = '' or exists (select 1 from public.profile_skills ps
        join public.skills s on s.id = ps.skill_id where ps.profile_id = p.id and s.kind = 'area' and s.name = p_area))
      and (coalesce(p_interest, '') = '' or exists (select 1 from unnest(p.interests) interest
        where strpos(lower(interest), lower(trim(p_interest))) > 0))
    order by p.name, p.id limit 21 offset p_page * 20
  ), page as (select id, name from matches order by name, id limit 20)
  select jsonb_build_object('members', coalesce((select jsonb_agg(private.community_member_summary(id) order by name, id) from page), '[]'::jsonb),
    'hasMore', (select count(*) > 20 from matches)) into result;
  return result;
end;
$$;

create function public.get_community_member(p_member_key uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare target_id uuid; result jsonb;
begin
  perform private.require_active();
  select p.id into target_id from public.profiles p
  join public.platform_accounts a on a.user_id = p.id and a.account_status = 'ACTIVE'
  where p.community_id = p_member_key;
  if not found then return null; end if;
  select private.community_member_summary(p.id) || jsonb_build_object(
    'links', jsonb_build_object('github', p.github_url, 'linkedin', p.linkedin_url),
    'discordConnected', exists(select 1 from public.user_integrations ui where ui.user_id = p.id and ui.provider = 'discord'),
    'projects', coalesce((select jsonb_agg(to_jsonb(recent)) from (
      select pr.name, pr.status, pm.main_role as role from public.project_members pm
      join public.projects pr on pr.id = pm.project_id
      where pm.user_id = p.id and pr.moderation_status = 'APPROVED'
      order by pr.created_at desc, pr.id limit 20
    ) recent), '[]'::jsonb),
    'evidence', coalesce((select jsonb_agg(to_jsonb(recent)) from (
      select pr.name as "projectName", e.kind, e.role, e.recorded_at as "recordedAt"
      from public.evidences e join public.projects pr on pr.id = e.project_id
      where e.user_id = p.id and pr.moderation_status = 'APPROVED' and e.kind in ('join', 'completion')
      order by e.recorded_at desc, e.id limit 20
    ) recent), '[]'::jsonb)
  ) into result from public.profiles p where p.id = target_id;
  return result;
end;
$$;
revoke all on function public.list_community_members(text,text,text,integer) from public, anon;
revoke all on function public.get_community_member(uuid) from public, anon;
grant execute on function public.list_community_members(text,text,text,integer) to authenticated;
grant execute on function public.get_community_member(uuid) to authenticated;
