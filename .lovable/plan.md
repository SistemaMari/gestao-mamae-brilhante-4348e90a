# Correção dos 2 bugs

Diagnóstico confirmado pelos logs das Edge Functions. Aplicar 4 mudanças cirúrgicas:

## 1. `supabase/functions/admin-metrics/index.ts` (linhas 81–98)
Trocar `userClient.auth.getClaims(token)` por `userClient.auth.getUser()`, que existe em supabase-js 2.45 e já é o padrão usado em `exportar-relatorio-admin`. `userId = userData.user.id`.

## 2. `supabase/functions/exportar-relatorio-admin/index.ts`
- Em `coletarDados()` (linha 92), aceitar um segundo parâmetro `userClient` e chamar `userClient.rpc("metricas_diagnosticos_admin")` em vez de `admin.rpc(...)`. As MVs continuam via `admin` (service_role).
- Na chamada (linha 541), passar `userClient` que já existe no handler.

## 3. `src/pages/admin/ExportarPage.tsx`
Antes dos dois `setEstado("erro")` (caminho `if (error)` e `catch`), logar:
```ts
console.error('[exportar] Conteúdo:', conteudo, 'Formato:', formato,
  'Body:', { conteudo, filtros: contratoExportacao }, 'Erro:', error,
  'Status:', (error as any)?.context?.status,
  'Response:', await (error as any)?.context?.text?.().catch(() => null));
```
Mensagem ao usuário passa a incluir status + trecho da resposta para diagnóstico imediato.

## 4. `src/lib/exportarCsvAdmin.ts`
`console.info('[exportar-csv] cache vazio, refetch view:', view)` antes do refetch, e `console.error('[exportar-csv] etapa: <fetchQuery|rows-vazio> view:', view, 'erro:', e)` nos dois caminhos de falha.

## Critério de aceite
- Filtros País/Estado/Cidade em `/admin/*` populam com dados reais (Brasil → SP → São Paulo).
- Sem mais `[admin-metrics] getClaims threw` nos edge logs.
- Exportação Excel/PDF gera arquivo e retorna signed URL; sem mais `42501 forbidden`.
- Em qualquer falha futura, console mostra payload completo + status HTTP.
