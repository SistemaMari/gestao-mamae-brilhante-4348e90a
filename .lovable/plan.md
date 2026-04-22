

# Substituir API do IBGE por lista estática vinda do PDF

## Decisão

A lista de cidades passa a vir **100% de um arquivo estático** dentro do projeto, gerado a partir do(s) PDF(s) que você vai enviar. Sem dependência de API externa, sem fallback parcial, sem aviso de "modo offline".

## O que vai mudar

### 1. Novo arquivo de dados: `src/data/cidadesIBGE.ts`

Arquivo gerado a partir do PDF, no formato:

```ts
export const CIDADES_POR_UF: Record<string, string[]> = {
  AC: ["Acrelândia", "Assis Brasil", ...],
  AL: ["Água Branca", "Anadia", ...],
  // ... 27 UFs
};
```

Cada UF com a lista **completa e oficial** do IBGE, ordenada alfabeticamente em pt-BR.

### 2. Substituir o hook `useCidadesIBGE`

O hook deixa de fazer `fetch` para `servicodados.ibge.gov.br` e passa a ler direto de `CIDADES_POR_UF[uf]`. Mantém a mesma assinatura `{ cidades, loading, erro }` para não quebrar o `ProfileForm`, mas:
- `loading` sempre `false` (resposta síncrona)
- `erro` sempre `null`
- Remove cache em memória, `inflight`, e toda a lógica de fallback

### 3. Limpar `ProfileForm.tsx`

- Remove a mensagem "Lista parcial (sem conexão com o IBGE)" — não faz mais sentido.
- Mantém o disabled do select de cidade enquanto não houver UF selecionada.

### 4. Limpar `locationData.ts`

- Remove o array `cities` de cada UF brasileira (vira fallback morto).
- Mantém `countries`, `states` (label/value) e os outros países (USA, Espanha etc.) intactos — eles continuam usando o modelo antigo porque o PDF só cobre Brasil.

## Como vamos montar a lista completa

O PDF que você enviou foi parseado, mas o parser só processa **as primeiras 50 páginas** — o documento parou em Minas Gerais (letra T). Faltam:

- Minas Gerais (de "T" em diante)
- Espírito Santo (parcial)
- Pará, Paraíba, Paraná, Pernambuco, Piauí
- Rio de Janeiro, Rio Grande do Norte, Rio Grande do Sul
- Rondônia, Roraima, Santa Catarina
- São Paulo, Sergipe, Tocantins

**Próximo passo (você):** reenviar o PDF dividido em partes de até 50 páginas cada. Sugestão de divisão:
- Parte 1: páginas 1-50 (já recebida, cobre AC → MG-T)
- Parte 2: páginas 51-100
- Parte 3: páginas 101-150 (se houver)

Conforme cada parte chegar, eu extraio o JSON e vou montando `cidadesIBGE.ts` incrementalmente.

## Detalhes técnicos

**Arquivos editados:**
- `src/hooks/useCidadesIBGE.ts` — reescrito para ler do dataset estático
- `src/components/ProfileForm.tsx` — remover aviso de offline
- `src/data/locationData.ts` — esvaziar `cities` das UFs brasileiras
- `src/data/cidadesIBGE.ts` — novo arquivo (gerado)

**Não tocados:** `useProfissionalData`, `OnboardingPage`, `CompletarPerfilPage`, fluxo de auth/admin (escopo desta tarefa é só a lista de cidades).

**Tamanho:** ~5.570 municípios brasileiros, ~150KB no bundle. É um custo aceitável e elimina latência + falhas de rede no formulário.

## O que você verá depois

- Dropdown de cidade abre instantaneamente assim que você seleciona o estado (sem "Carregando cidades...").
- Lista completa e idêntica à oficial do IBGE, mesmo offline.
- Sumiço do aviso "Lista parcial (sem conexão com o IBGE)".

Me reenvie o PDF a partir da página 51 e eu sigo com a implementação.

