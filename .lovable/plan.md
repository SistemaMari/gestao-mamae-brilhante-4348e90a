

## Plano: Padronizar meta de jejum em **< 95 mg/dL**

### Decisão clínica aprovada
- **Apenas jejum** muda: `90 → 95`, com operador estritamente menor (`< 95`).
- **Não muda**: pré-prandial (70–100), pós-prandial (< 140), GTT diagnóstico (jejum ≥ 92).
- Valor exatamente igual a 95 = **fora da meta** (vermelho).

### Arquivos a corrigir

| # | Arquivo | O que muda |
|---|---|---|
| 1 | `src/components/FichaACForm.tsx` | `POINT_METAS.jejum: 90 → 95`; tooltip jejum: `< 90 mg/dL` → `< 95 mg/dL` |
| 2 | `src/components/FichaACReadOnlyGrid.tsx` | `POINT_METAS.jejum: 90 → 95` (label da coluna passa a `< 95 mg/dL`) |
| 3 | `src/components/FichaBDForm.tsx` | `POINT_META_LABELS.jejum: '< 90' → '< 95'`; tooltip jejum: `< 90 mg/dL` → `< 95 mg/dL`; `isWithinMeta` jejum: `value < 90` → `value < 95` |
| 4 | `src/components/FichaBDReadOnlyGrid.tsx` | `POINT_META_LABELS.jejum: '< 90' → '< 95'`; `isWithinMeta` jejum: `value < 90` → `value < 95` |
| 5 | `src/components/laudo/GradeGlicemicaCompacta.tsx` | Trocar `valor <= 95` por `valor < 95` no jejum (operador estritamente menor); manter `<= 95` apenas se for o caso da pré-prandial — **mas** como pré-prandial NÃO é alterada nesta tarefa, ajustar a função `dentroMeta` para refletir as regras corretas: jejum `< 95`, pós `<= 140`, e remover a aplicação de `≤95` para pré-prandial nos 6 pontos (pré usa 70–100, igual à Ficha B/D). Atualizar comentário cabeçalho. |

### Observações

- **GTT** (`GttForm.tsx`): mantido como está (`jejum >= 92` é critério **diagnóstico** OMS/IADPSG, não meta de acompanhamento). Não tocar.
- **`previewPatients.ts`**: dados fictícios de demonstração. Não tocar — alguns valores em 88/90 servem justamente para mostrar o sistema marcando como "fora da meta" depois da mudança (comportamento esperado).
- **`UsageWarningBanner.tsx`**: o `90` é threshold de % de uso de laudos, não tem relação com glicemia. Não tocar.
- **`intergrowth.ts`**: `p90` é percentil INTERGROWTH-21st para peso fetal. Não tocar.
- **Backend / Edge Function `gerar-laudo`**: hoje é esqueleto, não há lógica de meta. Quando o Prompt 16 for executado, o prompt da IA deve receber `meta_jejum_mgdl = 95` — anotar para o próximo prompt.

### Critérios de aceite
1. Tooltips de jejum em A/C e B/D mostram **"Meta: < 95 mg/dL"**.
2. Cabeçalho da coluna "Jejum" nos grids readonly mostra **"< 95 mg/dL"**.
3. Célula com valor `94` fica verde; valor `95` ou `96` fica vermelha.
4. Pré-prandial e pós-prandial inalterados nos cinco arquivos.
5. GTT diagnóstico inalterado.
6. Build passa sem erros TS.

### Fora de escopo
- Conteúdo da IA (Prompt 16).
- Migração de dados históricos já gravados em `valores_perfil` (apenas a meta de comparação muda; valores brutos permanecem).

