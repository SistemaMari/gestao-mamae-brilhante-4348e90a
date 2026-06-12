# Exibir Pactuação MEV e Memória do Glicosímetro na ficha salva

## Problema

Em Fichas A/C salvas que caíram nas **Regras 2 ou 4**, o profissional respondeu no formulário:
- **Pactuação com a paciente** (Aceita reforçar MEV / Recusa — iniciar insulina)
- **Avaliação da memória do glicosímetro** (Confirma / Não confirma) — só na Regra 4

Esses dados **são salvos** corretamente em `decisoes_ficha_a.pactuacao_adesao` e `decisoes_ficha_a.memoria_glicosimetro`, mas **não são exibidos** no card read-only da ficha salva. Hoje só os 6 itens do checklist clínico aparecem.

## O que será feito

Adicionar, logo abaixo do `ChecklistRetorno2ReadOnly`, um pequeno bloco read-only que mostra as respostas de pactuação e memória **quando existirem** (campos opcionais, condicionais à regra).

### 1. Hidratar os campos no fetch

`src/pages/FichaPacientePage.tsx` (linha 344): adicionar `pactuacao_adesao, memoria_glicosimetro` ao `select` de `decisoes_ficha_a`, e propagar esses dois campos no mapeamento da consulta (mesmo padrão dos `checklist_*`).

### 2. Novo componente read-only

`src/components/ficha/DecisaoExtrasReadOnly.tsx` (novo) — recebe `{ pactuacao, memoria }` e:
- Retorna `null` se ambos forem `null` (fichas Regra 3 / Regra manter não mostram nada — sem bloco vazio).
- Renderiza no mesmo estilo lilás do `ChecklistRetorno2ReadOnly` (borda `#D6BCFA`, fundo `#FAFAFE`, título `#5B21B6`), título "Decisão clínica do Retorno 2", com 1-2 linhas:
  - "Avaliação da memória do glicosímetro: **Confirma** / **Não confirma**" (só se preenchido)
  - "Pactuação com a paciente: **Aceita reforçar MEV** / **Recusa — iniciar insulina**" (só se preenchido)

### 3. Renderizar na ficha

`src/pages/FichaPacientePage.tsx` (após linha 1517): inserir `<DecisaoExtrasReadOnly pactuacao={c.pactuacao_adesao} memoria={c.memoria_glicosimetro} />` dentro do mesmo bloco `<div className="mb-4">` (ou logo abaixo, com espaçamento equivalente para manter o respiro com o `FichaACResultCard`).

## Fora de escopo

- Nenhuma mudança em formulários, regras clínicas, edge functions ou no banco. Os dados já estão lá — é puramente apresentação na ficha salva.
- O bloco de **dose de insulina** (Regra 3 / Regra 4 confirma) já é exibido pelo `FichaACResultCard`; não duplicar.
