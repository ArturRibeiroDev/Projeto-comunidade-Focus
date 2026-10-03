# FocusAcademy

Produto da Focus Tecnologia para formação prática em squads e projetos. As decisões de produto estão em [docs/PRODUCT.md](docs/PRODUCT.md) e a arquitetura atual em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Supabase e autenticação

1. Crie um projeto Supabase. Aplique as migrations versionadas e execute **separadamente** `supabase/seed.sql`. `db push` não executa esse seed automaticamente; sem ele, o catálogo fica vazio. O seed é repetível e cria nove templates oficiais, sem usuários fictícios.
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL e chave **publicável** do projeto. Nunca use `service_role` no frontend.
3. Em Supabase Auth, habilite o provedor de e-mail. Para usar Discord, configure o provedor Discord no painel Supabase e sua URL de callback no portal Discord; então defina `VITE_DISCORD_AUTH_ENABLED=true`. Configure a Site URL e as URLs de redirecionamento da aplicação no Auth.
4. Execute `npm install` e `npm run dev`. O app exige sessão para exibir projetos.

Com a CLI vinculada ao projeto remoto, o processo é:

```bash
npx supabase db push --linked
npx supabase db query --linked --file supabase/seed.sql
npx supabase db query --linked "select count(*) from public.project_templates where official and not archived;"
```

A última consulta deve retornar `9`. Alternativamente, execute os arquivos de migration em ordem e depois o seed no SQL Editor.

```bash
npm run test
npm run build
```

## Configuração do Discord

1. No [Discord Developer Portal](https://discord.com/developers/applications), crie a Application **FocusAcademy**. Em OAuth2, copie Client ID/Secret para **Supabase Auth > Sign In / Providers > Discord**. Cadastre no Portal a callback exibida pelo Supabase, normalmente `https://<project-ref>.supabase.co/auth/v1/callback` (ou `http://localhost:54321/auth/v1/callback` se o Auth for local). O Client Secret nunca entra em `.env.local` ou no React.
2. No Supabase Auth, configure Site URL e allow list para a URL local efetiva (por exemplo `http://localhost:5173/**`) e, depois, a URL oficial de produção. Habilite **Allow manual linking** para o botão "Conectar Discord" de contas já autenticadas. O Supabase cuida do linking automático por e-mail verificado; não una identidades manualmente no banco. Defina `VITE_DISCORD_AUTH_ENABLED=true` apenas quando o provider estiver pronto.
3. Na mesma Application, crie o Bot User. Instale-o no servidor Focus com escopo `bot` e apenas: **Manage Channels** (criação/movimento), **Manage Roles** (editar overwrites), **View Channels**, **Send Messages** e **Read Message History**. Não conceda Administrator, Manage Server, Ban ou Kick. Confira também o acesso do bot às categorias.
4. Crie no servidor as categorias **SQUADS ATIVAS** e **SQUADS ARQUIVADAS**. Com Developer Mode, obtenha Guild ID e os dois Category IDs. No Supabase **Edge Function Secrets**, configure `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_ACTIVE_CATEGORY_ID`, `DISCORD_ARCHIVE_CATEGORY_ID`, `DISCORD_WORKER_SECRET` e `FOCUSEDU_APP_URL` (URL pública do app). A service role é utilizada somente pela função no ambiente Supabase. Não cole valores reais em Git, logs ou comandos versionados. Opcionalmente configure o convite público em `VITE_DISCORD_INVITE_URL`.
5. Para o worker automático, configure no Supabase Vault os nomes `focusedu_project_url`, `focusedu_publishable_key` e `focusedu_discord_worker_secret`; o último deve ter o mesmo valor de `DISCORD_WORKER_SECRET`. Aplique a nova migration com `npx supabase db push --linked` e faça deploy com `npx supabase functions deploy discord-events --no-verify-jwt`. A Edge Function valida o JWT de usuário no código para ações do frontend e exige `DISCORD_WORKER_SECRET` para o worker. OAuth do usuário, Bot Token e worker secret são credenciais diferentes.
6. Smoke real: entre com Discord e confirme a identidade no perfil; teste também conectar uma conta antiga de e-mail. Entre no servidor pelo convite, crie uma execução de template e adicione um segundo membro. Inicie: confira canal privado, membros e mensagem inicial. Faça resync duas vezes e confirme que existe um só canal. Conclua e arquive, verificando mensagem final, categoria de arquivo e somente leitura. Teste também cancelamento, membro sem Discord, falha do bot e retry.

Sem provider, bot e secrets configurados, os testes automatizados usam mocks e **não** criam canais reais. O lifecycle do FocusAcademy continua funcionando; eventos ficam pendentes ou falhos até o worker/retry processar ou até retry manual. O Cron remoto ainda precisa ser validado em staging/produção.

## Validação manual

- Cadastre duas contas reais, confirme e-mail se exigido e entre com cada uma. Verifique que cada perfil é independente e que o catálogo mostra nove templates sem squads fictícias.
- Crie um projeto de template, replique-o e crie um projeto próprio. Confirme que têm IDs, squads e histórico separados; o template permanece sem membros. Community Projects ficam pendentes para terceiros até aprovação.
- Entre em uma squad escolhendo uma função livre, saia e confira os dados após recarregar e em outra sessão. Para testar a última vaga, ajuste `max_members` do projeto para um limite pequeno como dono e tente duas entradas concorrentes; apenas uma pode ocupar a vaga.
- Confira em dois usuários que evidências são visíveis apenas ao titular e que tentativas diretas de editar outro perfil, inserir template ou forjar evidência são negadas pelo banco.
- Se Discord estiver habilitado, valide login e retorno OAuth na URL publicada. Sem instância Supabase e credenciais, esses fluxos não podem ser verificados apenas com testes locais.
- Em projeto de desenvolvimento vinculado, `npx supabase db query --linked --file supabase/tests/remote_smoke.sql` testa criação, perfil, participação e RLS em transação com `ROLLBACK`.

## Primeiro ADMIN

Depois de aplicar `202609270004_platform_admin.sql`, cadastre e verifique uma conta real. No SQL Editor do Supabase, sob acesso privilegiado, confirme o UUID dessa conta em `auth.users` e promova **somente esse UUID conhecido**:

```sql
update public.platform_accounts
set platform_role = 'ADMIN'
where user_id = 'SUBSTITUA_PELO_UUID_CONFIRMADO'::uuid;
```

Confirme que exatamente uma linha foi afetada. Nunca escolha automaticamente o primeiro usuário, não ponha e-mail/chave privilegiada no frontend e não execute a promoção a partir de uma sessão comum. A interface Admin gerencia MEMBER/MODERATOR; alterações de contas ADMIN continuam operação manual privilegiada.

## Estrutura

- `src/pages`, `src/components`: telas e interface Focus.
- `src/services`, `src/lib`: acesso ao Supabase e autenticação.
- `src/domain`, `src/types.ts`: modelos e projeções de catálogo.
- `supabase/migrations`, `supabase/seed.sql`: esquema, RLS, RPCs e templates oficiais.

A identidade visual Focus permanece em `public/brand`, `public/fonts` e `src/styles`. Discord é comunicação, GitHub é código; o FocusAcademy gerencia projetos, squads, aprendizagem e histórico.

Dados do protótipo em `localStorage` não são importados automaticamente para contas Supabase. Eles permanecem no navegador, mas não são usados pela aplicação multiusuário.
