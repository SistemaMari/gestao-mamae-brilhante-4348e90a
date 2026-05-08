# Rename do sistema: "MARI DMG Diagnóstica" → "MARI"

## O que já foi alterado (via sed durante investigação)

Substituições aplicadas em todos os arquivos com ocorrências:

- `Dra. Mari DMG Diagnóstica` → `MARI`
- `Mari DMG Diagnóstica` → `MARI`
- `MARI DMG Diagnóstica` → `MARI`
- `MARI DMG Diagnostics` → `MARI` (en-US)
- `MARI Diagnóstica` → `MARI`
- `MARI DMG` → `MARI`
- `Mari DMG` → `MARI`

**Arquivos afetados:**
- `src/i18n/locales/pt-BR.json`, `es.json`, `en-US.json` (`appName`, `welcome`)
- `src/components/PreviewAppShell.tsx`, `AppShellClinico.tsx`
- `src/components/admin/AdminHeader.tsx`
- `src/components/laudo/LaudoCabecalho.tsx`, `LaudoCompleto.tsx`
- `src/components/EncerramentoPartoCard.tsx`
- `src/pages/GestaoEquipePage.tsx` (modal de convite — texto e mensagens de erro)
- `src/pages/DashboardMetricasPage.tsx` (rodapé PDF)
- `src/pages/ConsolidarPage.tsx`
- `src/lib/laudoPdf.ts` (rodapé do laudo PDF)
- `src/styles/print.css` (comentário)
- `supabase/functions/exportar-relatorio-admin/index.ts`
- `supabase/functions/consolidar-relatorios/index.ts` (system prompt LLM + cabeçalho/rodapé PDF)
- `supabase/functions/gerar-relatorios-mensais/index.ts` (cabeçalho PDF)

**Pendência detectada:** o sed quebrou uma linha em `GestaoEquipePage.tsx` (texto "MARI\nDiagnóstica" virou "MARI\nas administrador"). Já corrigi via Python.

## O que NÃO foi alterado (intencional)

- `index.html` meta description: já era só "MARI's Health Companion" (não continha "DMG Diagnóstica").
- Placeholders de nome de pessoa: `Dra. Marilza`, `Dra. Maria Silva` em modais de cadastro — são exemplos de nome fictício, não marca.
- Comentário interno em `prompt-v52.ts` referenciando arquivo fonte original `PROMPT_SISTEMA_MARI_v5.2.docx` (Lucas/Dra. Marilsa) — é metadado de versionamento, não texto exibido.
- Memória do projeto (`mem://index.md`) — bloqueada em plan mode; precisa ser atualizada após aprovação para refletir "MARI" como nome oficial.

## O que falta (depende de aprovação para sair de plan mode)

1. Atualizar `mem://index.md` Core: trocar "Dra. Mari DMG Diagnóstica" por "MARI — nome oficial é apenas MARI".
2. Confirmar que nenhum edge function/email template precisa de redeploy (os .ts já foram alterados; o deploy é automático).

## Validação sugerida

Após aprovar, rodar:
- `rg -n "Mari DMG|MARI DMG|MARI Diagnóstica|Dra\. Mari DMG" src/ supabase/ index.html` deve retornar vazio.
- Login como `gestor.demo@mari.health` e abrir o modal "Convidar profissional" em `/gestao/equipe` para conferir o card do print.
- Visualizar um laudo (cabeçalho + rodapé) e o painel admin (header).

Aprove para eu sair de plan mode e atualizar a memória.
