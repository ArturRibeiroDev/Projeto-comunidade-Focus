insert into public.project_template_areas(template_id, skill_id)
select template.id, area.id
from public.project_templates template
join public.skills area on area.kind = 'area' and lower(area.name) = lower('Backend')
where template.id = '00000000-0000-4000-8000-000000000006'::uuid
  and template.official
  and template.name = 'Dashboard de Dados Públicos'
on conflict (template_id, skill_id) do nothing;

update public.project_templates
set suggested_composition = '[{"role":"Backend","amount":1},{"role":"Data Analysis","amount":1},{"role":"Data Engineering","amount":1},{"role":"Frontend","amount":1},{"role":"UX/UI","amount":1}]'::jsonb
where id = '00000000-0000-4000-8000-000000000006'::uuid
  and official
  and name = 'Dashboard de Dados Públicos'
  and not exists (
    select 1
    from jsonb_array_elements(suggested_composition) role
    where lower(role->>'role') = 'backend'
  );
