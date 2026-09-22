-- ============================================================
-- V4 · pactuação do PRÓXIMO perfil glicêmico no laudo da consulta atual.
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
--
-- Antes: a janela pós-prandial (1h/2h) e as datas do perfil só existiam na
-- tabela `perfis_glicemicos`, que só surge quando o perfil já foi preenchido.
-- Ou seja, quem saía do Retorno 1 recém-diagnosticada não podia levar o papel
-- impresso — perdia os 10 dias até o Retorno 2.
--
-- Agora: cada consulta pode PACTUAR o próximo perfil no fim do seu laudo. Essas
-- 4 colunas guardam essa pactuação. A ficha seguinte lê e pré-preenche (usuário
-- confirma ou edita).
--
-- Compatibilidade: colunas NULL por padrão — gestantes já em curso não têm
-- pactuação registrada; a ficha seguinte delas abre em branco (comportamento
-- antigo). Só vale a partir do próximo laudo emitido.
-- ============================================================

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS pactuou_janela_prox_perfil text NULL,
  ADD COLUMN IF NOT EXISTS pactuou_inicio_prox_perfil date NULL,
  ADD COLUMN IF NOT EXISTS pactuou_fim_prox_perfil    date NULL,
  ADD COLUMN IF NOT EXISTS pactuou_pontos_prox_perfil integer NULL;

-- CHECKs (nomeados p/ idempotência via DROP … IF EXISTS antes)
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

-- Regra "tudo ou nada": a pactuação só tem sentido se as 4 colunas estão
-- preenchidas juntas. Ou nenhuma, ou todas.
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
