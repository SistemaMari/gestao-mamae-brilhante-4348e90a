

## Plano: Recalcular IG no parto automaticamente a partir da Data do parto

### Problema atual
Em `src/components/RegistroPartoForm.tsx`:
- `igPartoSemanas` / `igPartoDias` são inicializados a partir da `igAtual` (que usa `new Date()` — hoje), via `useState`.
- Ao mudar a `Data do parto`, **nada recalcula** a IG. Os campos ficam estáticos com o valor de "hoje".
- Resultado: se o médico ajusta a data do parto para 3 dias atrás, a IG continua refletindo hoje.

### Solução
Calcular IG automaticamente como `(dataParto − DUM)` sempre que `dataParto` ou `paciente.dum` mudar, mantendo o campo **editável** (médico pode sobrescrever manualmente).

### Mudanças em `src/components/RegistroPartoForm.tsx`

**1. Estado de origem da IG** (espelha o padrão já usado para classificação):
```ts
type IgOrigem = 'auto' | 'manual';
const [igOrigem, setIgOrigem] = useState<IgOrigem>('auto');
```

**2. Inicializar IG vazia** (será preenchida pelo `useEffect`):
```ts
const [igPartoSemanas, setIgPartoSemanas] = useState<string>('');
const [igPartoDias, setIgPartoDias] = useState<string>('');
```

**3. Novo `useEffect` — recalcula IG a partir da data do parto + DUM:**
```ts
useEffect(() => {
  if (igOrigem === 'manual') return;          // respeita override manual
  if (!paciente.dum || !dataParto) return;
  const dias = differenceInDays(new Date(dataParto), new Date(paciente.dum));
  if (dias < 0) return;                        // data inválida (antes da DUM)
  setIgPartoSemanas(String(Math.floor(dias / 7)));
  setIgPartoDias(String(dias % 7));
}, [dataParto, paciente.dum, igOrigem]);
```

**4. Marcar override manual** quando o médico edita os inputs de IG:
```tsx
onChange={(e) => { setIgPartoSemanas(e.target.value); setIgOrigem('manual'); }}
```
(idem para `igPartoDias`)

**5. Indicador visual sutil** abaixo dos inputs de IG (mesmo padrão da classificação):
- Auto: *"IG calculada automaticamente a partir da DUM e da data do parto. Edite se necessário."*
- Manual: *"IG ajustada manualmente."*

**6. Remover** o uso atual de `igAtual` para inicializar os campos (continua sendo usado apenas no badge do cabeçalho — sem mudança visual ali).

### Comportamento resultante
- Abrir o formulário → IG preenchida com `(hoje − DUM)`.
- Mudar a Data do parto → IG recalcula automaticamente.
- Editar manualmente Sem/Dias → vira "manual"; futuras mudanças na data não sobrescrevem.
- A classificação Intergrowth-21st (PIG/AIG/GIG) continua reagindo normalmente, pois ela depende de `igPartoSemanas` + `igPartoDias`.

### Fora de escopo
- DUM, badge "IG atual", validações (20–42 sem, 0–6 dias), persistência, classificação do RN — tudo permanece igual.
- Outros formulários e cards.

### Arquivos afetados
- `src/components/RegistroPartoForm.tsx` (único arquivo).

