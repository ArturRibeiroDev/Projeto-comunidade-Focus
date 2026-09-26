# Focus Hub

Plataforma interna/comunitária para transformar a comunidade da Focus Tecnologia em um ambiente ativo de projetos, squads, aprendizado prático e criação de portfólio.

## O que esta versão entrega

- Catálogo com os 9 templates oficiais solicitados.
- Busca textual e filtros por status, área, tecnologia, dificuldade e tipo.
- Detalhe de projeto com membros, funções e composição recomendada não bloqueante.
- Entrada em projeto com escolha livre de papel e intenção de contribuição.
- Reutilização de um template para originar uma nova squad comunitária.
- Criação de projetos comunitários com tecnologias e áreas extensíveis.
- Perfil do membro com áreas, tecnologias, disponibilidade, links e evidências iniciais.
- Persistência local em `localStorage`, adequada para protótipo funcional.

## Como rodar

```bash
npm install
npm run dev
```

## Decisões de arquitetura

O domínio foi modelado para que tecnologias e funções sejam tags livres. As listas em `src/data/options.ts` são sugestões para a experiência inicial, não enumerações rígidas de banco.

Em uma evolução com backend, os principais agregados devem ser:

- `members`
- `projects`
- `project_memberships`
- `tags`
- `member_evidence`
- `project_templates`

Tecnologias, áreas e interesses devem continuar como dados administráveis, evitando mudanças de schema quando a comunidade adotar novas stacks.

## Próximos passos naturais

- Autenticação e perfis reais.
- API e banco relacional.
- Convites, solicitações de entrada e trilhas de onboarding por projeto.
- Evidências concretas vindas de integrações como GitHub, revisões, testes e entregas.
- Permissões para projetos oficiais Focus versus projetos comunitários.
