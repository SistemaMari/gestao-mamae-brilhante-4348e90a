ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS pactuou_janela_prox_perfil text NULL,
  ADD COLUMN IF NOT EXISTS pactuou_inicio_prox_perfil date NULL,
  ADD COLUMN IF NOT EXISTS pactuou_fim_prox_perfil    date NULL,
  ADD COLUMN IF NOT EXISTS pactuou_pontos_prox_perfil integer NULL;

ALTER TABLE public.consultas
  DROP CONSTRAINT IF EXISTS consultas_pactuou_janela_prox_perfil_check;
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_pactuou_janela_prox_perfil_check
  CHECK (pactuou_janela_prox_perfil IS NULL OR pactuou_janela_prox_perfil IN ('1h','2h'));

ALTER TABLE public.consultas
  DROP CONSTRAINT IF EXISTS consultas_pactuou_pontos_prox_perfil_check;
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_pactuou_pontos_prox_perfil_check
  CHECK (pactuou_pontos_prox_perfil IS NULL OR pactuou_pontos_prox_perfil IN (4,6));

ALTER TABLE public.consultas
  DROP CONSTRAINT IF EXISTS consultas_pactuou_prox_perfil_atomica_check;
ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_pactuou_prox_perfil_atomica_check
  CHECK (
    (pactuou_janela_prox_perfil IS NULL
     AND pactuou_inicio_prox_perfil IS NULL
     AND pactuou_fim_prox_perfil IS NULL
     AND pactuou_pontos_prox_perfil IS NULL)
    OR
    (pactuou_janela_prox_perfil IS NOT NULL
     AND pactuou_inicio_prox_perfil IS NOT NULL
     AND pactuou_fim_prox_perfil IS NOT NULL
     AND pactuou_pontos_prox_perfil IS NOT NULL
     AND pactuou_inicio_prox_perfil <= pactuou_fim_prox_perfil)
  );

COMMENT ON COLUMN public.consultas.pactuou_janela_prox_perfil IS 'Janela pós-prandial (1h ou 2h) pactuada nesta consulta para o PRÓXIMO perfil. Pré-preenche a ficha seguinte.';
COMMENT ON COLUMN public.consultas.pactuou_inicio_prox_perfil IS 'Data de início do PRÓXIMO perfil, pactuada nesta consulta. Pré-preenche a ficha seguinte.';
COMMENT ON COLUMN public.consultas.pactuou_fim_prox_perfil    IS 'Data de encerramento do PRÓXIMO perfil, pactuada nesta consulta. Pré-preenche a ficha seguinte.';
COMMENT ON COLUMN public.consultas.pactuou_pontos_prox_perfil IS 'Nº de pontos (4 ou 6) do PRÓXIMO perfil. 4 = Ficha A/C; 6 = Ficha E (Regra 4 memória confirma) ou continuação de Ficha E.';