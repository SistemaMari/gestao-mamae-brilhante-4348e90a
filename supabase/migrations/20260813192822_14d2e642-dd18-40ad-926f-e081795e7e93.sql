ALTER TABLE public.decisoes_ficha_a
  DROP CONSTRAINT IF EXISTS decisoes_ficha_a_regra_aplicada_check;

ALTER TABLE public.decisoes_ficha_a
  ADD CONSTRAINT decisoes_ficha_a_regra_aplicada_check
  CHECK (regra_aplicada IN ('regra_manter','regra_2','regra_3','regra_4','regra_fetal'));