-- ============================================================
-- MARI · Torna explícita, no LAUDO, a regra da repactuação única de MEV
-- ============================================================
-- Contexto: pelo protocolo (42F), o reforço de dieta e exercício é pactuado UMA
-- ÚNICA VEZ por gestação. Numa inadequação seguinte o sistema não reoferece o
-- reforço e indica insulina.
--
-- Na tela isso já é explicado, com a data da pactuação anterior. No laudo — que é
-- o que fica no prontuário e o que a gestante leva — não havia nada, e quem lesse
-- depois não teria como saber por que não houve nova pactuação.
--
-- A frase é acrescentada à JUSTIFICATIVA do desfecho `r2_insulina` (perfil
-- inadequado, falha de adesão, caminho que termina em insulina).
--
-- POR QUE UMA FRASE GENÉRICA, E NÃO "já repactuou em dd/mm":
-- `r2_insulina` cobre DOIS caminhos que o laudo não distingue hoje — a gestante
-- que RECUSOU repactuar e aquela que não pôde repactuar porque o teto já havia
-- sido usado. Um texto citando a pactuação anterior seria falso no primeiro caso.
-- A frase abaixo enuncia a regra, que é verdadeira nos dois. Separar os dois
-- casos exigiria um desfecho novo em `laudoMapping.ts` — possível, se as
-- especialistas quiserem textos distintos.
--
-- APPEND, NÃO SUBSTITUIÇÃO: as Dras editam esses textos em /admin/laudos. Este
-- SQL acrescenta ao que estiver publicado, preservando o que elas escreveram.
-- Idempotente: rodar de novo não duplica a frase.
--
-- ⚠️ Migrations de laudo_textos NÃO rodam no Publish do Lovable — rodar à mão.
-- ============================================================

UPDATE public.laudo_textos
SET texto = texto || ' O reforço de dieta e atividade física é pactuado uma única vez nesta gestação, conforme protocolo; não havendo nova pactuação, a inadequação atual do controle glicêmico indica a associação de INSULINA.',
    observacoes = coalesce(observacoes || ' ', '')
      || 'Frase da repactuação única acrescentada em 2026-08-27 (regra 42F).'
WHERE desfecho_clinico = 'r2_insulina'
  AND bloco = 'justificativa'
  AND status = 'publicado'
  AND tipo_consulta IN ('ficha_a', 'ficha_c')
  AND texto NOT LIKE '%uma única vez nesta gestação%';

-- ------------------------------------------------------------
-- CONFERÊNCIA (rode depois; esperado 2 linhas, uma por tipo de ficha)
-- ------------------------------------------------------------
-- SELECT tipo_consulta, bloco,
--        (texto LIKE '%uma única vez nesta gestação%') AS tem_a_frase,
--        right(texto, 180) AS final_do_texto
-- FROM public.laudo_textos
-- WHERE desfecho_clinico = 'r2_insulina'
--   AND bloco = 'justificativa'
--   AND status = 'publicado'
-- ORDER BY tipo_consulta;
