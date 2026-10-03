# FocusAcademy Release Candidate: Staging Gate

Atualizado em: 2026-10-03. Release freeze: apenas auditoria, correcoes de release e testes.

**GO CONDICIONAL para iniciar/criar staging isolado pelo preflight documentado.** O bootstrap de extensoes e o replay integral foram validados localmente. Aplicacao sem bootstrap continua NO-GO em runtimes que exigem pg_catalog. Homologacao, promocao e producao continuam NO-GO ate evidencias remotas. Nenhum deploy, db push remoto ou alteracao de secrets foi realizado nesta rodada.

## Significado dos Status

- **PASS**: evidencia executada localmente ou inspecao identificada explicitamente.
- **FAIL**: problema conhecido que impede o procedimento indicado.
- **PENDING REMOTE VALIDATION**: exige staging real; nao equivale a PASS.
- **MANUAL CONFIGURATION**: depende de configuracao operacional externa.

O worktree ja continha alteracoes extensas e arquivos nao rastreados. Este gate nao atribui essas alteracoes ao RC e nao cria commit/tag automaticamente. Antes de release, revisar o snapshot completo e registrar commit, lockfile, migrations e hash dos artefatos.

## Gates do RC

| Area                                   | Status                    | Evidencia / limite                                                                                                                                               |
| -------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testes unitarios/componentes           | PASS                      | 15 arquivos, 60 testes. Inclui recovery e app utilizavel quando gamificacao falha.                                                                               |
| Lint, formato, TypeScript, build, diff | PASS                      | Comandos obrigatorios executados; E2E tambem possui typecheck separado.                                                                                          |
| Dependencias npm                       | PASS                      | Audit com nivel moderate: zero vulnerabilidades.                                                                                                                 |
| Schema e permissoes locais             | PASS                      | 16 migrations em ordem; 21 tabelas public com RLS. Runner em PostgreSQL 16 Docker isolado, sem rede/portas externas.                                             |
| Cron/Vault com preflight               | PASS                      | Bootstrap + 16 migrations integrais em PostgreSQL Supabase 17, pg_cron 1.6.4, pg_net 0.20.3, Vault 0.3.1; schema upstream testado com fixture explicita.          |
| Replay sem preflight (schema fixo)     | FAIL                      | Migration historica pede extensions; variante upstream exige pg_catalog. Imagem Supabase atual aceita ambos: nao presumir comportamento do alvo remoto.        |
| Smokes SQL                             | PASS                      | Dez arquivos, incluindo catalogo de grants, lifecycle, Admin, Discord, participacao, Storage e falha injetada de gamificacao.                                    |
| Concorrencia de capacidade             | PASS                      | Duas conexoes aprovam a ultima vaga: uma aprovacao, um PROJECT_FULL e squad final com 2 membros.                                                                 |
| Auth browser local                     | PASS                      | Tres cenarios Chromium: erro de login sanitizado/recover, erro OAuth, callback PASSWORD_RECOVERY e updateUser. HTTP Auth simulado; nao comprova provider remoto. |
| E2E multiusuario staging               | PENDING REMOTE VALIDATION | Suite executavel preparada; sem URL/contas de staging fornecidas. Nao foi executada remotamente.                                                                 |
| Discord real/Cron/Vault                | PENDING REMOTE VALIDATION | Bot, guild, sobrescritas, retry e drenagem precisam de evidencia real.                                                                                           |
| Avatar via Storage API                 | PENDING REMOTE VALIDATION | SQL cobre insert/update/delete proprio e ataques cruzados; bucket real/tipos/tamanho/public download exigem API real.                                            |
| Secrets no dist                        | PASS                      | Scanner recursivo verifica nomes proibidos, JWT privilegiado, padroes de credenciais e valores privados conhecidos do env, sem imprimir valores.                 |
| Vercel/CSP/cache                       | PASS                      | Inspecao de vercel.json. Headers efetivos e OAuth remoto ainda pendentes.                                                                                        |
| Headers reais                          | PENDING REMOTE VALIDATION | Smoke HTTP verifica headers/noindex/cache e rewrite quando rodado em staging. Vite preview nao aplica vercel.json.                                               |
| Branding                               | PASS                      | UI/metadados/mensagens e novos topicos Discord FocusAcademy. Marcador legado reconhecido para recuperar canais existentes. FOCUSEDU_* preservado.                |
| Bundle                                 | PASS                      | index ~354 kB (gzip ~108), Supabase ~223 kB (gzip ~58), Admin ~16 kB (gzip ~5). Sem warning >500 kB.                                                             |
| Load/Lighthouse/ZAP/advisors           | PENDING REMOTE VALIDATION | Scripts revisados, sem carga remota executada.                                                                                                                   |
| SMTP, OAuth, backup                    | MANUAL CONFIGURATION      | Configuracao de staging e contas controladas precisam ser verificadas.                                                                                           |

## BLOCKERS

1. **pg_cron: mitigacao local validada, gate remoto obrigatorio.** A migration imutavel 202609280004_discord_event_worker.sql:146 usa `create extension ... pg_cron with schema extensions`. O control upstream exige pg_catalog; a imagem Supabase 17.6.1.136 remove essa restricao do control, portanto o erro depende do runtime. Executar `supabase/preflight/staging_extensions.sql` ANTES das migrations resolve ambas as variantes: com pg_cron instalado em pg_catalog, IF NOT EXISTS nao reinstala. Nao editar/reaplicar o historico nem adicionar migration posterior que seria inalcancavel apos a falha. Fontes: [instalacao oficial Supabase](https://supabase.com/docs/guides/cron/install) e [control upstream v1.6.4](https://github.com/citusdata/pg_cron/blob/v1.6.4/pg_cron.control).
2. **Alvo isolado e configuracao nao confirmados.** Faltam referencias de Supabase/Vercel staging, redirects exatos, provider Discord/Manual Linking, SMTP de teste, Vault e Edge secrets existentes nesse ambiente.
3. **Homologacao remota pendente.** Nao ha evidencia de migration history/schema real, smokes SQL remotos, E2E multiusuario, worker real, Storage API e headers/CSP. Bloqueia aceitar/promover o RC; deve ser resolvida no staging de validacao.

## HIGH

Corrigidos localmente, pendentes de confirmacao remota:

- Cancelamento ADMIN com motivo NULL/vazio escapava por SQL three-valued logic. Agora coalesce exige 1..500 caracteres e auditoria server-side.
- Gamificacao fazia parte da falha critica de carregamento e conclusao. Leitura agora e opcional/validada; escrita usa subtransacao best-effort com aviso sanitizado.
- Recovery enviava link mas nao permitia atualizar senha. PASSWORD_RECOVERY apresenta formulario autenticado e chama updateUser. Cadastro/reset exigem 8 caracteres no cliente; politica efetiva continua no Supabase.
- Faltava SELECT proprio em Storage para update/delete funcionarem. Policy adicionada e testes positivos/negativos executados.
- Worker reivindicava lote antes de processar; eventos esperando podiam perder o lease. Agora reivindica um por vez, mantendo lote maximo de 10; leases de 15 minutos.
- Approval travava request antes de project, inverso ao lifecycle. Agora trava usuario, project e request, e revalida o request sob lock.
- MODERATOR podia acionar processamento global Discord no handler. Agora processamento operacional exige owner ativo ou ADMIN ativo.
- Mensagens de erros de Auth/Admin/carregamento foram sanitizadas. Nao exibir mensagens SQL ou respostas cruas.

Nao ha HIGH local conhecido sem tratamento nesta rodada. Validar concorrencia approval/start/cancel e tempo maximo real do worker em staging antes de aceitar o RC.

## Migrations e Dependencias Frontend/Schema

| Ordem | Migration                                       | Dependencia / consumidor                                                                            |
| ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1     | 202609260001_initial                            | Auth/storage schemas Supabase; profiles, skills, templates, projects, members, evidences e RLS.     |
| 2     | 202609260002_operations                         | Base anterior; perfil, criacao/template/replica por RPC.                                            |
| 3     | 202609260003_project_lifecycle                  | Status FORMING/ACTIVE/COMPLETED/CANCELLED/ARCHIVED, evidencias e RPC lifecycle.                     |
| 4     | 202609270001_ux_refinement                      | RPCs *_planned e update_project_with_plan, datas, audience/evolution e bucket avatars.              |
| 5     | 202609270002_template_scope_detail              | Atualiza templates existentes; seed traz funcionalidades/criterios para staging novo.               |
| 6     | 202609270003_fix_replication                    | Corrige referencia ambigua na replicacao.                                                           |
| 7     | 202609270004_platform_admin                     | Accounts/settings/audit/moderation, limites e helpers de papel. UI Admin depende destas RPCs.       |
| 8     | 202609280001_profile_bio_limit                  | Check bio 600 sem truncar legado; pode permanecer NOT VALID em bases com bio maior.                 |
| 9     | 202609280002_discord_integration                | auth.identities, identity trigger, outbox, integrations, resync/retry/claim.                        |
| 10    | 202609280003_discord_identity_sync_fix          | Discord sub confiavel tem prioridade; backfill.                                                     |
| 11    | 202609280004_discord_event_worker               | pg_cron previamente habilitado, pg_net e Vault; claim em lote/backoff/metadados/cron.               |
| 12    | 202610010001_join_requests_discord_gamification | Discord/admin previos; requests, readiness, pontos/conquistas e revogacao de entrada direta.        |
| 13    | 202610010002_admin_cancel_project               | Join/outbox/audit previos; cancelamento global ADMIN.                                               |
| 14    | 202610020001_release_candidate_hardening        | **Nova RC**: motivo obrigatorio, gamificacao opcional, ACLs explicitas e SELECT proprio de avatars. |
| 15    | 202610020002_release_candidate_locking          | **Nova RC**: ordem de locks no approval e leases de 15 minutos.                                     |
| 16    | 202610030001_project_participation_roles        | **Nova RC**: owner escolhe area canonica; join e approval validam o catalogo atual do projeto.       |
| 17    | 202610030002_dashboard_public_data_backend_area | **Nova RC**: adiciona Backend somente ao template oficial Dashboard de Dados Publicos.               |

### Funcoes De Participacao E Dados Legados

`skills(kind = 'area')`, associados ao projeto por `project_areas`, sao a fonte canonica. As novas RPCs de criacao exigem `p_owner_role`; pedidos de entrada e aprovacao verificam a mesma relacao. Assinaturas antigas de criacao que inferiam a funcao de `profiles.main_role` deixam de ser executaveis por `authenticated`.

A migration nao atualiza nem apaga `project_members.main_role` ou `project_join_requests.main_role`. Leituras de registros existentes continuam preservando o texto legado. Uma solicitacao pendente cuja funcao nao esteja mais entre as areas do projeto nao podera ser aprovada; a pessoa deve cancelar e solicitar novamente com uma funcao permitida.

Consulta somente leitura para executar apos a migration no staging e revisar registros antigos (nao imprime dados pessoais):

```sql
with legacy as (
  select 'project_member' as source, pm.project_id, pm.user_id, pm.main_role,
         (p.owner_id = pm.user_id) as is_owner
  from public.project_members pm
  join public.projects p on p.id = pm.project_id
  where pm.main_role is null or lower(trim(pm.main_role)) = 'outra'
     or not exists (
       select 1 from public.project_areas pa
       join public.skills s on s.id = pa.skill_id and s.kind = 'area'
       where pa.project_id = pm.project_id and lower(s.name) = lower(trim(pm.main_role))
     )
  union all
  select 'pending_join_request', jr.project_id, jr.user_id, jr.main_role, false
  from public.project_join_requests jr
  where jr.status = 'PENDING'
    and (jr.main_role is null or lower(trim(jr.main_role)) = 'outra'
      or not exists (
        select 1 from public.project_areas pa
        join public.skills s on s.id = pa.skill_id and s.kind = 'area'
        where pa.project_id = jr.project_id and lower(s.name) = lower(trim(jr.main_role))
      ))
)
select source, is_owner, coalesce(main_role, '<NULL>') as legacy_role, count(*)
from legacy
group by source, is_owner, coalesce(main_role, '<NULL>')
order by source, is_owner desc, legacy_role;
```

Resultado vazio significa que nao ha membros/pedidos pendentes fora do catalogo atual. A consulta nao autoriza reescrita automatica; qualquer reparo deve ser uma decisao operacional explicita.

Aplicar schema antes do frontend RC. Nao executar smokes antigos de entrada direta contra schema novo. Smokes remote/admin foram atualizados para request + approval e gamification smoke passou a consultar pontos com identidade do titular.

O runner padrao PostgreSQL 16 continua excluindo CREATE EXTENSION e cron.schedule. O modo `node scripts/rc-db-check.mjs --extensions` usa imagem Supabase fixada por digest e executa as 16 migrations SEM exclusoes. `--extensions --upstream-cron-schema` usa o mesmo binario real e uma fixture local de control com schema fixo pg_catalog para reproduzir a incompatibilidade upstream. Ambos validam bootstrap repetido, recusa sem confirmacao/apos tabelas existentes, job unico/pausado, PREPARE do comando HTTP sem executa-lo, dez smokes e concorrencia. Nenhum secret e criado; container sem rede/portas e cron.launch_active_jobs=off. Auth/Storage ainda usam bootstrap minimo, nao servicos completos Supabase.

O preflight nao e migration de dominio e nao deve entrar no migration history. Ele e uma precondicao operacional explicita, restrita a staging limpo, transacional, sem DROP/relocation/alteracao de secrets. Uma migration corretiva posterior nao poderia corrigir o erro antes do seu proprio replay; backdating ou migration repair criariam divergencia de historico. Bases existentes nao devem executar esse bootstrap: usar apenas o check read-only e revisar o historico sem reinstalar extensoes.

Seed e explicito e idempotente, sem usuarios de demonstracao. Como audience/evolution de UX dependem de templates ja existentes, em staging novo conferir esses dados apos seed; esse enriquecimento nao e requisito de seguranca nem altera squads.

## RLS / GRANTs: Todas as Tabelas Public

| Tabelas                                               | SELECT authenticated                            | Escrita browser / isolamento                                                                        |
| ----------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| profiles                                              | Comunidade autenticada                          | UPDATE apenas 9 colunas editaveis do proprio id; papel nao vive aqui. RPC perfil deriva auth.uid(). |
| skills, profile_skills                                | Comunidade autenticada                          | Escrita por helpers dentro de RPC; sem INSERT/UPDATE/DELETE browser.                                |
| project_templates                                     | Nao arquivados                                  | Mutacoes por ADMIN RPC; skills associadas respeitam visibilidade do template.                       |
| project_template_technologies, project_template_areas | Template visivel                                | Sem escrita browser.                                                                                |
| projects                                              | Aprovados, owner ou staff ativo                 | Sem INSERT/UPDATE/DELETE diretos. Creation/lifecycle/moderation por RPC.                            |
| project_technologies, project_areas, project_members  | Projeto visivel                                 | Members sem INSERT/DELETE/UPDATE direto; approval e leave server-side.                              |
| project_join_requests                                 | Self, owner ou staff autorizado                 | Sem escrita direta; pending unico; decisao apenas owner.                                            |
| platform_accounts                                     | Self                                            | Role/status nao editaveis pelo browser.                                                             |
| platform_settings, admin_audit_log                    | Sem grant de SELECT                             | Apenas RPC com autorizacao ADMIN. Audit insert server-side.                                         |
| user_integrations                                     | Self                                            | Identidade derivada de auth.identities; sem mutacao browser.                                        |
| project_integrations                                  | Owner, ADMIN ou participante de projeto visivel | Service role escreve no servidor.                                                                   |
| integration_events                                    | Owner ou ADMIN de projeto visivel               | Service role/trigger escreve; browser nao reivindica eventos.                                       |
| gamification_events                                   | Self                                            | Nenhuma escrita browser, inclusive UPDATE em pontos.                                                |
| gamification_achievements                             | Catalogo autenticado                            | Sem escrita browser.                                                                                |
| user_achievements                                     | Perfis visiveis autenticados                    | Unlocks apenas servidor.                                                                            |
| evidences                                             | Self                                            | Sem escrita browser.                                                                                |

21/21 com RLS. ANON/PUBLIC sem grants das tabelas de dominio. Catalogo SQL verifica privilegios herdados, de tabela E de coluna, incluindo TRUNCATE/REFERENCES/TRIGGER. Sem views criadas nas migrations. Schema remoto pode ter objetos adicionais: catalog smoke deve detecta-los e exigir revisao.

Profiles e conquistas visiveis a autenticados sao dados da comunidade, nao dados privados. Settings/audit sem policy browser e sem grant; RLS deny-by-default.

## RPC / SECURITY DEFINER

- Todas as definers locais tem search_path vazio; referencias de dominio sao public/private/auth qualificadas. Funcoes pg_catalog sao resolvidas pelo PostgreSQL, sem depender de public.
- RPCs de usuario derivam identidade de auth.uid(); mutacoes de comunidade usam require_active diretamente ou pelos triggers das RPCs de criacao. RPC perfil valida auth.uid(); perfil proprio continua editavel mesmo em suspensao, conforme grants existentes.
- ADMIN usa is_admin() consultando role e account_status do banco; MODERATOR usa somente rotas staff autorizadas. Nunca confiar em claims de role customizados no cliente.
- RPCs planned delegam a funcoes autenticadas e ao helper de plano; trigger de criacao aplica ownership/limites.
- Helpers de trigger operam em new/old ou no contexto de RPC autorizado; nao sao RPCs livres. Apenas is_staff/is_admin possuem EXECUTE authenticated para policies.
- EXECUTE publico/anon revogado. authenticated possui somente allowlist de RPCs de produto; claim_event/claim_events exclusivos service_role com verificacao auth.role().
- Browser nao possui INSERT em project_members; approval revalida Discord, conta ativa, limite simultaneo, status/moderacao e max_members sob lock.
- Inicio revalida Discord de TODOS os membros no banco. Falhas externas do bot nao bloqueiam lifecycle; conexao confiavel e requisito para iniciar.
- Conclusao/evidencias e outbox sao transacionais; gamificacao e best-effort. Audit de cancelamento administrativo inclui ator, projeto, motivo, status anterior e timestamp.
- Nao foi encontrado SQL dinamico em migrations de dominio.

## Auth

PASS local: signInWithPassword, signInWithOAuth para login Discord e linkIdentity para conta autenticada permanecem distintos. Callback e sessao sao restaurados pelo SDK; linking compara UUID de origem, atualiza identities e rele integracao. Nao existe uniao manual por email.

PASS local: PASSWORD_RECOVERY abre formulario autenticado de senha; erros OAuth sao sanitizados/removidos da URL. Nao registrar access/refresh/provider tokens. Referencia: [reset/updateUser Supabase](https://supabase.com/docs/guides/auth/passwords).

MANUAL CONFIGURATION: Site URL/Redirect URLs exatas de staging, provider/callback Discord, Manual Linking, confirmacao de email, SMTP sandbox, senha minima >=8, rate limits e protecao de senhas vazadas se disponivel.

PENDING REMOTE VALIDATION: signup/confirmacao, login real, refresh/logout, recovery com email real e link expirado, Discord login, linking mantendo mesmo UUID, cancelamento/provider desabilitado/conta ja vinculada, unlink com outra identidade.

## Discord

PASS por inspecao/testes: bot token/service key exclusivamente Edge; JWT de usuario revalidado no handler, worker secret obrigatorio, origens CORS em allowlist, @everyone sem ViewChannel e overwrite individual type=1. allowed_mentions vazio; logs agregados/sanitizados.

PASS SQL: claim service-only, SKIP LOCKED, processing token/lease, backoff, FAILED retryable/final, max tentativas de falha automatica e retry manual owner/ADMIN. Claim sequencial na Edge impede lote esperando com lease ativo. Lease abandonado pode ser retomado apos 15 minutos.

PENDING REMOTE VALIDATION: bot sem Administrator, permissoes minimas de canal/mensagens/overwrites, outsider sem acesso (inclusive roles existentes do guild), canais legados recuperados sem duplicar, mensagem/conclusao/cancelamento/archive, resync, 429 e retry_after, execucoes Cron/Vault e drenagem.

Riscos residuais: nonce Discord deduplica por tempo limitado, podendo repetir mensagem apos falha tardia; workers interrompidos repetidamente podem retomar PROCESSING sem o mesmo teto aplicado a FAILED. Validar/monitorar execucao <15 minutos, cron concorrente, backlog e FINAL; nao tratar esses casos como entrega exactly-once.

## Storage / Gamification / Secrets

Storage: bucket avatars publico, 2 MB, JPEG/PNG/WebP. Policies INSERT/SELECT/UPDATE/DELETE restringem bucket e primeiro segmento igual a auth.uid(). O RC SQL verifica apenas RLS, grants, bucket e presenca das policies; nao comprova autorizacao efetiva de arquivos. Metadata Storage e read-only para operacoes de arquivo; DELETE SQL e bloqueado no hosted por storage.protect_delete. Upload/update/delete positivos e cruzados devem ser executados manualmente com `node scripts/storage-smoke.mjs`, duas sessoes de usuarios reais e cleanup pela Storage API, conforme Runbook. PENDING REMOTE VALIDATION: esse smoke, MIME, oversized e URLs em staging. Fontes: [controle de acesso Storage](https://supabase.com/docs/guides/storage/security/access-control) e [schema Storage](https://supabase.com/docs/guides/storage/schema/design).

Gamificacao: leitura rejeitada retorna null, sem bloquear App. Payload invalido e rejeitado antes de renderizar. Falha de ledger reverte apenas premios, preservando conclusao/evidencias, e emite GAMIFICATION_AWARD_FAILED com project UUID/SQLSTATE, sem SQLERRM. Replay idempotente e privilegiado consta no Runbook; nao ha novo endpoint browser.

Secrets: scan de todos os arquivos dist PASS para service_role, DB password/connection credentials, Bot Token, Client Secret, DISCORD_WORKER_SECRET, SMTP password, private keys e valores privados conhecidos do env. Apenas quatro VITE_* publicos sao consumidos. Repetir scan NO build de staging com as envs reais de staging; auditoria local nao cobre valores privados desconhecidos, historico Git ou artefatos remotos. Nenhum valor foi impresso/alterado.

## Vercel / Performance

vercel.json: SPA rewrite para index.html preserva assets/brand/fonts/robots, CSP com HTTPS/WSS Supabase e imagens locais/Supabase/Dicebear/CDN Discord, HSTS, nosniff, Referrer-Policy, Permissions-Policy e frame-ancestors none. O CDN Discord foi incluido para avatars restaurados pelo OAuth; validar no browser staging.

Noindex/nofollow explicito para todas as rotas, adequado ao app autenticado e staging/preview. HTML no-cache; assets hash immutable um ano; brand um dia; robots uma hora. Fontes atuais nao possuem hash no nome, mas nao mudaram neste RC. Validar headers efetivos por caminho; custom domain Supabase requer atualizar CSP antes de aceita-lo.

Code splitting pequeno: Admin com React.lazy/Suspense e SDK Supabase em vendor chunk. O vendor continua necessario no primeiro carregamento; o total baixado nao caiu proporcionalmente ao index. Sem sourcemaps publicos. Lighthouse/rede lenta e CSP real pendentes.

## E2E / Carga / Security Testing

`npm run test:e2e -- --project=local`: tres testes PASS; screenshots desktop 1440x900 e mobile 390x844 inspecionadas, sem overflow horizontal. Dados Auth ficticios e host rc-test.invalid; nenhum request a provider real.

`npm run test:e2e -- --project=staging`: suite preparada para login, salvar perfil sem alterar nome, criar squad oficial, solicitar entrada, aprovar como owner, readiness, negar ADMIN RPC/cancel para MEMBER e cancelar como ADMIN com audit. Cleanup cancela somente projeto criado pelo teste; nao faz hard-delete. Teste cria historico e conta no limite diario, portanto usar contas dedicadas com capacidade disponivel.

Env necessaria: FOCUSEDU_E2E_ENVIRONMENT=staging, FOCUSEDU_E2E_BASE_URL e FOCUSEDU_E2E_CONFIRMED_STAGING_URL iguais, FOCUSEDU_E2E_SUPABASE_URL, FOCUSEDU_E2E_PUBLIC_KEY, FOCUSEDU_E2E_{OWNER,MEMBER,ADMIN}_{EMAIL,PASSWORD}. Owner/member precisam Discord real previamente conectado; tres usuarios distintos, MEMBER nao staff e ADMIN bootstrap manual. Sem service key, sem traces/videos/screenshots autenticados por padrao. Nao versionar credenciais.

OAuth interativo e cenarios sem Discord/conta suspensa exigem checklist manual complementar; SQL cobre falta de Discord, permissao/capacidade e suspensao. Suite staging foi descoberta/typechecked, nao executada.

Load: tests/load/focusedu-load.js exige staging + URL confirmada + Supabase public key/token de teste; sem writes. Credencial publicavel enviada como apikey, JWT so em leitura autenticada. 401/403 esperado nao conta como falha HTTP; checks tambem sao threshold. Sintaxe verificada; k6 remoto nao executado. Fonte: [k6 expected response](https://grafana.com/docs/k6/latest/javascript-api/k6-http/set-response-callback/).

Thresholds iniciais: failed<1%, checks=100%, p95 read/auth_read<800ms, 2 VUs/1 minuto. Antes de promocao: teste progressivo somente em staging, approval/start/cancel concorrentes, ZAP baseline defensivo, Supabase Security/Performance Advisors, HTTPS e politica backup/RPO/RTO. Nao executar carga em producao.

Smoke HTTP exige Supabase public env para remoto; nao apresenta checks pulados como PASS. Inclui documento/assets/branding/robots/deep link/headers/cache/noindex e ANON/function sem auth negados. Local preview: 10 checks PASS, com pendencia Supabase explicita.

## Sequencia Exata para Staging

Procedimento para operador em rodada posterior autorizada. Nao foi executado remotamente.

1. Revisar snapshot/commit e worktree; guardar evidencia dos checks e artefatos. Nao incluir .env, tokens ou screenshots de contas reais.
2. Confirmar projetos Supabase/Vercel separados de producao, URL final staging, DB service privilegiado `focusedu_staging` e backup. Preparar CLI configurado/vinculado SOMENTE a staging (repo atual nao contem supabase/config.toml).
3. Executar o bloco **Staging Limpo: Preflight** do RUNBOOK antes das migrations: confirmar alvo, bootstrap pg_cron em pg_catalog + pg_net em extensions + Vault em vault e check read-only. Nao criar valores Vault/Edge neste preflight. Se faltar preload/permissao, habilitar pelo Dashboard staging e repetir; nunca DROP EXTENSION para corrigir schema.
4. Validar Auth/SMTP/Discord e redirects exatos; preparar guild/categorias e tres contas de teste. Configurar somente envs publicas VITE_* no Vercel staging.
5. Comparar migration history via `npx supabase migration list --linked`; revisar as faltantes em ordem da tabela. Aplicar manualmente com `npx supabase migration up --linked`. Imediatamente pausar o job conforme RUNBOOK e repetir check read-only/history. Sem db push/reset/repair automatico; nao marcar migration aplicada sem SQL correspondente.
6. Executar seed explicitamente: `psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f supabase/seed.sql`. Confirmar nove Focus Ideas e dados de escopo.
7. Executar os dez smokes SQL com conexao privilegiada de staging, usando a lista abaixo. Todos fazem ROLLBACK. Nao executar rc_concurrency_fixture.sql fora do runner Docker.
8. Manter job pausado. Em rodada posterior expressamente autorizada, configurar Vault/Edge/Auth/SMTP e publicar SOMENTE Edge Function/frontend staging; --no-verify-jwt exige handler validando JWT/worker secret. Reativar apenas apos validar esses gates e observar runs. Este preflight termina antes de configuracao de secrets/deploy.
9. Executar smoke HTTP remoto, E2E staging e checklist manual Auth/OAuth/Storage/Discord. Rebuild + scan:dist com envs publicas de staging.
10. Executar k6 staging com 2 VUs/1 minuto; Lighthouse, ZAP baseline e advisors. Verificar backlog, retry, permissao externa, audit e backup.
11. Registrar evidencias, resolver qualquer FAIL/HIGH e decidir homologacao do RC. Nenhuma promocao/deploy de producao faz parte deste procedimento.

```bash
for smoke in security_catalog remote lifecycle ux admin discord discord_worker join_gamification release_candidate participation_roles; do
  psql 'service=focusedu_staging' -X -v ON_ERROR_STOP=1 -f "supabase/tests/${smoke}_smoke.sql" || exit 1
done
npm run test:e2e:types
npm run test:e2e -- --project=staging
npm run smoke:production
k6 run tests/load/focusedu-load.js
```

Exportar envs do runner HTTP/E2E/load pelo armazenamento local/CI protegido. Load exige FOCUSEDU_LOAD_ENVIRONMENT=staging e FOCUSEDU_LOAD_BASE_URL=FOCUSEDU_LOAD_CONFIRMED_STAGING_URL, mais FOCUSEDU_LOAD_SUPABASE_URL, FOCUSEDU_LOAD_SUPABASE_PUBLISHABLE_KEY e FOCUSEDU_LOAD_AUTH_TOKEN. Nunca inserir tokens como literal em comandos versionados.

## Evidencia Local Final

PASS: npm run test; npm run lint; npm run format:check; npm run build; npm audit --audit-level=moderate; git diff --check; npm run test:db:rc; npm run test:e2e:types; npm run test:e2e -- --project=local; npm run scan:dist.

PASS local-only: FOCUSEDU_SMOKE_LOCAL_ONLY=true FOCUSEDU_SMOKE_BASE_URL=http://localhost:4178 npm run smoke:production.

PASS preflight local: `node scripts/rc-db-check.mjs --extensions` e `node scripts/rc-db-check.mjs --extensions --upstream-cron-schema`. Imagem `supabase/postgres:17.6.1.136`, digest `sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00`. Extensoes reais; nenhum pedido HTTP, secret ou ambiente remoto. A fixture altera somente o control no container descartavel, nao a imagem original nem qualquer banco remoto. Execucao/background workers e permissoes managed do operador continuam PENDING REMOTE VALIDATION.

PENDING REMOTE VALIDATION: schema/history real, extensoes/Cron/Vault, SMTP/provider OAuth, Storage API, E2E staging, headers Vercel, carga/security/performance/advisors/backup. Nao houve chamadas de alteracao a ambientes remotos.
