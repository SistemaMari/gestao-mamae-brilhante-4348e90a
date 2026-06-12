## Objetivo

Permitir validação visual do `GttResultCard` no modo vitrine/preview, cobrindo os dois caminhos da nota de diagnóstico tardio (linha 93 do componente):

- **Cenário 6** — GTT alterado com IG 24-28 sem → tabela completa, card laranja "GTT ALTERADO", **sem** nota vermelha.
- **Cenário 6B** — GTT alterado com IG > 28 sem → tabela completa, card laranja, **com** nota vermelha "Diagnóstico tardio (IG > 28 semanas)".

## Escopo

Apenas dados de seed em `src/lib/previewPatients.ts`. Sem mudanças em componentes, regras clínicas, edge functions ou banco.

## Mudanças

### 1. `src/lib/previewPatients.ts` — adicionar 2 pacientes

Hoje os pacientes de preview registram GTT só como texto em `observacoes` (ex.: `c3-3`, `c6-3`). Nenhum popula os campos estruturados `gtt_jejum`/`gtt_1h`/`gtt_2h` + `cenario_clinico`, que são o que o `GttResultCard` consome.

Acrescentar dois novos pacientes ao final do array exportado (mantendo o padrão dos existentes — nome fictício, gestação, unidade vitrine):

**Paciente A — "Vitrine GTT Cenário 6"**
- 1 `consulta_1` (IG ~14 sem) com GJ normal no retorno seguinte.
- 1 `retorno` reportando GJ normal e janela de GTT.
- 1 consulta com:
  - `tipo: 'gtt'`
  - `ig_semanas: 26, ig_dias: 0`
  - `gtt_jejum: 82, gtt_1h: 192, gtt_2h: 140` (1h alterada → DMG confirmado, cenário 6)
  - `gtt_recurso_limitado: false`
  - `cenario_clinico: '6'`
  - `status_gerado: 'dmg_confirmado'`

**Paciente B — "Vitrine GTT Cenário 6B (tardio)"**
- Mesma estrutura inicial.
- Consulta GTT com:
  - `tipo: 'gtt'`
  - `ig_semanas: 30, ig_dias: 2`
  - `gtt_jejum: 96, gtt_1h: 170, gtt_2h: 145` (jejum alterado → DMG confirmado, cenário 6B)
  - `gtt_recurso_limitado: false`
  - `cenario_clinico: '6B'`
  - `status_gerado: 'dmg_confirmado'`

Ambos com `status_ficha` adequado para que a ficha apareça no histórico do paciente em `/vitrine` e `/preview-hub`.

## Como validar depois (manual, fora do plano)

1. Entrar no modo vitrine, abrir o paciente "Vitrine GTT Cenário 6": card mostra tabela 3 linhas, status "ALTERADO" na 1h, bloco laranja "GTT ALTERADO — DMG confirmado", **sem** bloco vermelho.
2. Abrir "Vitrine GTT Cenário 6B": mesmo card, e abaixo o bloco vermelho "Diagnóstico tardio (IG > 28 semanas) — início imediato do tratamento é crítico."

## Fora de escopo

- Não altera `GttResultCard.tsx`, `GttForm.tsx`, `laudoMapping.ts` nem migrations.
- Não toca em pacientes seed já existentes (mantém os cenários atuais intactos).
