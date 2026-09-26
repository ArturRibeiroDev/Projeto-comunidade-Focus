# FocusEdu

Produto da Focus Tecnologia voltado à formação prática, comunidade, squads e desenvolvimento através de projetos.

## O que esta versão entrega

- Dashboard baseado nos projetos, squads e evidências armazenados localmente.
- Catálogo com os 9 templates oficiais, busca e filtros por status, área, tecnologia, dificuldade e tipo.
- Detalhe de projeto com squad, composição recomendada não bloqueante, tecnologias, escopo e stacks possíveis.
- Entrada em projeto com escolha de função e intenção de contribuição.
- Reutilização de Focus Projects para originar novas squads comunitárias.
- Criação de projetos comunitários com tecnologias e áreas extensíveis.
- Perfil profissional com áreas, tecnologias, disponibilidade, links, projetos e evidências.
- Persistência via `localStorage`.

## Identidade visual

A interface reutiliza os assets oficiais e o sistema visual encontrado no Focus Radar:

- logo horizontal e marca compacta da Focus Tecnologia;
- Geist Sans e Geist Mono;
- base preta, superfícies densas, bordas discretas e laranja Focus `#ff5a1f`;
- sidebar expansível, topbar translúcida, componentes compactos e layout responsivo.

Os tokens ficam em `src/styles/tokens.css`. Os estilos são separados por base, layout, componentes, páginas e responsividade, todos importados por `src/styles.css`.

## Como rodar

```bash
npm install
npm run dev
```

Para validar:

```bash
npm run test
npm run build
```

## Estrutura

- `src/components/layout`: shell, navegação e branding.
- `src/components/projects`: catálogo, filtros, cards, detalhe, squad e entrada.
- `src/components/profile`: identidade profissional, competências e evidências.
- `src/components/ui`: componentes básicos usados em mais de uma área.
- `src/pages`: composição das telas do produto.
- `src/data`: opções livres e os 9 projetos iniciais.

## Decisões de arquitetura

Tecnologias, funções, áreas e interesses permanecem como dados livres. As listas de `src/data/options.ts` são sugestões para a experiência inicial, não enumerações rígidas de banco.

A chave histórica `focus-hub-state-v1` foi mantida internamente para preservar dados já salvos no navegador durante a mudança de nome. Ela não aparece na interface.

Em uma evolução com backend, os principais agregados continuam sendo `members`, `projects`, `project_memberships`, `tags`, `member_evidence` e `project_templates`.
