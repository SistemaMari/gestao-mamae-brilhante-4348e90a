# Plano AJ1 — Componentes Visuais Admin Reutilizáveis

Trabalho 100% destravado: cria fundação visual que será consumida por 23B/24B/26B/27B futuros. Sem chamadas a API, sem hooks de dados, sem alterações nas páginas existentes.

## Arquivos a criar

1. `src/components/admin/AlertaCard.tsx`
2. `src/components/admin/MetricaCard.tsx`
3. `src/components/admin/TabelaOrdenavel.tsx`
4. `src/components/admin/GraficoEvolucao.tsx`
5. `src/pages/_dev/ComponentesDemoPage.tsx`

## Arquivo a modificar

- `src/App.tsx` — adicionar rota pública `/vitrine/admin/componentes` (sem `ProtectedRoute`).

## Especificação resumida

### AlertaCard
- Props: `tipo` (`critico` | `atencao` | `info` | `sucesso`), `titulo`, `numero`, `descricao`, `linkVerDetalhes?`.
- Card branco, border-radius 8px, sombra sutil, borda lateral esquerda 4px na cor do tipo (critico `#DC2626`, atencao `#F59E0B`, info `#3B82F6`, sucesso `#16A34A`).
- Ícone Lucide por tipo (`AlertTriangle`/`AlertCircle`/`Info`/`CheckCircle`).
- Título Sora 14 bold `#1E293B`; número Sora 28 bold (cor do tipo); descrição Plus Jakarta Sans 13 `#64748B`.
- Link "Ver detalhes" canto inferior direito, lilás `#9b87f5`, só aparece se prop fornecida.

### MetricaCard
- Props: `label`, `valor`, `formato?` (`numero`|`percentual`|`moeda`), `variacao?` `{ valor, periodo }`.
- Card branco, borda `#E2E8F0`, padding 20px.
- Label Plus Jakarta 14 `#64748B`; valor Sora 28 bold `#1E293B`; formatadores: `%`, `R$ `, `Intl.NumberFormat('pt-BR')` para número.
- Variação com seta ↑ verde / ↓ vermelha + `vs {periodo}` 12px.

### TabelaOrdenavel
- Props: `colunas: { chave, titulo, ordenavel?, formato?, alinhamento? }[]`, `dados`, `paginacao?`, `itensPorPagina?` (default 20).
- Cabeçalho fundo `#E8E0FF`, Sora 14 bold; clique alterna asc/desc com `ChevronUp`/`ChevronDown`.
- Linhas zebradas `#FFFFFF`/`#F8FAFC`, hover `#F1F5F9`, células 12px/10px.
- Paginação ativa quando `paginacao && dados.length > 50`; controles `< Anterior [n] >` + "Mostrando X-Y de Z".
- Estado vazio: "Nenhum dado para exibir" `#94A3B8`.
- Scroll horizontal `<768px`.
- Estado interno com `useState` para `sortKey/sortDir` e `page`.

### GraficoEvolucao
- Props: `dados: { mes, valor }[]`, `titulo?`, `cor?` (default `#9b87f5`), `altura?` (default 280).
- Recharts `LineChart` em `ResponsiveContainer`; linha strokeWidth 2, dot raio 4.
- Eixo X = mes, Y automático, grid horizontal `#F1F5F9`, sem grid vertical.
- Tooltip branco borda `#E2E8F0`.
- Se `dados.length===0`: mensagem central "Sem dados no período".

### ComponentesDemoPage (`/vitrine/admin/componentes`)
- Cabeçalho "Componentes Admin — Demonstração" + texto introdutório.
- **Seção 1 — AlertaCard**: grid 3 colunas com 5 alertas (1 critico, 2 atencao, 1 info, 1 sucesso) cobrindo os 5 tipos do 23B v3: `profissional_inativo_30d`, `intermediaria_inativo_30d`, `inicial_inativo_30d`, `unidade_dormente`, `onboarding_travado`.
- **Seção 2 — MetricaCard**: grid 4 colunas — Total profissionais (42), Ativos (28), Total unidades (5), Total laudos (1247). Mais 1 percentual e 1 moeda de exemplo.
- **Seção 3 — TabelaOrdenavel**: 60 linhas mock (Cidade, Estado, Profissionais) para validar paginação 3×20.
- **Seção 4 — GraficoEvolucao**: 12 meses Jan/26..Dez/26 com valores crescentes 5→42.

## Identidade visual
Sora (títulos/números) + Plus Jakarta Sans (corpo). Paleta: lilás `#9b87f5`, lilás claro `#E8E0FF`, roxo `#7C4DBA`, fundo `#F8FAFC`. Banidas: `#2D2B55`, `#7E69AB` em gráfico, azul royal, coral, peach.

## Fora de escopo
- Não plugar nas páginas reais (`/admin`, `/admin/admins`, etc.).
- Sem PieChart, sem dark mode, sem animações complexas.
- Sem hook `useAdminMetrics`, sem React Query.
- Sem fixtures globais — mocks ficam dentro da própria `ComponentesDemoPage`.

## Critérios de aceite
12 critérios do BLOCO 5 do prompt (componentes tipados, paginação automática >50, 5 tipos de alerta na demo, 60 linhas na tabela, 12 meses no gráfico, nenhuma página existente alterada).
