-- V4 · Indicadores ultrassonográficos alterados → insulina + encerra (Ficha A/C)
-- ---------------------------------------------------------------------------
-- O motor de decisão passa a emitir uma regra nova, `regra_fetal`, quando qualquer
-- indicador ultrassonográfico do checklist do Retorno 2 vem alterado — PFE-US ≥ P90
-- (item 4), CA ≥ P75 (item 5) ou LA anormal (item 6), gravados como 'nao'. Isso
-- indica insulinoterapia e encerra o acompanhamento, INDEPENDENTE do % de controle
-- glicêmico e da adesão (a partir de 28 semanas; antes disso os itens vêm 'sem_info').
--
-- Esta migration apenas RELAXA o CHECK da coluna `regra_aplicada` para aceitar o
-- valor novo. Nenhum dado existente é alterado.
--
-- ⚠️ Migrations NÃO rodam no Publish do Lovable — aplicar este SQL à mão no Supabase
--    (ou pelo chat do Lovable, que aplica migration de verdade).
-- ---------------------------------------------------------------------------

ALTER TABLE public.decisoes_ficha_a
  DROP CONSTRAINT IF EXISTS decisoes_ficha_a_regra_aplicada_check;

ALTER TABLE public.decisoes_ficha_a
  ADD CONSTRAINT decisoes_ficha_a_regra_aplicada_check
  CHECK (regra_aplicada IN ('regra_manter','regra_2','regra_3','regra_4','regra_fetal'));
