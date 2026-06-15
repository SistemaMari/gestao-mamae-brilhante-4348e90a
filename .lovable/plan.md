## Objetivo
Garantir que em todo o sistema o nome apareça apenas como **MARI**, sem o prefixo "Dra." — conforme regra já registrada na memória do projeto ("nome oficial é apenas MARI").

## Escopo confirmado
Apenas o título visível na UI e a documentação interna do laudo. Placeholders de cadastro, contas de teste/seed, emails `@dramari` e crédito de autoria humana ficam intocados.

## Alterações

### 1. UI — `src/components/FichaBDResultCard.tsx` (linha 54)
- **De:** `ENCERRAMENTO DA DRA. MARI — {veredito.titulo}`
- **Para:** `ENCERRAMENTO DA MARI — {veredito.titulo}`

Este é o título do cartão de encerramento (Cenário 7, controle inadequado) — exatamente o que aparece no screenshot enviado.

### 2. Documentação — `.lovable/memory/features/laudo-completo.md`
- Linha 13: `Título "Laudo Dra. Mari DMG Diagnóstica"` → `Título "Laudo MARI"`
- Linha 53: `Gerado por Dra. Mari DMG Diagnóstica — [data] …` → `Gerado por MARI — [data] …`

Alinha o doc com a regra já presente em `mem://index.md` (que diz "nome oficial é apenas MARI, sem DMG Diagnóstica ou Dra. Mari").

### 3. Memória core — `.lovable/memory/index.md` (linha 4)
A primeira linha do Core ainda diz `Dra. Mari DMG Diagnóstica — sistema de apoio diagnóstico para DMG.`. Atualizar para:
`MARI — sistema de apoio diagnóstico para DMG. Nome oficial é apenas "MARI" (sem "DMG Diagnóstica" ou "Dra. Mari").`
(remove a contradição interna do próprio index.)

## Fora de escopo (confirmado com o usuário)
- Placeholders de input (`"Dra. Maria Silva"`, `"Ex.: Dra. Marilza"`) — exemplos de nome de médica usuária.
- Seeds/fixtures de teste (`"Dra. Consultório Pro"`, emails `@teste.dramari`, chave `dramari_preview_pacientes_v6`, migração `seed_test_accounts`).
- Comentário de autoria em `prompt-v52.ts` (`Lucas/Dra. Marilsa`).
- Banco: `laudo_textos` e `textos_laudo` não contêm "Dra. Mari" (já verificado via psql).

## Verificação
- `grep -nE "DRA\\.?\\s*MARI|Dra\\.?\\s*Mari\\s+DMG" src supabase` deve retornar vazio após as alterações.
- Visual: reabrir a tela do Cenário 7 (controle inadequado) e confirmar o título sem "DRA.".
