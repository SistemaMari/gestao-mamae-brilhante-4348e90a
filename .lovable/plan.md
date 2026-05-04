# Prompt 25B — Filtros Globais + Exportação

## Ajustes incorporados (do feedback aprovado)
1. Cor lilás primária trocada de `#9b87f5` por **`#7C4DBA`** em todos os novos componentes desta entrega. Badge de filtros ativos: fundo `#EDE5F7`, texto `#5A3690`.
2. Filtros que só valem em exportação (período + momento_diagnostico) ganham marcador visual: ícone 📥 (Download de lucide) ao lado do label + tooltip "Aplicado apenas em arquivos exportados. Totais da tela refletem todos os períodos."
3. Helper `exportarCsvAdmin` faz refetch automático quando o cache do React Query estiver vazio, exibindo loading durante a operação.
4. Erros de timeout no `supabase.functions.invoke` recebem mensagem específica: "Exportação muito grande. Aplique filtros de período ou tipo de conta para reduzir o volume."

## Arquivos novos
- `src/contexts/AdminFiltrosContext.tsx` — Context + sessionStorage (`admin:filtros`), defaults (últimos 6 meses), `filtrosAtivosCount`, `contratoExportacao` (formato Edge Function).
- `src/components/admin/BarraFiltrosGlobais.tsx` — barra horizontal com 7 filtros (Período/País/Estado/Cidade/Tipo/Unidade/Momento), botões "Filtrar" (`#7C4DBA`) e "Limpar", badge ativos. Período e Momento marcados com 📥 + tooltip. Renderizada só em `/admin`, `/admin/diagnosticos`, `/admin/exportar`.
- `src/lib/exportarCsvAdmin.ts` — converte arrays agregados em CSV (`;`, UTF-8 BOM). Faz refetch via `queryClient.fetchQuery` quando cache vazio.

## Arquivos modificados
- `src/pages/admin/AdminLayout.tsx` — envolve com `AdminFiltrosProvider` + renderiza `<BarraFiltrosGlobais />` abaixo do header.
- `src/pages/admin/PreviewAdminLayout.tsx` — idem.
- `src/pages/admin/VisaoGeralPage.tsx` — re-derivações client-side aplicando filtros geográficos/tipo/unidade às tabelas e gráficos.
- `src/pages/admin/DiagnosticosPage.tsx` — filtra `regional.por_estado/por_cidade/por_unidade` client-side.
- `src/pages/admin/ExportarPage.tsx` — substitui placeholder pela tela completa (resumo + seletor conteúdo + seletor formato + botão).
- `src/contexts/AuthContext.tsx` — limpa `sessionStorage` no `signOut`.

## Fluxo de exportação
- **CSV**: lê cache via `queryClient.getQueryData(['admin-metrics', view, ...])`; se undefined, chama `queryClient.fetchQuery` (com loading "Carregando dados..."). Gera blob `text/csv;charset=utf-8` com `\ufeff` BOM, separador `;`. Download imediato.
- **Excel/PDF**: `supabase.functions.invoke('exportar-relatorio-admin', { body: { formato, conteudo, filtros: contratoExportacao }})`. Loading "Gerando relatório...". Trata `status === 'vazio'`, erro genérico (com botão "Tentar novamente") e timeout (mensagem específica).

## Limitação MVP comunicada na UI
Período e momento_diagnostico ainda não recalculam totais da tela (back-end não aceita esses parâmetros hoje). Marcados visualmente como "exportação apenas". Filtros geográficos/tipo/unidade funcionam visualmente. Todos os 8 são enviados corretamente para a Edge Function de exportação.
