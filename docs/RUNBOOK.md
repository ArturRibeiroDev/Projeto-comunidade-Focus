# Runbook FocusAcademy

Este runbook é operacional e não contém secrets. Use valores reais apenas nos dashboards dos providers ou em variáveis de ambiente locais ignoradas pelo Git.

Release freeze de 2026-10-02: os comandos de alteração/deploy abaixo são procedimentos para uma rodada operacional posterior autorizada. O RC atual não realizou deploy, db push nem alteração de secrets. A sequência e os gates de staging estão em `docs/PRODUCTION_READINESS.md`; produção continua fora do escopo.

## Deploy

1. Confirme `docs/PRODUCTION_READINESS.md` sem BLOCKER aberto.
2. Execute localmente:

```bash
npm run test
npm run lint
npm run format:check
npm run build
npm audit --audit-level=moderate
git diff --check
```

3. No Supabase staging, execute **Staging Limpo: Preflight** abaixo antes das migrations. O bootstrap instala `pg_cron` em `pg_catalog` e verifica `pg_net`/Vault. Compare history, aplique apenas migrations faltantes e execute seed/smokes SQL. Não editar migrations históricas nem aplicar diretamente em produção.
4. No Vercel, configure somente envs públicas `VITE_*` necessárias ao frontend.
5. No Supabase Edge Functions, configure secrets server-side:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `DISCORD_ACTIVE_CATEGORY_ID`
   - `DISCORD_ARCHIVE_CATEGORY_ID`
   - `DISCORD_WORKER_SECRET`
   - `FOCUSEDU_APP_URL`
   - `FOCUSEDU_ALLOWED_ORIGINS`
6. Faça deploy da Edge Function `discord-events` com `--no-verify-jwt`. O handler valida JWT de usuário com `admin.auth.getUser` para ações do frontend e exige `DISCORD_WORKER_SECRET` para o modo worker.
7. Faça deploy frontend pelo Vercel.
8. Execute `npm run smoke:production` com URL pública e chave publicável.

## Rollback

Frontend:

- Use rollback de deployment no Vercel para a última versão estável.
- Se o problema for configuração de env, ajuste env e redeploy.

Edge Function:

- Redeploy da versão anterior conhecida.
- Se necessário, desabilite ações Discord no frontend por configuração e mantenha lifecycle core funcionando.

Migrations:

- Não presumir downgrade automático.
- Para migrations destrutivas, criar migration forward de correção.
- Antes de mudanças críticas, confirmar backup/restore disponível no plano Supabase.

## Migrations

### Staging Limpo: Preflight

Procedimento MANUAL para o operador, não executado remotamente pelo agente. Não inclui deploy nem configuração/alteração de secrets. GO condicional apenas para criar e validar staging isolado; homologação e produção permanecem NO-GO.

1. Crie um projeto Supabase dedicado a staging pelo Dashboard, sem dados de produção. Aguarde o provisionamento. Registre project ref, hostname e versão PostgreSQL; confirme que NÃO correspondem a produção. Prepare `psql`, a CLI e um service `focusedu_staging` fora do repo (`~/.pg_service.conf`, SSL obrigatório; autenticação via prompt ou arquivo protegido). Nunca inserir senha/URL com senha na linha de comando. Confirme o hostname do service contra o Dashboard, não apenas o nome do service.
2. Valide o alvo antes de qualquer escrita e prepare/link a CLI somente a esse projeto. `FOCUSEDU_STAGING_PROJECT_REF` é o identificador público que VOCÊ deve exportar após conferir o Dashboard; não é secret. Não use `--force`, `db push`, `db reset --linked` ou `migration repair`.

```bash
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, inet_server_addr(), version();'
if [ ! -f supabase/config.toml ]; then npx supabase init; fi
: "${FOCUSEDU_STAGING_PROJECT_REF:?Defina e confira o project ref de staging}"
npx supabase login
npx supabase link --project-ref "$FOCUSEDU_STAGING_PROJECT_REF"
npx supabase migration list --linked
```

3. No projeto NOVO, antes de qualquer migration da aplicação, execute o bootstrap. Ele exige confirmação explícita, recusa tabelas `projects`/`profiles` e configuração Vault do worker já existente, valida extensão disponível/preload/cron.database_name e instala idempotentemente:

| Extensão | Schema de instalação | API usada |
| --- | --- | --- |
| `pg_cron` | `pg_catalog` | `cron.schedule`, `cron.alter_job`, `cron.job` |
| `pg_net` | `extensions` | `net.http_post` (API no schema `net`) |
| `supabase_vault` | `vault` | `vault.decrypted_secrets` (sem ler valores neste preflight) |

```bash
PGOPTIONS='-c focusedu.preflight.environment=staging' psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/preflight/staging_extensions.sql
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/preflight/check_extensions.sql
```

Se falhar por preload, extensão indisponível ou permissão, PARE. Habilite Cron em Integrations -> Cron e pg_net em Database -> Extensions SOMENTE no Dashboard staging, confirme Vault e execute novamente. Não ajustar parâmetros de produção nem remover/reinstalar extensões: DROP de pg_cron apaga jobs. O PostgreSQL gerenciado precisa ter o background worker/preload provido pelo Supabase; o bootstrap não altera configuração do servidor nem dá privilégios de browser.

4. Confira que o history remoto não tem migrations da aplicação e que as 17 locais estão em ordem. Se houver history/tabelas inesperadas, PARE e investigue em vez de reparar automaticamente. Só então aplique e IMEDIATAMENTE pause o job criado pela migration histórica:

```bash
npx supabase migration up --linked
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -c "select cron.alter_job(jobid, active := false) from cron.job where jobname = 'focusedu-discord-events-worker';"
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/preflight/check_extensions.sql
npx supabase migration list --linked
```

Se `migration up` falhar depois da migration worker, pause o job mesmo assim antes de investigar; não avance para seed/deploy. O check após as migrations exige exatamente um job **inativo**. A migration histórica cria o job ativo: há uma janela entre aplicação e pausa em que o Cron pode tentar rodar. Não adicionar os três valores Vault antes dessa pausa. Em projeto limpo, a URL ausente impede uma chamada válida; ainda pode haver erro registrado no Cron. Não existe pausa automática em produção nem migration nova que desative um worker existente.

5. Execute seed e os dez smokes do bloco abaixo. Guarde history, schemas/versões das extensões, job pausado e resultados, sem valores secretos. Este preflight TERMINA aqui: nenhuma Edge Function/frontend foi publicada, nenhum secret foi criado/alterado. Não reativar o job neste estágio.
6. Em rodada posterior autorizada, configure Auth/Discord/SMTP/Vault/Edge e faça o deploy exclusivamente staging. Só então valide endpoint sem worker secret negado, segredo coincidente no Vault/Edge, URLs do próprio staging, bot/guild/categorias e permissões; reative o job com `cron.alter_job(jobid, active := true)`, observe execuções/respostas HTTP e drenagem antes do GO de homologação. Nunca exibir `decrypted_secret`, headers HTTP ou command em logs/tickets. Não expor `cron`, `net` ou `vault` pela API do frontend.

Dependências: o job chama `/functions/v1/discord-events` com `apikey` e `x-focusedu-worker-secret`; não usa Bearer de chave publicável. A função requer `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` server-side, além dos secrets Discord listados neste runbook. Vault e Edge são armazenamentos separados: os três nomes Vault são `focusedu_project_url`, `focusedu_publishable_key` e `focusedu_discord_worker_secret`; este último deve coincidir com `DISCORD_WORKER_SECRET` da Edge. Nenhum precisa de valor para instalar o schema; todos precisam de validação antes de ativar o worker. Cron/pg_net workers reais, HTTP gateway, Vault decryption e permissões gerenciadas continuam PENDING REMOTE VALIDATION.

Justificativa: `202609280004_discord_event_worker.sql:146` pede `pg_cron with schema extensions`, incompatível com o control upstream que fixa `pg_catalog`. A imagem Supabase atual é tolerante (control sem schema fixo), portanto não generalizar o erro para todas as versões. O bootstrap pré-instala no schema recomendado pela [documentação oficial](https://supabase.com/docs/guides/cron/install); `IF NOT EXISTS` da migration mantém a instalação correta. Uma migration corretiva posterior nunca seria alcançada após esse erro; editar/backdate do histórico não é necessário nem seguro para bases já aplicadas.

Reprodução LOCAL, sem banco remoto, HTTP ou secrets:

```bash
docker pull supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00
node scripts/rc-db-check.mjs --extensions
node scripts/rc-db-check.mjs --extensions --upstream-cron-schema
```

O segundo teste acrescenta apenas `schema = pg_catalog` ao control por fixture no container descartável, preservando o binário real. Ambos executam as 16 migrations completas, bootstrap repetido e guards, PREPARE do comando HTTP sem executar, dez smokes e concorrência. Contêiner sem rede/portas e `cron.launch_active_jobs=off`; não é teste de chamada Edge nem de servidor Auth/Storage completo. `check_extensions.sql` é somente leitura, mas foi feito para a fase de preflight com job pausado: depois da ativação o check irá falhar intencionalmente.

Antes de aplicar:

```bash
npx supabase migration list --linked
```

Depois:

```bash
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/seed.sql
for smoke in security_catalog remote lifecycle ux admin discord discord_worker join_gamification release_candidate participation_roles; do
  psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f "supabase/tests/${smoke}_smoke.sql" || exit 1
done
```

Use apenas staging para validar mudanças arriscadas.

### Smoke de avatars pela Storage API

O RC SQL faz apenas checks read-only de catálogo em Storage. PASS SQL não significa PASS de upload/update/delete: no hosted, `storage.protect_delete` bloqueia DELETE SQL direto, e metadata não equivale ao arquivo real. Não desativar a proteção, definir `storage.allow_delete_query` nem alterar schemas gerenciados. Referências: [schema read-only](https://supabase.com/docs/guides/storage/schema/design) e [controle de acesso RLS](https://supabase.com/docs/guides/storage/security/access-control).

Execute manualmente, depois do RC SQL, com duas contas de teste existentes, distintas, com e-mail/senha confirmado em staging. Não precisam de Discord nem ADMIN. O script não cria/remove usuários e não modifica avatar_url do perfil. Não usa service_role nem para setup/cleanup; todas as operações usam sessões autenticadas das contas de teste.

Carregue estas variáveis no ambiente por um mecanismo local protegido, fora do repo e sem imprimir valores (não usar shell tracing):

- `FOCUSEDU_STORAGE_ENVIRONMENT=staging`
- `FOCUSEDU_STORAGE_STAGING_PROJECT_REF`: ref do staging, conferido no Dashboard, nunca o de produção.
- `FOCUSEDU_STORAGE_SUPABASE_URL`: `https://<staging-ref>.supabase.co`, sem barra final.
- `FOCUSEDU_STORAGE_CONFIRMED_STAGING_URL`: URL exata do staging conferida independentemente no Dashboard; deve ser igual à anterior.
- `FOCUSEDU_STORAGE_PUBLIC_KEY`: chave publicável do mesmo staging ou chave anon JWT legada; chaves secret/service_role são rejeitadas.
- `FOCUSEDU_STORAGE_OWNER_EMAIL` e `FOCUSEDU_STORAGE_OWNER_PASSWORD`.
- `FOCUSEDU_STORAGE_OTHER_EMAIL` e `FOCUSEDU_STORAGE_OTHER_PASSWORD`.

Esses guards exigem confirmação explícita do operador; o script não consegue descobrir sozinho qual projeto é produção. Variáveis genéricas de produção/Vite/E2E não são utilizadas.

```bash
psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/tests/release_candidate_smoke.sql
node scripts/storage-smoke.mjs
```

O script cria um PNG real em `avatars/<owner-uuid>/storage-smoke-<uuid>.png`, faz download para comparar bytes após upload/update, tenta update/delete com a outra conta e verifica pelo owner que o arquivo permaneceu. DELETE alheio só é aceito com erro de autorização ou lista vazia de objetos removidos, seguido da verificação de conteúdo e presença. DELETE próprio deve retornar o objeto removido, desaparecer da listagem e deixar de ser baixável pelo endpoint autenticado. URLs públicas/CDN podem manter cache; não são usadas para comprovar ausência.

No primeiro comportamento inesperado, interrompe as verificações e tenta apenas cleanup do path exclusivo dessa execução pela Storage API do owner. Cleanup sempre roda, inclusive após sucesso, e falha gera exit code 1. Logs omitem erros brutos/tokens/senhas. Se cleanup não puder ser confirmado, o log mostra somente o path de teste para remoção manual pela Storage API do owner; não usar SQL direto. Os usuários existentes permanecem. PASS remoto continua pendente até executar esse comando no staging real.

Validação local do runner, sem rede nem credenciais reais: `node --test scripts/storage-smoke.test.mjs`. Esses testes simulam respostas; não substituem o smoke remoto. A suíte PostgreSQL `npm run test:db:rc` continua local e não inclui servidor Storage.

O service PostgreSQL deve apontar exclusivamente para staging, com credencial privilegiada fora do repositório. Os dez smokes fazem ROLLBACK. `rc_concurrency_fixture.sql` só pode ser usado no container descartável de `npm run test:db:rc`, nunca no remoto. `supabase/config.toml` ainda não existe no repositório; preparar configuração/link da CLI antes de executar operações futuras de migration/deploy.

## Incidentes Auth

1. Verifique Supabase Auth logs.
2. Confira Site URL e Redirect URLs.
3. Verifique SMTP provider, SPF/DKIM/DMARC e rejeições.
4. Teste signup/reset com conta controlada.
5. Não exponha tokens de sessão em tickets/logs.

## Discord Identity Linking

Para usuários que entram com e-mail/senha, o botão de perfil deve usar Supabase Identity Linking, não login OAuth independente.

Checklist remoto:

1. No Dashboard Supabase Auth, confirme Discord provider ativo e callback configurado.
2. Confirme Manual Linking/Identity Linking habilitado quando a configuração do projeto exigir.
3. Adicione Site URL e Redirect URLs exatas de produção/staging.
4. Teste conta e-mail/senha existente: Perfil -> Conectar Discord -> OAuth -> retorno mantendo o mesmo `auth.users.id`.
5. Verifique `auth.identities` e `public.user_integrations` para o mesmo usuário.
6. Teste Discord já vinculado à mesma conta, Discord vinculado a outra conta, cancelamento do OAuth e provider desabilitado.
7. Nunca vincule manualmente por e-mail, username ou tag Discord; use apenas `linkIdentity`.

## Discord FAILED Events

1. Abra Admin e confira overview Discord.
2. Consulte `integration_events` por `FAILED`/`PENDING`.
3. Leia `last_error` sanitizado.
4. Verifique Edge Function logs.
5. Confirme bot no guild, permissões mínimas e categorias.
6. Use retry/resync pela UI quando o erro for recuperável.
7. Para rate limit, respeite `retry_after`.

## Discord Event Worker

O worker usa `pg_cron` + `pg_net` para chamar a Edge Function `discord-events` com `action = worker`. A migration agenda o job e referencia apenas nomes no Supabase Vault; configure os valores reais no ambiente remoto antes de depender do job.
O valor `focusedu_publishable_key` é enviado como `apikey`; não use chave publicável como `Authorization: Bearer`.

Habilitar configuração segura no Supabase remoto:

```sql
select vault.create_secret('https://PROJECT.supabase.co', 'focusedu_project_url');
select vault.create_secret('PUBLIC_PUBLISHABLE_KEY', 'focusedu_publishable_key');
select vault.create_secret('RANDOM_WORKER_SECRET', 'focusedu_discord_worker_secret');
```

Configure o mesmo `RANDOM_WORKER_SECRET` como secret da Edge Function:

```bash
npx supabase secrets set DISCORD_WORKER_SECRET=RANDOM_WORKER_SECRET
```

Verificar Cron:

```sql
select jobid, schedule, active
from cron.job
where jobname = 'focusedu-discord-events-worker';

select *
from cron.job_run_details
where jobid = (
  select jobid from cron.job where jobname = 'focusedu-discord-events-worker'
)
order by start_time desc
limit 20;
```

Verificar efeito do worker:

```sql
select status, failure_kind, count(*)
from public.integration_events
where provider = 'discord'
group by status, failure_kind
order by status, failure_kind;

select id, project_id, event_type, status, attempts, last_error,
  last_attempted_at, retry_after
from public.integration_events
where provider = 'discord'
order by created_at desc
limit 20;
```

Desabilitar rapidamente:

```sql
select cron.unschedule('focusedu-discord-events-worker');
```

Reprocessar falhas:

- Use a UI de retry/resync quando owner/ADMIN puder validar o projeto.
- `FAILED` com `failure_kind = 'RETRYABLE'` volta automaticamente quando `retry_after` vencer e `attempts < 5`.
- `FAILED` com `failure_kind = 'FINAL'` exige correção operacional e retry manual explícito.
- A Edge reivindica um evento por vez antes de processar, até dez por chamada; lease abandonado é retomado após 15 minutos. Monitorar tempo de execução abaixo desse lease e PROCESSING repetidamente abandonado; falhas normais FAILED têm teto de cinco tentativas automáticas.

## Gamificação Não Crítica

1. Se houver `GAMIFICATION_AWARD_FAILED` nos logs PostgreSQL, confirme que o projeto foi concluído e as evidências existem. O aviso contém UUID/SQLSTATE, sem detalhes SQL ou secrets.
2. Corrija a causa operacional e confirme o UUID do projeto em staging. Não escrever pontos pelo browser e não criar uma nova RPC de reparo.
3. Com conexão privilegiada, reexecute a concessão idempotente apenas para o projeto confirmado:

```sql
select private.award_project_completion(p.id, p.completed_at)
from public.projects p
where p.id = 'UUID_CONFIRMADO'::uuid and p.completed_at is not null;
```

4. Verifique ledger/unlocks sem duplicação. Falha de carregamento de gamificação omite a seção; catálogo, perfil e lifecycle devem continuar disponíveis.

## SMTP

1. Credentials ficam no Supabase/provider, nunca no frontend.
2. Teste:
   - confirmação de cadastro;
   - password reset;
   - alteração de email, se habilitada.
3. Se links quebrarem, desabilite tracking de links no provider.
4. Não configurar POP3/IMAP enquanto o produto não receber email.

## Logs

- Vercel: deploy/build/runtime.
- Supabase: Auth, Postgres, Edge Functions.
- Banco: `admin_audit_log`, `integration_events`.
- Não registrar secrets, JWT, sessions, OAuth access tokens ou Bot Token.

## Backup/Restore

1. Verifique retention e PITR disponíveis no plano.
2. Defina RPO/RTO.
3. Antes de migration crítica, confirme backup recente.
4. Teste restore em ambiente isolado antes de depender do processo.

## Secrets Rotation

Rotacionar imediatamente se houver suspeita de exposição:

- Supabase service role key.
- Discord Bot Token.
- Discord Client Secret no provider Supabase/Discord.
- SMTP password/API key.
- Database password.

Após rotação, redeploy/reinicie serviços dependentes e confirme que o valor antigo não funciona.

## Admin Recovery

- Bootstrap de ADMIN é manual no SQL Editor com UUID confirmado.
- Nunca promover automaticamente o primeiro usuário.
- UI não deve rebaixar ou suspender ADMIN.
- Em perda de acesso ADMIN, usar acesso privilegiado Supabase para corrigir um UUID conhecido.

## Domain/DNS Troubleshooting

1. Verifique domínio no Vercel dashboard.
2. Use os registros exatos informados pelo provider.
3. Validar:

```bash
dig A DOMINIO
dig CNAME www.DOMINIO
dig TXT DOMINIO
dig MX DOMINIO
dig CAA DOMINIO
curl -I https://DOMINIO
```

4. Confirme redirect canônico e HTTPS.
5. Não alterar DNSSEC sem validar cadeia completa.
