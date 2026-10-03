-- Run only against a linked test/development project. All writes are rolled back.
begin;

create temp table focusedu_test_ids (person text primary key, id uuid not null) on commit drop;
insert into focusedu_test_ids(person, id)
values ('a', gen_random_uuid()), ('b', gen_random_uuid()), ('c', gen_random_uuid());
grant select on focusedu_test_ids to authenticated;

insert into auth.users(id, raw_user_meta_data)
select id, jsonb_build_object('name', 'FocusEdu Integration Test') from focusedu_test_ids;
insert into public.user_integrations(user_id, provider, provider_user_id)
select id, 'discord', ('31000000000000000' || row_number() over (order by person))
from focusedu_test_ids;

set local role authenticated;

do $$
declare
  a uuid;
  b uuid;
  c uuid;
  v_template_id uuid;
  v_project_id uuid;
  v_community_id uuid;
  affected integer;
  request_id uuid;
begin
  select id into a from focusedu_test_ids where person = 'a';
  select id into b from focusedu_test_ids where person = 'b';
  select id into c from focusedu_test_ids where person = 'c';

  perform set_config('request.jwt.claim.sub', a::text, true);
  if (select count(*) from public.project_templates where official and not archived) != 9 then
    raise exception 'Expected nine readable official templates';
  end if;
  select id into v_template_id from public.project_templates where name = 'Sistema de Biblioteca';
  if v_template_id is null then raise exception 'Library template missing'; end if;

  perform public.update_my_profile(
    'FocusEdu Integration Test', '', 'Bio', 'Design de Serviço', array['QA'],
    'Disponível', array['Educação'], null, null, array['PostgreSQL'], array['UX/UI']
  );
  if not exists (select 1 from public.profiles where id = a and main_role = 'Design de Serviço' and bio = 'Bio') then
    raise exception 'Profile update failed';
  end if;

  v_project_id := public.create_project_from_template(v_template_id, 'Backend');
  if not exists (select 1 from public.projects where id = v_project_id and template_id = v_template_id and owner_id = a) then
    raise exception 'Template project ownership/link failed';
  end if;
  if not exists (select 1 from public.project_members where project_id = v_project_id and user_id = a) then
    raise exception 'Creator membership missing';
  end if;

  v_community_id := public.create_community_project(
    'FocusEdu Integration Test', 'Temporary project', 'Test', 3, 'Misto', '4 weeks',
    '[]'::jsonb, array['PostgreSQL'], array['QA'], array['PostgreSQL'], array['Test'], 'QA'
  );
  if not exists (select 1 from public.projects where id = v_community_id and owner_id = a and origin = 'community') then
    raise exception 'Community project creation failed';
  end if;
  if not exists (select 1 from public.project_technologies where project_id = v_community_id) or
     not exists (select 1 from public.project_areas where project_id = v_community_id) then
    raise exception 'Community project skill links missing';
  end if;

  begin
    update public.projects set owner_id = b where id = v_project_id;
    raise exception 'Owner transfer succeeded';
  exception when insufficient_privilege then null;
  end;

  perform public.update_project(v_project_id, 'Biblioteca teste', 'Temporary project', '', 2,
    '4 weeks', '[]', array['PostgreSQL'], array['QA']);
  perform set_config('request.jwt.claim.sub', b::text, true);
  update public.profiles set bio = 'Unauthorized' where id = a;
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'Cross-user profile update succeeded'; end if;
  if exists (select 1 from public.evidences where user_id = a) then
    raise exception 'Cross-user evidence read succeeded';
  end if;
  begin
    perform public.update_project(v_project_id, 'Unauthorized', 'Unauthorized', '', 2, '4 weeks', '[]', '{}', '{}');
    raise exception 'Cross-user project update succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.project_members where project_id = v_project_id and user_id = a;
    raise exception 'Direct membership delete succeeded';
  exception when insufficient_privilege then null;
  end;
  request_id := public.request_project_join(v_project_id, 'QA');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.decide_project_join_request(request_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', b::text, true);
  if not exists (select 1 from public.project_members where project_id = v_project_id and user_id = b) then
    raise exception 'Membership identity was not bound to auth.uid';
  end if;
  begin
    perform public.request_project_join(v_project_id, 'QA');
    raise exception 'Duplicate membership succeeded';
  exception when others then
      if sqlerrm != 'ALREADY_MEMBER' then raise; end if;
  end;

  begin
    update public.project_templates set name = 'Unauthorized' where id = v_template_id;
    raise exception 'Template modification succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.project_templates(name, description, difficulty, suggested_duration, recommended_max_members, official)
    values ('Unauthorized', 'Unauthorized', 'Misto', '4 weeks', 2, true);
    raise exception 'Template creation succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.evidences set label = 'Unauthorized' where user_id = a;
    raise exception 'Evidence modification succeeded';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.request_project_join(v_project_id, 'QA');
    raise exception 'Full project accepted another member';
  exception when others then
    if sqlerrm != 'PROJECT_FULL' then raise; end if;
  end;
  if (select count(*) from public.project_members where project_id = v_project_id) != 2 then
    raise exception 'Member limit exceeded';
  end if;

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform public.leave_project(v_project_id);
  request_id := public.request_project_join(v_project_id, 'QA');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.decide_project_join_request(request_id, 'APPROVED');
  perform set_config('request.jwt.claim.sub', b::text, true);
  if not exists (select 1 from public.project_members where project_id = v_project_id and user_id = b and main_role = 'QA') then
    raise exception 'Leave and rejoin failed';
  end if;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.transition_project(v_project_id, 'ACTIVE');
  perform public.transition_project(v_project_id, 'COMPLETED');
  perform set_config('request.jwt.claim.sub', c::text, true);
  begin
    perform public.request_project_join(v_project_id, 'Backend');
    raise exception 'Completed project accepted a member';
  exception when others then
    if sqlerrm != 'PROJECT_NOT_FORMING' then raise; end if;
  end;
end;
$$;

reset role;
rollback;
