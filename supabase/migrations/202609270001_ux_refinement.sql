alter table public.projects
  add column planned_start_date date,
  add column planned_end_date date,
  add constraint projects_planned_dates_order check (
    planned_start_date is null or planned_end_date is null or planned_end_date >= planned_start_date
  );

alter table public.project_templates
  add column audience text not null default '',
  add column evolution_ideas text[] not null default '{}';

create function private.set_project_plan(p_project_id uuid, p_start date, p_end date)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.projects%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode = '42501'; end if;
  select * into target from public.projects where id = p_project_id for update;
  if not found then raise exception 'Projeto não encontrado'; end if;
  if target.owner_id <> auth.uid() then raise exception 'Somente o responsável pode planejar o projeto' using errcode = '42501'; end if;
  if target.status <> 'FORMING' then raise exception 'Somente projetos em formação podem ser planejados'; end if;
  if p_start is not null and p_end is not null and p_end < p_start then raise exception 'Data final anterior à inicial'; end if;
  update public.projects set planned_start_date = p_start, planned_end_date = p_end where id = p_project_id;
end;
$$;

create function public.create_planned_project_from_template(p_template_id uuid, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare project_id uuid;
begin
  project_id := public.create_project_from_template(p_template_id);
  perform private.set_project_plan(project_id, p_start, p_end);
  return project_id;
end;
$$;

create function public.replicate_planned_project(p_source_project_id uuid, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare project_id uuid;
begin
  project_id := public.replicate_project(p_source_project_id);
  perform private.set_project_plan(project_id, p_start, p_end);
  return project_id;
end;
$$;

create function public.create_planned_community_project(
  p_name text, p_description text, p_category text, p_max_members integer,
  p_difficulty text, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[], p_stacks text[], p_outcomes text[],
  p_start date, p_end date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare project_id uuid;
begin
  project_id := public.create_community_project(p_name, p_description, p_category, p_max_members,
    p_difficulty, p_duration, p_composition, p_technologies, p_areas, p_stacks, p_outcomes);
  perform private.set_project_plan(project_id, p_start, p_end);
  return project_id;
end;
$$;

create function public.update_project_with_plan(
  p_project_id uuid, p_name text, p_description text, p_objective text,
  p_max_members integer, p_duration text, p_composition jsonb,
  p_technologies text[], p_areas text[], p_start date, p_end date
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.update_project(p_project_id, p_name, p_description, p_objective,
    p_max_members, p_duration, p_composition, p_technologies, p_areas);
  perform private.set_project_plan(p_project_id, p_start, p_end);
end;
$$;

revoke all on function private.set_project_plan(uuid,date,date) from public, anon, authenticated;
revoke all on function public.create_planned_project_from_template(uuid,date,date) from public, anon;
revoke all on function public.replicate_planned_project(uuid,date,date) from public, anon;
revoke all on function public.create_planned_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],date,date) from public, anon;
revoke all on function public.update_project_with_plan(uuid,text,text,text,integer,text,jsonb,text[],text[],date,date) from public, anon;
grant execute on function public.create_planned_project_from_template(uuid,date,date) to authenticated;
grant execute on function public.replicate_planned_project(uuid,date,date) to authenticated;
grant execute on function public.create_planned_community_project(text,text,text,integer,text,text,jsonb,text[],text[],text[],text[],date,date) to authenticated;
grant execute on function public.update_project_with_plan(uuid,text,text,text,integer,text,jsonb,text[],text[],date,date) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

update public.project_templates set
  audience = case id::text
    when '00000000-0000-4000-8000-000000000001' then 'Equipes de suporte, colaboradores e clientes que acompanham solicitações.'
    when '00000000-0000-4000-8000-000000000002' then 'Leitores, bibliotecários e equipes de escolas ou bibliotecas comunitárias.'
    when '00000000-0000-4000-8000-000000000003' then 'Clientes, entregadores e estabelecimentos que recebem pedidos.'
    when '00000000-0000-4000-8000-000000000004' then 'Equipes de compras, estoque e gestão de pequenos negócios.'
    when '00000000-0000-4000-8000-000000000005' then 'Pessoas que querem acompanhar gastos e planejar objetivos financeiros.'
    when '00000000-0000-4000-8000-000000000006' then 'Cidadãos, jornalistas, pesquisadores e gestores públicos.'
    when '00000000-0000-4000-8000-000000000007' then 'Usuários e equipes que precisam de acesso seguro a um produto digital.'
    when '00000000-0000-4000-8000-000000000008' then 'Voluntários, beneficiários, doadores e gestores de organizações sociais.'
    when '00000000-0000-4000-8000-000000000009' then 'Comerciantes, atendentes e clientes de lojas de bairro.' end,
  evolution_ideas = case id::text
    when '00000000-0000-4000-8000-000000000001' then array['Base de conhecimento', 'SLA e alertas', 'Pesquisa de satisfação']
    when '00000000-0000-4000-8000-000000000002' then array['Recomendações de leitura', 'Acessibilidade do catálogo', 'Notificações de devolução']
    when '00000000-0000-4000-8000-000000000003' then array['Rastreamento em tempo real', 'Cupons', 'Análise de entregas']
    when '00000000-0000-4000-8000-000000000004' then array['Previsão de reposição', 'Leitura de código de barras', 'Integração com vendas']
    when '00000000-0000-4000-8000-000000000005' then array['Importação de extratos', 'Metas compartilhadas', 'Projeções de despesas']
    when '00000000-0000-4000-8000-000000000006' then array['Comparação entre períodos', 'Exportação acessível', 'Novas fontes públicas']
    when '00000000-0000-4000-8000-000000000007' then array['Autenticação multifator', 'Login social', 'Painel de auditoria']
    when '00000000-0000-4000-8000-000000000008' then array['Mapa de ações', 'Indicadores de impacto', 'Portal do doador']
    when '00000000-0000-4000-8000-000000000009' then array['Programa de fidelidade', 'Catálogo online', 'Previsão de demanda'] end,
  possible_stacks = case id::text
    when '00000000-0000-4000-8000-000000000001' then array['HTML + CSS + JavaScript', 'React ou Vue', 'Java + Spring', 'Python + Django', 'Node.js', '.NET']
    when '00000000-0000-4000-8000-000000000002' then array['HTML + CSS + JavaScript', 'React', 'Vue', 'Angular', 'Java + Spring', 'Python', 'PHP', 'Node.js', '.NET']
    when '00000000-0000-4000-8000-000000000003' then array['HTML + CSS + JavaScript', 'React ou Vue', 'Flutter', 'React Native', 'Kotlin', 'Node.js', 'Python']
    when '00000000-0000-4000-8000-000000000004' then array['HTML + CSS + JavaScript', 'React ou Vue', 'PHP', '.NET', 'Java + Spring', 'Python']
    when '00000000-0000-4000-8000-000000000005' then array['HTML + CSS + JavaScript', 'React', 'Vue', 'Flutter', 'Python', 'Node.js']
    when '00000000-0000-4000-8000-000000000006' then array['Planilha + Power BI', 'Python + Pandas', 'HTML + CSS + JavaScript', 'React', 'Vue']
    when '00000000-0000-4000-8000-000000000007' then array['HTML + CSS + JavaScript', 'Node.js', 'Java + Spring Security', '.NET Identity', 'Django Auth']
    when '00000000-0000-4000-8000-000000000008' then array['HTML + CSS + JavaScript', 'React ou Vue', 'Django', 'Laravel', 'Java + Spring', 'Flutter']
    when '00000000-0000-4000-8000-000000000009' then array['HTML + CSS + JavaScript', 'React ou Vue', 'PHP', 'Node.js', 'Java + Spring', '.NET'] end,
  updated_at = now()
where official and id::text between '00000000-0000-4000-8000-000000000001' and '00000000-0000-4000-8000-000000000009';
