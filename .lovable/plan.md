
## Prompt 23B — Dashboard Admin · Visão Geral

Construir a seção **Visão Geral** (`/admin`) consumindo as 8 views materializadas expostas pela Edge Function `admin-metrics` (entregue em 23A). Toda a estrutura espelha em `/vitrine/admin` sem auth, com fallback mock se a Function bloquear o token anônimo.

O **Prompt Raiz** já está aplicado ao projeto (paleta lilás/verde-água/roxo, fontes Sora + Plus Jakarta Sans, tom afirmativo, gestor geral sem acesso clínico, etc.). Sem mudança de identidade — apenas reafirmação ao construir os novos componentes.

### 1. Camada de dados

**`src/lib/adminMetrics.ts`**
- `fetchAdminView(view, params?)` → `supabase.functions.invoke('admin-metrics', { body: { view, pais? } })`. Retorna `rows`.
- Whitelist local com os 8 slugs do 23A: `resumo_global`, `distribuicao_geografica`, `top_cidades`, `unidades_resumo`, `profissionais_por_plano`, `evolucao_mensal_planos`, `evolucao_mensal_profissionais`, `alertas_operacionais`.
- Tipos: `ResumoGlobalRow`, `AlertaRow`, `EvolucaoRow`, `PlanoRow`, `UnidadeResumoRow`, `GeoRow`, `CidadeRow`.

**`src/hooks/useAdminMetrics.ts`**
- `useAdminView<T>(view, params?, opts?)` — wrapper de `useQuery` com `staleTime: 5min` por padrão.
- `useAlertasOperacionais()` com `staleTime: 60s`.
- `enabled` controlado (vitrine pode desligar após 401).
- Em vitrine: 1 tentativa; se 401/403, devolve mock de `mockAdminMetrics.ts`.

**`src/lib/mockAdminMetrics.ts`** — payload representativo das 8 views, números coerentes com `mockVisaoGeral`. Comentário no topo lista as 8 views consumidas + versão do schema do 23A para facilitar manutenção quando o Lucas alterar uma MV.

### 2. Componentes reutilizáveis (`src/components/admin/`)

- **`AlertaOperacionalCard.tsx`** — borda lateral 4px colorida, ícone Lucide, número grande (Sora 28px bold), título, descrição, link "Ver detalhes" (`to="#"`, comentário citando Prompt 25). Os 5 cards têm tratamento visual idêntico — sem variação de opacidade.
- **`GraficoPizzaPlanos.tsx`** — Recharts PieChart, 3 fatias fixas: Inicial `#5EEAD4`, Intermediária `#D6BCFA`, Profissional `#7C4DBA`. Tooltip + legenda.
- **`GraficoPizzaTiposUnidade.tsx`** — PieChart genérico, paleta da marca (lilás/menta/roxo).
- **`GraficoLinhaEvolucao.tsx`** — LineChart Recharts (últimos 12 meses), aceita 1+ séries (reusa para evolução de profissionais e de planos).
- **`SeletorPais.tsx`** — Select shadcn alimentado pelos países distintos de `distribuicao_geografica`. Default `"BR"`.
- **`SecaoBloco.tsx`** — wrapper com título Sora + skeleton durante loading (cada bloco carrega independente).
- **`TabelaOrdenavel.tsx`** (já existe) — estender se necessário para paginação 20/página quando `rows.length > 50`.

### 3. Mapa dos 5 alertas (v3)

```
profissional_inativo_30d   "Plano Profissional sem uso há 30+ dias"   #F59E0B
intermediaria_inativo_30d  "Plano Intermediária sem uso há 30+ dias"  #F59E0B
inicial_inativo_30d        "Plano Inicial sem uso há 30+ dias"        #F59E0B
unidade_dormente           "Unidades sem profissionais ativos no mês" #94A3B8
onboarding_travado         "Cadastros há 7+ dias sem completar perfil" #EF4444
```
Sempre os 5 cards, nesta ordem. Tipo ausente na view → mostrar 0. **Sem** `teste_expirando`.

### 4. `src/pages/admin/VisaoGeralPage.tsx`

Layout vertical (desktop-first; tablet empilha pizzas; mobile 1 coluna):

```text
┌ Cards de resumo rápido (já existentes)            ┐  ← mantidos
├ Alertas Operacionais (grid 3/2/1, 5 cards)        ┤  ← NOVO
├ Evolução mensal de profissionais (linha)          ┤
├ [ Pizza planos ] [ Pizza tipos de unidade ]       ┤
├ Tabela: Distribuição por país (cont. + %)         ┤
├ Tabela: Distribuição por estado (filtro país)     ┤
├ Tabela: Top 20 cidades                            ┤
├ Tabela: Profissionais por unidade                 ┤
├ Tabela: Pacientes por unidade (hist/ativos90/%)   ┤
└ [ Card: Total gestores gerais ] [ Consolidações ] ┘
```

- Cards de resumo do topo: continuam com `supabase.from(...).select(count)` autenticado e `mockVisaoGeral` em vitrine (já existe).
- Todo o restante chama exclusivamente `admin-metrics` via os hooks.
- Skeleton próprio por bloco (4 linhas em tabelas, círculo nas pizzas, retângulo nas linhas).
- Ordenação clicável nas tabelas. Paginação 20/página em tabelas com >50 linhas.

### 5. Espelho na vitrine

- `/vitrine/admin` → `VisaoGeralPage` dentro de `PreviewAdminLayout` (já existe em `App.tsx`).
- `VisaoGeralPage` detecta `isPreview = pathname.startsWith('/vitrine')`. Em preview os hooks recebem `previewMode: true` → tentam Edge Function 1x; falhou → mock. Skeletons durante a tentativa.
- `AdminSidebar` já prefixa links com `/vitrine` quando aplicável.

### 6. Critérios de aceite cobertos

- `/admin` deixa de ser placeholder.
- 5 alertas v3 (sem `teste_expirando`) com número, descrição e "Ver detalhes".
- Profissionais cadastrados + linha de evolução mensal.
- Profissionais ativos 30d (`total_profissionais_ativos_30d` de `resumo_global`).
- Distribuição país/estado/cidade (estado com seletor, default BR).
- Pizza planos com 3 fatias exatas (Inicial/Intermediária/Profissional), cores `#5EEAD4` / `#D6BCFA` / `#7C4DBA`.
- Linha de evolução de planos. Total unidades + pizza tipo de unidade.
- Tabelas profissionais por unidade e pacientes por unidade (hist/ativos90/%).
- Cards gestores gerais + consolidações. Tabelas ordenáveis, gráficos com tooltip.
- Skeleton independente por bloco.
- Zero acesso direto a `mv_*` — só via Edge Function.
- Paginação 20/página em tabelas grandes. React Query 5min (60s para alertas).
- Espelho `/vitrine/admin` renderiza a mesma tela sem auth.
- Apenas paleta oficial. Nenhum dado clínico individual.

### Detalhes técnicos

- Bibliotecas: `recharts` e `@tanstack/react-query` já instalados; `QueryClient` em `App.tsx`.
- Sem migrações; 23A já criou MVs e cron jobs.
- Tipos locais em `adminMetrics.ts` com base no schema declarado no 23A.
- Cores semânticas restritas aos alertas; paleta da marca nos gráficos.
- Textos PT-BR diretos (admin não traduzido).
- Nada em `client.ts` / `types.ts` (auto-gerados).

### Arquivos a criar
- `src/lib/adminMetrics.ts`
- `src/lib/mockAdminMetrics.ts`
- `src/hooks/useAdminMetrics.ts`
- `src/components/admin/AlertaOperacionalCard.tsx`
- `src/components/admin/GraficoPizzaPlanos.tsx`
- `src/components/admin/GraficoPizzaTiposUnidade.tsx`
- `src/components/admin/GraficoLinhaEvolucao.tsx`
- `src/components/admin/SeletorPais.tsx`
- `src/components/admin/SecaoBloco.tsx`

### Arquivos a editar
- `src/pages/admin/VisaoGeralPage.tsx` — substitui placeholder por conteúdo completo.
- `src/components/admin/TabelaOrdenavel.tsx` — paginação opcional, se ainda não tiver.
- `src/lib/mockVisaoGeral.ts` — mantido (mock novo vai em arquivo separado).

Sem mudanças em backend, RLS, edge functions ou rotas além do que já está em `App.tsx`.
