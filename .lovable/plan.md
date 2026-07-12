## 1. Remover filtros globais da aba "Dicas do Dashboard"

`src/pages/admin/AdminLayout.tsx` (linha 72) tem uma lista de rotas que ocultam a `BarraFiltrosGlobais`. Basta incluir `/admin/dicas` nessa lista.

## 2. Recarregamento da tela ao clicar no menu lateral

Investigar a causa. O `AdminSidebar` já usa `NavLink` do `react-router-dom` (SPA), então em tese não deveria recarregar. Suspeitas a validar em runtime (Playwright + Network tab):

- Alguma âncora `<a href>` em vez de `NavLink` disparando navegação nativa.
- Reload provocado por `window.location` em algum handler (ex.: logout, event listener).
- Perceção de "flash" causada pelo `AdminLayout` remontando queries pesadas (`useAdminMetrics`) a cada rota — o layout em si não deveria remontar, mas se algum `key` na árvore mudar por rota, remontaria.

Ação: reproduzir com Playwright, olhar o console/network (se houver um GET do `index.html` = reload real; se não, é só re-render). Corrigir a causa identificada — sem chute.

## 3. Card "Total de gestores de unidade"

Perfil `gestor` (perfil_institucional='gestor') na tabela `profissionais`, distinto de `gestor_geral`.

Passos:
1. Migração: recriar `mv_admin_resumo_global` adicionando `total_gestores_unidade` (count de `profissionais` onde `perfil_institucional = 'gestor'` e `deletado_em IS NULL`), com `REFRESH MATERIALIZED VIEW`.
2. `src/lib/adminMetrics.ts`: adicionar `total_gestores_unidade: number` no tipo `ResumoGlobalRow`.
3. `src/pages/admin/VisaoGeralPage.tsx`: transformar o grid final em 3 colunas (`md:grid-cols-3`) e inserir um novo card "Total de gestores de unidade" entre "Total de gestores gerais" e "Consolidações ativas", usando o mesmo padrão visual (borda lilás/verde-água, ícone `Users`).

## Arquivos afetados

- `src/pages/admin/AdminLayout.tsx`
- `src/pages/admin/VisaoGeralPage.tsx`
- `src/lib/adminMetrics.ts`
- Nova migração Supabase para `mv_admin_resumo_global`
- Investigação Playwright (sem alteração de código até confirmar a causa do reload)
