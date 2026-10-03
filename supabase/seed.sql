-- Reproducible official scopes. No users or sample memberships are inserted.
insert into public.project_templates (
  id, name, description, category, problem, objective, suggested_features,
  acceptance_criteria, difficulty, suggested_duration, recommended_max_members,
  suggested_composition, possible_stacks, outcomes, official, archived
) values
  ('00000000-0000-4000-8000-000000000001', 'Sistema de Chamados / Help Desk',
   'Fluxo de abertura, triagem, priorização e resolução de chamados internos ou de clientes.',
   'Operações', 'Solicitações sem acompanhamento dificultam a resolução.',
   'Organizar o ciclo completo de atendimento.',
   array['Abrir chamado com categoria e prioridade','Acompanhar status e responsável','Registrar interações e solução','Buscar chamados e filtrar por equipe','Visualizar indicadores de atendimento'],
   array['Uma solicitação percorre abertura, atendimento e resolução.','Cliente e atendente conseguem consultar o histórico.','O painel reflete os chamados registrados.'],
   'Intermediário', '4 a 6 semanas', 6,
   '[{"role":"Backend","amount":1},{"role":"Frontend","amount":1},{"role":"UX/UI","amount":1},{"role":"QA","amount":1}]',
   array['HTML + CSS + JavaScript','React ou Vue','Java + Spring','Python + Django','Node.js','.NET'],
   array['CRUD de chamados','Controle de status','Histórico de interações','Painel de métricas'], true, false),
  ('00000000-0000-4000-8000-000000000002', 'Sistema de Biblioteca',
   'Cadastro de acervo, empréstimos, devoluções, reservas e histórico de leitores.',
   'Educação', 'Acervos e empréstimos precisam de controle acessível.',
   'Facilitar a consulta e a circulação de livros.',
   array['Pesquisar o acervo por título e assunto','Ver disponibilidade de exemplares','Registrar empréstimo e devolução','Reservar item indisponível','Consultar histórico do leitor'],
   array['Um leitor encontra um livro e vê sua disponibilidade.','Empréstimo e devolução atualizam o estado do exemplar.','A reserva mantém a ordem de solicitação.'],
   'Iniciante', '3 a 5 semanas', 5,
   '[{"role":"Backend","amount":1},{"role":"Frontend","amount":1},{"role":"UX/UI","amount":1},{"role":"QA","amount":1}]',
   array['HTML + CSS + JavaScript','React','Vue','Angular','Java + Spring','Python','PHP','Node.js','.NET'],
   array['Catálogo pesquisável','Fluxo de empréstimo','Reservas','Relatórios simples'], true, false),
  ('00000000-0000-4000-8000-000000000003', 'Sistema de Delivery',
   'Cardápio, pedidos, acompanhamento de entrega e visão operacional para estabelecimentos.',
   'Comércio', 'Pedidos dispersos dificultam a operação de entregas.',
   'Conectar o pedido do cliente à operação do estabelecimento.',
   array['Explorar cardápio e montar pedido','Informar endereço e confirmar compra','Acompanhar etapas de preparo e entrega','Gerenciar pedidos no estabelecimento','Visualizar histórico de pedidos'],
   array['O cliente consegue finalizar um pedido completo.','O estabelecimento pode atualizar o estado sem perder o histórico.','O acompanhamento mostra o estado atual ao cliente.'],
   'Avançado', '6 a 8 semanas', 7,
   '[{"role":"Mobile","amount":1},{"role":"Backend","amount":1},{"role":"UX/UI","amount":1},{"role":"QA","amount":1}]',
   array['HTML + CSS + JavaScript','React ou Vue','Flutter','React Native','Kotlin','Node.js','Python'],
   array['Catálogo de produtos','Carrinho','Acompanhamento de pedido','Dashboard do lojista'], true, false),
  ('00000000-0000-4000-8000-000000000004', 'Sistema de Estoque',
   'Controle de entradas, saídas, níveis mínimos, fornecedores e movimentações.',
   'Gestão', 'Movimentações manuais reduzem a confiabilidade do estoque.',
   'Dar visibilidade às quantidades e necessidades de reposição.',
   array['Cadastrar produtos e fornecedores','Registrar entradas e saídas','Consultar saldos e movimentações','Destacar itens abaixo do mínimo','Exportar relatório simples'],
   array['Uma movimentação atualiza o saldo corretamente.','O histórico identifica data e motivo da alteração.','Itens abaixo do mínimo aparecem em uma visão clara.'],
   'Intermediário', '4 a 6 semanas', 6,
   '[{"role":"Backend","amount":1},{"role":"Frontend","amount":1},{"role":"QA","amount":1},{"role":"Product","amount":1}]',
   array['HTML + CSS + JavaScript','React ou Vue','PHP','.NET','Java + Spring','Python'],
   array['Movimentações de estoque','Alertas de reposição','Cadastro de fornecedores','Auditoria básica'], true, false),
  ('00000000-0000-4000-8000-000000000005', 'Sistema Financeiro Pessoal',
   'Organização de receitas, despesas, metas, categorias e projeções simples.',
   'Finanças', 'Despesas e metas sem registro dificultam decisões pessoais.',
   'Oferecer uma visão clara das finanças do usuário.',
   array['Registrar receitas e despesas','Organizar por categoria e período','Definir metas financeiras','Ver resumo mensal acessível','Explorar evolução dos gastos'],
   array['O resumo mensal corresponde aos lançamentos.','A pessoa consegue distinguir receitas de despesas.','Metas mostram avanço sem exigir conexão bancária.'],
   'Iniciante', '3 a 4 semanas', 5,
   '[{"role":"Frontend","amount":1},{"role":"Backend","amount":1},{"role":"UX/UI","amount":1}]',
   array['HTML + CSS + JavaScript','React','Vue','Flutter','Python','Node.js'],
   array['Lançamentos financeiros','Categorias','Metas','Resumo mensal'], true, false),
  ('00000000-0000-4000-8000-000000000006', 'Dashboard de Dados Públicos',
   'Coleta, tratamento e visualização de dados públicos em indicadores acessíveis.',
   'Dados', 'Dados públicos dispersos são difíceis de interpretar.',
   'Tornar indicadores relevantes fáceis de explorar.',
   array['Selecionar fonte pública documentada','Limpar e organizar dados','Construir indicadores filtráveis','Visualizar séries e recortes','Exibir fonte e atualização dos dados'],
   array['Cada indicador informa fonte e período.','Os filtros alteram os resultados de forma coerente.','A visualização funciona em desktop e mobile.'],
   'Misto', '4 a 6 semanas', 6,
   '[{"role":"Backend","amount":1},{"role":"Data Analysis","amount":1},{"role":"Data Engineering","amount":1},{"role":"Frontend","amount":1},{"role":"UX/UI","amount":1}]',
   array['Planilha + Power BI','Python + Pandas','HTML + CSS + JavaScript','React','Vue'],
   array['Pipeline simples','Indicadores filtráveis','Visualizações responsivas','Documentação da fonte'], true, false),
  ('00000000-0000-4000-8000-000000000007', 'Sistema de Autenticação',
   'Base reutilizável para cadastro, login, permissões, recuperação de senha e auditoria.',
   'Infraestrutura de Produto', 'Aplicações precisam controlar acesso com segurança.',
   'Construir fluxos de identidade reutilizáveis.',
   array['Criar conta e entrar com segurança','Recuperar acesso','Controlar permissões por papel','Proteger telas e operações sensíveis','Registrar eventos essenciais de acesso'],
   array['Usuários acessam apenas recursos autorizados.','A recuperação de acesso não expõe dados sensíveis.','Fluxos de erro não revelam se uma conta existe.'],
   'Intermediário', '3 a 5 semanas', 5,
   '[{"role":"Backend","amount":1},{"role":"Cybersecurity","amount":1},{"role":"Frontend","amount":1},{"role":"QA","amount":1}]',
   array['HTML + CSS + JavaScript','Node.js','Java + Spring Security','.NET Identity','Django Auth'],
   array['Login e cadastro','Papéis e permissões','Recuperação de senha','Checklist de segurança'], true, false),
  ('00000000-0000-4000-8000-000000000008', 'Sistema para ONG',
   'Gestão de voluntários, campanhas, doações, beneficiários e prestação de contas.',
   'Impacto Social', 'Informações dispersas dificultam a atuação social.',
   'Apoiar a operação e a transparência de uma ONG.',
   array['Organizar campanhas e atividades','Cadastrar voluntários e disponibilidade','Registrar doações com transparência','Acompanhar beneficiários com privacidade','Apresentar indicadores de impacto'],
   array['Uma campanha mostra ações e doações registradas.','Dados pessoais são exibidos apenas a quem precisa.','O relatório explica a origem dos indicadores.'],
   'Misto', '5 a 7 semanas', 7,
   '[{"role":"Product","amount":1},{"role":"UX/UI","amount":1},{"role":"Backend","amount":1},{"role":"Frontend","amount":1}]',
   array['HTML + CSS + JavaScript','React ou Vue','Django','Laravel','Java + Spring','Flutter'],
   array['Cadastro de voluntários','Campanhas','Controle de doações','Relatório de impacto'], true, false),
  ('00000000-0000-4000-8000-000000000009', 'Sistema para Pequeno Comércio',
   'Cadastro de produtos, vendas, clientes, fiado, caixa e relatórios simples.',
   'Comércio', 'Pequenos negócios precisam registrar vendas e controlar o caixa.',
   'Oferecer gestão simples para o dia a dia da loja.',
   array['Cadastrar produtos e preços','Registrar vendas e pagamentos','Consultar clientes e compras','Acompanhar caixa diário','Gerar resumo simples para o lojista'],
   array['Uma venda atualiza o caixa e o histórico.','O resumo diário confere com as vendas registradas.','O fluxo de venda é utilizável em balcão e mobile.'],
   'Iniciante', '4 a 6 semanas', 6,
   '[{"role":"Backend","amount":1},{"role":"Frontend","amount":1},{"role":"UX/UI","amount":1},{"role":"QA","amount":1}]',
   array['HTML + CSS + JavaScript','React ou Vue','PHP','Node.js','Java + Spring','.NET'],
   array['Cadastro de produtos','Registro de vendas','Controle de clientes','Resumo diário'], true, false)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  problem = excluded.problem, objective = excluded.objective,
  suggested_features = excluded.suggested_features, acceptance_criteria = excluded.acceptance_criteria,
  difficulty = excluded.difficulty, suggested_duration = excluded.suggested_duration,
  recommended_max_members = excluded.recommended_max_members,
  suggested_composition = excluded.suggested_composition, possible_stacks = excluded.possible_stacks,
  outcomes = excluded.outcomes, official = true, archived = false;

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
    when '00000000-0000-4000-8000-000000000009' then array['Programa de fidelidade', 'Catálogo online', 'Previsão de demanda'] end
where official and id::text between '00000000-0000-4000-8000-000000000001' and '00000000-0000-4000-8000-000000000009';

with template_skills(template_id, technologies, areas) as (values
  ('00000000-0000-4000-8000-000000000001'::uuid, array['Java','Spring','React','PostgreSQL','Docker'], array['Backend','Frontend','QA','UX/UI','Product']),
  ('00000000-0000-4000-8000-000000000002'::uuid, array['Java','Spring','Python','FastAPI','React','Angular','PostgreSQL'], array['Backend','Frontend','UX/UI','QA']),
  ('00000000-0000-4000-8000-000000000003'::uuid, array['React Native','Flutter','Node.js','PostgreSQL','Docker'], array['Mobile','Backend','Frontend','UX/UI','QA','Product']),
  ('00000000-0000-4000-8000-000000000004'::uuid, array['C#','.NET','Angular','MySQL','Docker'], array['Backend','Frontend','QA','Product']),
  ('00000000-0000-4000-8000-000000000005'::uuid, array['React','Next.js','Node.js','MongoDB','PostgreSQL'], array['Frontend','Backend','Data Analysis','UX/UI']),
  ('00000000-0000-4000-8000-000000000006'::uuid, array['Python','Pandas','Power BI','React','PostgreSQL'], array['Backend','Data Analysis','Data Engineering','Frontend','UX/UI']),
  ('00000000-0000-4000-8000-000000000007'::uuid, array['Node.js','TypeScript','Java','Spring','PostgreSQL','Cybersecurity'], array['Backend','Cybersecurity','Frontend','QA']),
  ('00000000-0000-4000-8000-000000000008'::uuid, array['React','Python','Django','PostgreSQL','Cloud'], array['Product','UX/UI','Backend','Frontend','Cloud','QA']),
  ('00000000-0000-4000-8000-000000000009'::uuid, array['PHP','JavaScript','MySQL','React','Docker'], array['Backend','Frontend','UX/UI','QA','Product'])
), labels as (
  select 'technology'::text kind, unnest(technologies) name from template_skills
  union
  select 'area'::text kind, unnest(areas) name from template_skills
  union
  select 'technology', unnest(array['Vue','Kotlin','AWS','Playwright','Cypress','Godot','Unity'])
  union
  select 'area', unnest(array['Full Stack','DevOps','Cloud','Data Science','Machine Learning / IA','Project Management'])
)
insert into public.skills(kind, name)
select distinct kind, name from labels
on conflict do nothing;

with template_skills(template_id, technologies, areas) as (values
  ('00000000-0000-4000-8000-000000000001'::uuid, array['Java','Spring','React','PostgreSQL','Docker'], array['Backend','Frontend','QA','UX/UI','Product']),
  ('00000000-0000-4000-8000-000000000002'::uuid, array['Java','Spring','Python','FastAPI','React','Angular','PostgreSQL'], array['Backend','Frontend','UX/UI','QA']),
  ('00000000-0000-4000-8000-000000000003'::uuid, array['React Native','Flutter','Node.js','PostgreSQL','Docker'], array['Mobile','Backend','Frontend','UX/UI','QA','Product']),
  ('00000000-0000-4000-8000-000000000004'::uuid, array['C#','.NET','Angular','MySQL','Docker'], array['Backend','Frontend','QA','Product']),
  ('00000000-0000-4000-8000-000000000005'::uuid, array['React','Next.js','Node.js','MongoDB','PostgreSQL'], array['Frontend','Backend','Data Analysis','UX/UI']),
  ('00000000-0000-4000-8000-000000000006'::uuid, array['Python','Pandas','Power BI','React','PostgreSQL'], array['Data Analysis','Data Engineering','Frontend','UX/UI']),
  ('00000000-0000-4000-8000-000000000007'::uuid, array['Node.js','TypeScript','Java','Spring','PostgreSQL','Cybersecurity'], array['Backend','Cybersecurity','Frontend','QA']),
  ('00000000-0000-4000-8000-000000000008'::uuid, array['React','Python','Django','PostgreSQL','Cloud'], array['Product','UX/UI','Backend','Frontend','Cloud','QA']),
  ('00000000-0000-4000-8000-000000000009'::uuid, array['PHP','JavaScript','MySQL','React','Docker'], array['Backend','Frontend','UX/UI','QA','Product'])
)
insert into public.project_template_technologies(template_id, skill_id)
select t.template_id, s.id from template_skills t
cross join lateral unnest(t.technologies) tech(name)
join public.skills s on s.kind = 'technology' and lower(s.name) = lower(tech.name)
on conflict do nothing;

with template_skills(template_id, areas) as (values
  ('00000000-0000-4000-8000-000000000001'::uuid, array['Backend','Frontend','QA','UX/UI','Product']),
  ('00000000-0000-4000-8000-000000000002'::uuid, array['Backend','Frontend','UX/UI','QA']),
  ('00000000-0000-4000-8000-000000000003'::uuid, array['Mobile','Backend','Frontend','UX/UI','QA','Product']),
  ('00000000-0000-4000-8000-000000000004'::uuid, array['Backend','Frontend','QA','Product']),
  ('00000000-0000-4000-8000-000000000005'::uuid, array['Frontend','Backend','Data Analysis','UX/UI']),
  ('00000000-0000-4000-8000-000000000006'::uuid, array['Backend','Data Analysis','Data Engineering','Frontend','UX/UI']),
  ('00000000-0000-4000-8000-000000000007'::uuid, array['Backend','Cybersecurity','Frontend','QA']),
  ('00000000-0000-4000-8000-000000000008'::uuid, array['Product','UX/UI','Backend','Frontend','Cloud','QA']),
  ('00000000-0000-4000-8000-000000000009'::uuid, array['Backend','Frontend','UX/UI','QA','Product'])
)
insert into public.project_template_areas(template_id, skill_id)
select t.template_id, s.id from template_skills t
cross join lateral unnest(t.areas) area(name)
join public.skills s on s.kind = 'area' and lower(s.name) = lower(area.name)
on conflict do nothing;
