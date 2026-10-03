# Estilo de código

- TypeScript estrito; preserve tipos de domínio e valide entradas nas camadas de serviço/banco.
- Componentes React recebem dados e callbacks; operações remotas ficam em `src/services`.
- Uma instrução lógica por linha; evite JSX gigante, ternários aninhados e efeitos colaterais na mesma expressão. Prefira early returns, handlers nomeados quando ajudam e fluxos async com `try/catch/finally` explícitos.
- Prefira funções curtas e nomes descritivos. Extraia componentes/helpers quando reduzirem complexidade real; evite abstrações de uso único sem ganho claro.
- Comentários explicam decisões, não repetem o código. Nunca reduza checks de ownership, RLS, RPC, moderação ou limites para encurtar arquivos; migrations aplicadas permanecem imutáveis.
- Use tokens Focus e componentes existentes. Mantenha acessibilidade, estados de carregamento/erro e responsividade.
- `npm run lint` verifica TypeScript e regras de Hooks. As regras novas de atualização de estado em efeitos e acesso a refs durante render permanecem desativadas enquanto padrões legados são revistos; dependências de efeitos seguem sinalizadas. `npm run format:check` verifica a lista de arquivos adotados incrementalmente. Ao tocar um arquivo legado, formate-o e inclua-o na lista, evitando churn global.
- Antes de concluir, rode testes, lint, formatação e build; mudanças de produto ou arquitetura exigem atualização dos documentos correspondentes.
