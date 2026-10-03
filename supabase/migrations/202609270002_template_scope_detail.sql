update public.project_templates as t set
  suggested_features = scope.features,
  acceptance_criteria = scope.criteria
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid,
    array['Abrir chamado com categoria e prioridade', 'Acompanhar status e responsável', 'Registrar interações e solução', 'Buscar chamados e filtrar por equipe', 'Visualizar indicadores de atendimento'],
    array['Uma solicitação percorre abertura, atendimento e resolução.', 'Cliente e atendente conseguem consultar o histórico.', 'O painel reflete os chamados registrados.']),
  ('00000000-0000-4000-8000-000000000002'::uuid,
    array['Pesquisar o acervo por título e assunto', 'Ver disponibilidade de exemplares', 'Registrar empréstimo e devolução', 'Reservar item indisponível', 'Consultar histórico do leitor'],
    array['Um leitor encontra um livro e vê sua disponibilidade.', 'Empréstimo e devolução atualizam o estado do exemplar.', 'A reserva mantém a ordem de solicitação.']),
  ('00000000-0000-4000-8000-000000000003'::uuid,
    array['Explorar cardápio e montar pedido', 'Informar endereço e confirmar compra', 'Acompanhar etapas de preparo e entrega', 'Gerenciar pedidos no estabelecimento', 'Visualizar histórico de pedidos'],
    array['O cliente consegue finalizar um pedido completo.', 'O estabelecimento pode atualizar o estado sem perder o histórico.', 'O acompanhamento mostra o estado atual ao cliente.']),
  ('00000000-0000-4000-8000-000000000004'::uuid,
    array['Cadastrar produtos e fornecedores', 'Registrar entradas e saídas', 'Consultar saldos e movimentações', 'Destacar itens abaixo do mínimo', 'Exportar relatório simples'],
    array['Uma movimentação atualiza o saldo corretamente.', 'O histórico identifica data e motivo da alteração.', 'Itens abaixo do mínimo aparecem em uma visão clara.']),
  ('00000000-0000-4000-8000-000000000005'::uuid,
    array['Registrar receitas e despesas', 'Organizar por categoria e período', 'Definir metas financeiras', 'Ver resumo mensal acessível', 'Explorar evolução dos gastos'],
    array['O resumo mensal corresponde aos lançamentos.', 'A pessoa consegue distinguir receitas de despesas.', 'Metas mostram avanço sem exigir conexão bancária.']),
  ('00000000-0000-4000-8000-000000000006'::uuid,
    array['Selecionar fonte pública documentada', 'Limpar e organizar dados', 'Construir indicadores filtráveis', 'Visualizar séries e recortes', 'Exibir fonte e atualização dos dados'],
    array['Cada indicador informa fonte e período.', 'Os filtros alteram os resultados de forma coerente.', 'A visualização funciona em desktop e mobile.']),
  ('00000000-0000-4000-8000-000000000007'::uuid,
    array['Criar conta e entrar com segurança', 'Recuperar acesso', 'Controlar permissões por papel', 'Proteger telas e operações sensíveis', 'Registrar eventos essenciais de acesso'],
    array['Usuários acessam apenas recursos autorizados.', 'A recuperação de acesso não expõe dados sensíveis.', 'Fluxos de erro não revelam se uma conta existe.']),
  ('00000000-0000-4000-8000-000000000008'::uuid,
    array['Organizar campanhas e atividades', 'Cadastrar voluntários e disponibilidade', 'Registrar doações com transparência', 'Acompanhar beneficiários com privacidade', 'Apresentar indicadores de impacto'],
    array['Uma campanha mostra ações e doações registradas.', 'Dados pessoais são exibidos apenas a quem precisa.', 'O relatório explica a origem dos indicadores.']),
  ('00000000-0000-4000-8000-000000000009'::uuid,
    array['Cadastrar produtos e preços', 'Registrar vendas e pagamentos', 'Consultar clientes e compras', 'Acompanhar caixa diário', 'Gerar resumo simples para o lojista'],
    array['Uma venda atualiza o caixa e o histórico.', 'O resumo diário confere com as vendas registradas.', 'O fluxo de venda é utilizável em balcão e mobile.'])
) as scope(id, features, criteria)
where t.id = scope.id and t.official;
