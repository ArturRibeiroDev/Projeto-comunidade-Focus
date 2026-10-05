# FocusAcademy: decisões de produto

FocusAcademy é um produto da **Focus Tecnologia** para transformar a comunidade em um ambiente de formação prática. Projetos reais ou propostos pela comunidade reúnem pessoas em squads multidisciplinares para aprender, entregar e construir histórico profissional verificável. A identidade visual da Focus Tecnologia, incluindo seus assets oficiais, deve continuar reconhecível no produto. O logo principal do aplicativo é a arte oficial "COMUNIDADE powered by focus tech"; versões compactas devem ser recortes dessa arte, sem redesenhar o símbolo ou distorcer a proporção.

## Projetos e templates

- **Focus Idea / template Focus:** escopo preparado pela Focus para orientar uma ou mais squads. `Focus Idea` é o nome visível; internamente o modelo continua `ProjectTemplate`. Os nove escopos iniciais fazem parte do catálogo.
- **Community Project:** projeto iniciado por um membro, a partir de um template/escopo existente ou de uma ideia própria.
- **ProjectTemplate e Project são conceitos diferentes:** `ProjectTemplate` descreve um escopo reutilizável; `Project` representa uma execução concreta, com squad, participantes, status e histórico próprios. Reutilizar um escopo cria outro projeto, sem transferir os membros da execução de origem. Várias squads podem executar o mesmo escopo em paralelo.
- Membros devem poder usar um template Focus, replicar um projeto como ponto de partida ou criar um Community Project próprio. Escopo, stacks e entregáveis podem ser adaptados pela squad.
- A duração de qualquer projeto é livre. Templates não exigem nem destacam duração sugerida. Datas planejadas de início e conclusão são independentes e opcionais; quando ausentes, prazo não aparece nos cards. O problema e o público são centrais, não uma stack específica.

Os escopos oficiais são registros `ProjectTemplate`; cada squad usa um `Project` independente. O catálogo mostra ambos sem confundir o template com uma execução em andamento.

## Squads e participação

- Em `FORMING`, o owner pode remover outros membros com confirmação, nunca a si próprio. Cada membro, incluindo owner, pode alterar apenas sua própria função entre as áreas permitidas do projeto. Após iniciar, ambas as operações ficam bloqueadas. Ownership, evidências anteriores e regras de entrada permanecem intactos.
- Novas execuções começam com a data local atual como planejamento sugerido, editável; conclusão continua opcional.

- A composição da squad é livre. A composição sugerida é somente recomendação visual; nunca é requisito para entrar, criar ou conduzir um projeto.
- A entrada em squads reais exige solicitação e aprovação do owner/líder. A pessoa escolhe a função pretendida e pode registrar sua intenção de contribuição na solicitação; somente após aprovação essa função vira participação no projeto.
- Discord conectado é pré-requisito para solicitar entrada e para iniciar uma squad. O Discord ID confiável vem do Identity Linking do Supabase, nunca de username informado pelo cliente.
- Funções, áreas e tecnologias devem permanecer extensíveis. O produto atende Backend, Frontend, UX/UI, QA, dados, produto, infraestrutura, segurança, mobile e outras especialidades; nenhuma lista inicial é uma taxonomia fechada.
- Evidências e histórico devem refletir trabalho real: projeto, função exercida, tecnologia utilizada e contribuição registrada. Não criar ranking, XP, níveis ou gamificação artificial.
- Gamificação v1 deve refletir progresso real: pontos por conclusão de projeto, nível, conquistas discretas e progresso no perfil. Não há leaderboard, moeda, loja, streak diário ou recompensa por login.
- Em perfil, interesses são temas e tipos de projeto que a pessoa quer praticar, distintos da bio. Áreas, tecnologias, funções secundárias e interesses são seleções extensíveis, não texto com separadores obrigatórios.
- A bio tem limite de 600 caracteres, sem truncamento silencioso de conteúdo legado.

## Ciclo de vida do projeto

- O lifecycle pertence apenas a `Project`, nunca a `ProjectTemplate`: `FORMING` (squad em formação), `ACTIVE` (iniciado), `COMPLETED` (concluído), `CANCELLED` (cancelado) e `ARCHIVED` (histórico somente de leitura).
- Transições permitidas: `FORMING` para `ACTIVE` ou `CANCELLED`; `ACTIVE` para `COMPLETED` ou `CANCELLED`; `COMPLETED` ou `CANCELLED` para `ARCHIVED`. Não há reabertura nesta fase.
- Apenas o owner edita o escopo enquanto `FORMING` e decide iniciar, concluir, cancelar ou arquivar. ADMIN também pode cancelar qualquer projeto `FORMING` ou `ACTIVE` de forma administrativa, com motivo obrigatório e auditoria. Iniciar não depende de lotação nem de composição recomendada. `ACTIVE` não aceita entradas públicas nem saída silenciosa de membros.
- Apenas o owner aprova/rejeita solicitações de entrada. Ao iniciar ou cancelar um projeto, solicitações pendentes são encerradas para não ficarem aguardando em um projeto que não aceita novas entradas.
- Conclusão preserva links manuais e resumo da entrega e gera uma evidência por membro real. Cancelamento preserva squad e histórico, sem evidência de conclusão. Projetos arquivados continuam acessíveis no histórico, sem ações operacionais.

## Confiança e administração

- O owner é membro da squad ao criar um `Project`; ownership e participação contam nos limites de projetos abertos e participações simultâneas. Limites configuráveis começam em 3 projetos próprios `FORMING`/`ACTIVE`, 3 criações por janela móvel de 24 horas e 5 participações simultâneas em `FORMING`/`ACTIVE`. Conclusão, cancelamento e arquivamento liberam capacidade de projetos abertos, mas não apagam criações da janela de 24 horas.
- Papéis da plataforma são `MEMBER`, `MODERATOR` e `ADMIN`, separados das funções escolhidas em projetos. Suspensão impede operações de comunidade, mas preserva login, histórico e uma explicação para a pessoa.
- Community Projects e réplicas começam `PENDING`; só owner e moderação os veem até aprovação. Um projeto rejeitado mostra o motivo ao owner; após edição, pode ser reenviado. Editar um projeto comunitário aprovado em formação o devolve à revisão. Templates Focus oficiais não passam por esse fluxo e só ADMIN pode criá-los, editá-los ou arquivá-los.
- MODERATOR revisa e cancela projetos comunitários abusivos pelo fluxo de moderação, sem gerir papéis, limites ou conteúdo oficial. ADMIN tem visão geral, gestão de usuários, moderação, templates, configurações, auditoria e cancelamento administrativo global de projetos. Não há hard-delete administrativo de usuários/projetos.

## Comunidade e perfis

- Comunidade oferece descoberta de membros ativos para pessoas autenticadas, com busca por nome, área canônica e interesse. São 20 resultados por página, sem ranking, feed, mensagens ou seguidores.
- Perfil público significa público para a comunidade autenticada, não para a internet. O drawer abre pela Comunidade, squad e solicitação de entrada; contém nome, foto, bio, áreas/tecnologias/interesses, links GitHub/LinkedIn já configurados e somente o indicador de Discord conectado.
- Projetos e histórico públicos mostram até 20 registros recentes de projetos aprovados. Evidências pessoais sem projeto e dados de projetos pendentes/rejeitados permanecem privados. O histórico usa somente tipo, função, nome do projeto e data; não publica o texto livre da evidência.
- A navegação pública usa uma chave distinta do UUID de Auth. Nenhum email, papel administrativo, Discord ID ou estado de suspensão é incluído nessa representação.

## Fronteiras do produto

- **Discord:** comunicação entre pessoas e squads.
- **GitHub:** código, revisões e artefatos técnicos.
- **FocusAcademy:** catálogo, projetos, squads, percurso de aprendizagem e histórico/evidências dos membros.

Essas fronteiras são decisões de produto. A autenticação opcional via Discord não transforma o Discord em repositório de projetos; o GitHub ainda é apenas um link no perfil. Evidências geradas pelas ações do aplicativo não equivalem a verificação externa de contribuições.

## Discord

- Discord é a opção principal de entrada quando o provedor está configurado; e-mail/senha permanece disponível. Contas existentes vinculam a identidade pela API oficial do Supabase, sem união manual por e-mail.
- A seção Integrações do perfil é o local principal para conectar e gerenciar Discord. Em projetos em formação, a prontidão oferece um atalho somente para a própria conta; terceiros recebem apenas o aviso de conexão pendente. A interface mostra username quando disponível, nunca o ID Discord cru.
- Conectar Discord não entra automaticamente no servidor. O membro usa convite normal; presença no servidor Discord não é requisito para solicitar entrada. A identidade Discord conectada continua obrigatória para solicitação e início da squad.
- Ao iniciar uma execução real (`Project`), o bot prepara um canal privado para os membros conectados que já estejam no servidor. Um mesmo escopo pode gerar vários canais, um por squad. `ProjectTemplate` não possui canal.
- Owner ou ADMIN pode solicitar resync/retry. Iniciar exige identidade Discord conectada de todos os membros; a interface mostra a prontidão e quantos foram sincronizados no servidor. Falhas externas do bot não impedem lifecycle; concluir, cancelar e arquivar não exigem reconectar identidades.
- Conclusão e cancelamento deixam mensagens no canal; cancelamento torna-o somente leitura. Arquivamento move-o para a categoria configurada e preserva o histórico. Nenhum canal é apagado automaticamente.
