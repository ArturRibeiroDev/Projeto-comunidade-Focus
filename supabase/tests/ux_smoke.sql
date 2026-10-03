begin;
create temp table focusedu_ux_ids(id uuid) on commit drop;
insert into focusedu_ux_ids values (gen_random_uuid()), (gen_random_uuid());
grant select on focusedu_ux_ids to authenticated;
insert into auth.users(id, email, raw_user_meta_data)
select id, 'ux-test-' || row_number() over (order by id) || '@example.test', '{"name":"UX Smoke"}'::jsonb from focusedu_ux_ids;
set local role authenticated;

do $$
declare owner_id uuid;
declare other_id uuid;
declare project_id uuid;
declare replica_id uuid;
begin
  select id into owner_id from focusedu_ux_ids limit 1;
  select id into other_id from focusedu_ux_ids where id <> owner_id;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);

  project_id := public.create_planned_project_from_template(
    '00000000-0000-4000-8000-000000000002', '2026-10-01', '2026-10-29', 'Backend');
  if not exists (select 1 from public.projects where id = project_id and status = 'FORMING'
    and planned_start_date = '2026-10-01' and planned_end_date = '2026-10-29') then
    raise exception 'Template planning failed';
  end if;
  insert into storage.objects(bucket_id, name) values ('avatars', owner_id::text || '/own.png');
  begin
    insert into storage.objects(bucket_id, name) values ('avatars', other_id::text || '/foreign.png');
    raise exception 'Foreign avatar path accepted';
  exception when insufficient_privilege then null;
  end;
  perform public.update_project_with_plan(project_id, 'Biblioteca', 'Escopo', 'Objetivo', 5,
    '3 a 5 semanas', '[]', array['React'], array['Frontend'], '2026-10-02', '2026-10-30');
  if not exists (select 1 from public.projects where id = project_id and planned_start_date = '2026-10-02') then
    raise exception 'Planning edit failed';
  end if;
  replica_id := public.replicate_planned_project(project_id, null, null, 'Frontend');
  if not exists (select 1 from public.projects where id = replica_id and planned_start_date is null
    and planned_end_date is null) then
    raise exception 'Replica copied source schedule';
  end if;
  begin
    perform public.create_planned_project_from_template(
      '00000000-0000-4000-8000-000000000002', '2026-10-30', '2026-10-01', 'Backend');
    raise exception 'Invalid plan accepted';
  exception when others then
    if sqlerrm <> 'Data final anterior à inicial' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  begin
    perform public.update_project_with_plan(project_id, 'Alterado', 'Escopo', 'Objetivo', 5,
      '3 a 5 semanas', '[]', array['React'], array['Frontend'], null, null);
    raise exception 'Other user changed plan';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
