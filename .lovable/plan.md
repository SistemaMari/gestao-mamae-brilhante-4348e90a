## Diagnóstico

A tela de Diagnósticos está renderizando o erro **"Não foi possível carregar as métricas: forbidden"**.

Isso é o comportamento correto da RPC `metricas_diagnosticos_admin` — ela tem este bloqueio no início:

```sql
IF NOT public.is_admin(auth.uid()) THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
END IF;
```

Como você está acessando via `/vitrine/admin/diagnosticos` (vitrine pública, sem login ou logado como conta que não está na tabela `admins`), o `auth.uid()` não passa em `is_admin(...)` e a função aborta. A página então cai no branch de erro, mostrando o card vermelho.

**Não é regressão da página em si** — todo o layout, gráficos e cards continuam intactos. Falta apenas alimentar a página com dados quando estamos em modo vitrine.

## Solução

Fazer a `DiagnosticosPage` detectar `/vitrine` e, nesse caso, exibir **dados de demonstração mockados** localmente — sem chamar a RPC. Mesmo padrão que o `DashboardPage` já usa (`isPreview = pathname.startsWith('/vitrine')`).

A RPC e a tela real de admin (`/admin/diagnosticos`) ficam intactas.

### Arquivos a alterar

1. **`src/lib/mockMetricasDiagnosticos.ts`** (novo) — objeto com a mesma forma do JSON da RPC, preenchido com números plausíveis (~1.248 gestantes, ~187 DMG, evolução de 12 meses, top estados/cidades/unidades, desfechos perinatais). Serve apenas para a vitrine.

2. **`src/pages/admin/DiagnosticosPage.tsx`**:
   - Importar `useLocation` e o mock.
   - Adicionar `const isPreview = pathname.startsWith('/vitrine')`.
   - No `useEffect`: se `isPreview`, setar `dados = mock` e `loading = false`, **sem** chamar a RPC.
   - Caso contrário, fluxo atual permanece (chama RPC, trata erro).

Nada de migração, nada de RLS, nada de mexer na função SQL.

## Resultado esperado

- `/vitrine/admin/diagnosticos` mostra o painel completo populado com dados de exemplo (cards, evolução mensal, pizzas, funil, tabelas regionais).
- `/admin/diagnosticos` (admin de verdade) continua usando a RPC real, com os bloqueios de admin intactos.
- Sem alterações de backend / segurança.
