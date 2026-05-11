## Único ajuste: destaque visual do valor da glicemia no Retorno 1

Escopo reduzido — toca só no Retorno 1. Nada de Ficha A/B/C/D, GTT ou handoff backend.

### Problema

Em `/paciente/7d446b8e-...`, o card do Retorno 1 mostra "Sem dados de resultado." mesmo havendo glicemia plasmática 105 mg/dL no banco. Causa: `Retorno1ResultCard` extrai o valor com regex de `consulta.observacoes`, mas essa coluna está `NULL` na consulta. O valor real (`105`) está em `exames_glicemia.valor_mgdl` (`tipo_exame='plasmatica'`, `consulta_id` casa). Audit já confirmou: **zero** retornos 1 em produção dependem do regex em `observacoes` — `exames_glicemia` cobre 100%.

### Mudanças

**1. `src/pages/FichaPacientePage.tsx`** — uma query extra após carregar consultas:

```ts
const consultaIds = (cons ?? []).map(c => c.id);
const { data: exames } = consultaIds.length
  ? await supabase
      .from('exames_glicemia')
      .select('consulta_id, valor_mgdl, tipo_exame, data_exame')
      .in('consulta_id', consultaIds)
  : { data: [] };

const exameByConsulta = new Map(
  (exames ?? []).map(e => [e.consulta_id, e])
);
```

No `.map` que monta as consultas, para `tipo === 'retorno_1'`, injetar:
```ts
retorno1_valor_gj: exameByConsulta.get(c.id)?.valor_mgdl ?? null,
retorno1_tipo_exame: exameByConsulta.get(c.id)?.tipo_exame ?? null,
retorno1_data_exame: exameByConsulta.get(c.id)?.data_exame ?? null,
```
(campos já existem em `PreviewConsulta`)

**2. `src/components/Retorno1ResultCard.tsx`**:

- Trocar `parseValorFromObs` por leitura direta de `consulta.retorno1_valor_gj`. Manter fallback do regex apenas como rede para preview/dados antigos (sem custo).
- Acima do `<p>` da descrição, adicionar destaque visual:

```tsx
<p className={`mt-2 font-heading text-4xl font-bold leading-none ${resultado.cor}`}>
  {valor}
  <span className="ml-1 text-base font-medium opacity-80">mg/dL</span>
</p>
```

Mantém ícone, label e texto explicativo já existentes. Cor herda do `resultado.cor` (verde `text-emerald-800` / laranja `text-orange-800` / vermelho `text-red-800`).

### Fora do escopo

Ficha A/C, Ficha B/D, GTT, `gerar-laudo`, RLS, migrations, backend. Nada de handoff doc.

### Entrega

Após aplicar:
- Build verificado.
- Print do card do Retorno 1 (paciente atual, 105 mg/dL) com valor destacado em laranja.
