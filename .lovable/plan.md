## Problema

A edge function `gerar-laudo` (System Prompt MARI v5.2, Gemini 2.5 Pro, Base de Conhecimento roteada por cenário) está pronta e treinada, mas **nenhum ponto do frontend a invoca**. Por isso:

- O botão "Confirmar peso e gerar laudo" (FichaACResultCard) só salva peso/dose e nunca chama a IA.
- Em `FichaPacientePage.tsx`, todos os `<LaudoCompleto>` recebem `bloco2={null}`, `bloco3={null}` e `statusIA="pendente"` hard-coded — daí os cards "Justificativa clínica" e "Conduta sugerida" mostrarem sempre "será gerada em breve".
- Laudos já persistidos na tabela `laudos` nunca são lidos de volta na ficha.

## Solução

Ligar o frontend à edge function e gerenciar estado IA por consulta.

### 1. Novo hook `useLaudoIA` (`src/hooks/useLaudoIA.ts`)

Centraliza estado e chamada da IA por `consulta_id`:

- Estado por consulta: `{ statusIA, bloco2, bloco3, erroIA, laudoId, gradeGlicemica?, proximaConsulta? }`.
- `carregarLaudoExistente(pacienteId)` — uma query `select` em `laudos` filtrando pelas `consulta_id` da paciente; popula estado a partir de `conteudo_laudo` (JSON com `bloco_2_justificativa` / `bloco_3_conduta`) sem custar token novo.
- `gerarLaudo(pacienteId, consultaId)` — define `statusIA='gerando'`, chama `supabase.functions.invoke('gerar-laudo', { body: { paciente_id, consulta_id } })`, trata respostas:
  - 200 → grava `bloco2`, `bloco3`, `statusIA='pronto'`.
  - 402 (quota/créditos) → `statusIA='erro'`, `erroIA.codigo=403` (redirect "Ver planos").
  - 429 / outros → `statusIA='erro'` com mensagem amigável + `onTentarNovamente`.
- `tentarNovamente(pacienteId, consultaId)` reusa `gerarLaudo`.

### 2. Disparo automático após cadastrar consulta

Em `FichaPacientePage.tsx`, após carregar `consultas` (real mode), para cada consulta cujo `cenario` exige Blocos 2/3 e que **ainda não tenha laudo**:

- `consulta_1`, `retorno_1`, `retorno_gtt`, `ficha_b/d`, `ficha_a/c adequado`, `registro_parto`: dispara `gerarLaudo` automaticamente uma vez.
- `ficha_a/c inadequado`: **só dispara após** `onWeightSaved` (peso + dose confirmados), porque o protocolo exige o peso para a conduta de insulina.

### 3. Wire-up do botão "Confirmar peso e gerar laudo"

`FichaACResultCard` continua salvando `peso_paciente_kg` + `dose_insulina_calculada`. Após sucesso, o callback `onWeightSaved` em `FichaPacientePage.tsx` agora também chama `gerarLaudo(paciente.id, c.id)`. O LaudoCompleto correspondente recebe `statusIA='gerando'` (shimmer já implementado em Bloco 2/3) e depois `'pronto'` com markdown.

### 4. Passagem de estado para `<LaudoCompleto>`

Em todos os pontos onde `LaudoCompleto` é renderizado no histórico (linhas 805-818 e 1061-1074), trocar os literais `bloco2={null} bloco3={null} statusIA="pendente"` por:

```
const estado = laudoIA.get(c.id) ?? { statusIA: 'pendente', bloco2: null, bloco3: null };
```

e propagar `bloco2`, `bloco3`, `statusIA`, `erroIA`, `onTentarNovamente`.

### 5. Modo preview (`/vitrine/...`)

A edge function depende de linhas reais em `pacientes`/`consultas`. Em `isPreview` não há essas linhas. Proposta:

- **Preview**: gerar Blocos 2 e 3 a partir de um pequeno **template determinístico por cenário** (texto curto rotulado "Exemplo demonstrativo — laudo real é gerado pela IA MARI") e setar `statusIA='pronto'` imediatamente. Não chama a IA, não consome quota.
- **Real**: chama a edge function de fato.

### 6. Atualização de memória técnica

Adicionar 1 linha em `mem://features/laudo-completo.md` registrando que o disparo da IA é responsabilidade de `useLaudoIA` no `FichaPacientePage`, e que cenários com insulina (Fichas A/C inadequado) só geram após confirmação do peso.

## Detalhes técnicos

- Tabela `laudos` já existe e a edge function persiste `conteudo_laudo` como JSON serializado contendo `bloco_2_justificativa` e `bloco_3_conduta` — o hook só faz `JSON.parse`.
- Quota: a edge function já chama `pode_gerar_laudo`. Quando retorna 402, mapeamos para `erroIA.codigo=403` (que `Bloco2Justificativa`/`Bloco3Conduta` já tratam exibindo botão "Ver planos").
- Realtime: `useRealtimeRefresh` já escuta a tabela `laudos`. Quando a edge function termina, o hook recarrega o registro e atualiza o card sem reload manual.
- Carimbo CFM continua sendo feito pela edge function (já implementado).

## Arquivos a alterar

- `src/hooks/useLaudoIA.ts` — novo
- `src/pages/FichaPacientePage.tsx` — wire-up de estado + auto-trigger + props do `LaudoCompleto` + callback do peso
- `src/components/FichaACResultCard.tsx` — sem mudança de UI; só garantir que `onWeightSaved` é chamado antes do retorno (já é)
- `.lovable/memory/features/laudo-completo.md` — 1 linha de nota

Nada na edge function precisa mudar.

## Fora do escopo

- Não mexer no visual da tela de login (assunto da mensagem anterior).
- Não alterar o System Prompt MARI nem os PDFs da Base de Conhecimento.
- Não tocar nos demais cards de Bloco 1 (Consulta1ResultCard, Retorno1ResultCard, etc.).