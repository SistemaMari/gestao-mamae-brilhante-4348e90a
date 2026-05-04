## Ajustes finos em /vitrine/admin

### 1. Log de debug do fallback — `src/hooks/useAdminMetrics.ts`

Em `fetchPreviewView`, adicionar `console.info('[vitrine] Fallback mock ativado para view:', view)` em dois pontos:

- No ramo `if (!res.ok) { ... return fallback }`
- No `catch { ... return fallback }`

Como `fetchPreviewView` só é chamado quando `previewMode === true` (ver `queryFn` no `useAdminView`), o log nunca dispara em produção autenticada. Nenhuma outra alteração na lógica de fetch/fallback.

Também adicionar log no caminho onde `rows` vem vazio/inválido (mesmo tratamento — cai no fallback), para consistência com os 8 views esperados.

### 2. Warnings Recharts width(-1)/height(-1)

Os 3 componentes já usam `<ResponsiveContainer>` dentro de `<div style={{ width: '100%', height: N }}>`, mas o warning aparece quando o pai (grid/card) ainda não tem largura computada no primeiro paint. Solução: trocar o wrapper inline por classe Tailwind com `min-h-[Npx] w-full` para garantir reserva de espaço antes do measure do ResponsiveContainer.

**`src/components/admin/GraficoLinhaEvolucao.tsx`**
```tsx
<div className="min-h-[280px] w-full">
  <ResponsiveContainer width="100%" height={280}>
    <LineChart data={dados}>...</LineChart>
  </ResponsiveContainer>
</div>
```

**`src/components/admin/GraficoPizzaPlanos.tsx`** e **`src/components/admin/GraficoPizzaTiposUnidade.tsx`**
```tsx
<div className="min-h-[300px] w-full">
  <ResponsiveContainer width="100%" height={300}>
    <PieChart>...</PieChart>
  </ResponsiveContainer>
</div>
```

Altura sobe de 280 → 300 nas pizzas conforme especificado. Linha de evolução mantém 280.

### Critério de aceite
- Console em `/vitrine/admin`: 8 linhas `[vitrine] Fallback mock ativado para view: …` (uma por view).
- Sem warnings `width(-1) and height(-1)`.
- Gráficos renderizam imediatamente, sem flash.
- `/admin` autenticado inalterado (log nunca dispara, `fetchAdminView` segue intocado).

### Arquivos editados
- `src/hooks/useAdminMetrics.ts`
- `src/components/admin/GraficoLinhaEvolucao.tsx`
- `src/components/admin/GraficoPizzaPlanos.tsx`
- `src/components/admin/GraficoPizzaTiposUnidade.tsx`
