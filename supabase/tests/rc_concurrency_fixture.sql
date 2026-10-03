-- Only used in the disposable database by scripts/rc-db-check.mjs. Not a remote smoke.
create schema rc_concurrency;
create table rc_concurrency.projects(id uuid);
create table rc_concurrency.requests(label text, id uuid);
grant usage on schema rc_concurrency to authenticated;
grant select, insert on rc_concurrency.projects, rc_concurrency.requests to authenticated;
insert into auth.users(id, raw_user_meta_data) values
  ('60000000-0000-4000-8000-000000000001', '{"name":"RC concurrent owner"}'),
  ('60000000-0000-4000-8000-000000000002', '{"name":"RC candidate A"}'),
  ('60000000-0000-4000-8000-000000000003', '{"name":"RC candidate B"}');
insert into public.user_integrations(user_id, provider, provider_user_id) values
  ('60000000-0000-4000-8000-000000000002', 'discord', '340000000000000001'),
  ('60000000-0000-4000-8000-000000000003', 'discord', '340000000000000002');
set role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', false);
insert into rc_concurrency.projects select public.create_project_from_template('00000000-0000-4000-8000-000000000002', 'Backend');
select public.update_project((select id from rc_concurrency.projects), 'RC concurrent approval', 'RC scope', '', 3, '', '[]', '{}', array['Backend', 'QA']);
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', false);
insert into rc_concurrency.requests select 'a', public.request_project_join((select id from rc_concurrency.projects), 'QA');
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', false);
insert into rc_concurrency.requests select 'b', public.request_project_join((select id from rc_concurrency.projects), 'Backend');
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', false);
select public.update_project((select id from rc_concurrency.projects), 'RC concurrent approval', 'RC scope', '', 2, '', '[]', '{}', array['Backend', 'QA']);
reset role;
