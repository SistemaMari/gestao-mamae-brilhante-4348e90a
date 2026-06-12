## Encerramento Cenário 7 — % dentro unificado + texto único de conduta

### Mudanças

**1. `src/components/FichaBDForm.tsx` (pop-up de encerramento, linhas 766-776)**
Substituir a exibição "% FORA" (cálculo `100 - percentual`) pelo "% dentro da meta", consumindo `savedResult.percentual` direto, formatado em pt-BR (vírgula). Texto:
- `"Controle inadequado — apenas {X,X}% dentro da meta"` (substitui "{Y,Y}% DAS GLICEMIAS FORA DA META")
- Mantém o texto das 3 condutas (AVALIAR / ASSOCIAR / CONSIDERAR) já presente.
- Também ajustar o ramo "adequado" para usar a mesma formatação pt-BR ("{X,X}% dentro da meta") por consistência da regra única.

**2. `src/components/FichaBDResultCard.tsx` (card de encerramento inadequado, linhas 53-61)**
Substituir o parágrafo de conduta:
- De: `"Encaminhar para GO de alto risco + endocrinologista. Detalhes no laudo completo abaixo."`
- Para: `"AVALIAR sua segurança para continuar com o caso OU ASSOCIAR com endocrinologista OU CONSIDERAR referenciamento especializado (no caso de sistema público). Detalhes no laudo completo abaixo."`
- Padronizar o número "{percentual.toFixed(1)}%" para formato pt-BR (vírgula decimal) — vale também para o ramo adequado, para card e pop-up baterem byte a byte.

**3. Helper compartilhado de veredito**
Adicionar `src/lib/vereditoControle.ts` exportando:
```ts
formatPctDentroPtBr(pct: number): string  // "51,1%"
vereditoControle(pct: number): { adequado: boolean; titulo: string }
// adequado (>=70): "Controle adequado — {X,X}% dentro da meta"
// inadequado (<70): "Controle inadequado — apenas {X,X}% dentro da meta"
```
Consumir esse helper no card (`FichaBDResultCard`) e no pop-up (`FichaBDForm`) para garantir que nunca divirjam.

### Fora de escopo (não tocar)
- Contagem "N de M valores" (débito do 38A).
- Placeholder "Texto pendente" do laudo.
- Cards/pop-ups dos cenários 2, 3, 4.
- Títulos dos cards/pop-ups ("CONTROLE ADEQUADO COM INSULINA" / "ENCERRAMENTO DA MARI").
- Lógica de cálculo do percentual em si.

### Critérios de aceite
- Pop-up Cenário 7 mostra "% dentro da meta" (sem mais "fora").
- Card e pop-up mostram exatamente o mesmo percentual para a mesma paciente.
- Inadequado: "apenas {X,X}% dentro da meta"; adequado: "{X,X}% dentro da meta".
- Card de encerramento C7 traz o texto AVALIAR / ASSOCIAR / CONSIDERAR.
- Contagem "N de M" inalterada.
