UPDATE public.laudo_textos
SET texto = texto || ' O reforço de dieta e atividade física é pactuado uma única vez nesta gestação, conforme protocolo; não havendo nova pactuação, a inadequação atual do controle glicêmico indica a associação de INSULINA.',
    observacoes = coalesce(observacoes || ' ', '') || 'Frase da repactuação única acrescentada em 2026-08-27 (regra 42F).'
WHERE desfecho_clinico = 'r2_insulina' AND bloco = 'justificativa' AND status = 'publicado'
  AND tipo_consulta IN ('ficha_a','ficha_c') AND idioma = 'pt-BR'
  AND texto NOT LIKE '%uma única vez nesta gestação%';

UPDATE public.laudo_textos
SET texto = texto || ' Dietary and physical activity reinforcement is agreed upon only once during this pregnancy, according to the protocol; with no new agreement, the current inadequate glycemic control indicates the addition of INSULIN.',
    observacoes = coalesce(observacoes || ' ', '') || 'Frase da repactuação única acrescentada em 2026-08-27 (regra 42F).'
WHERE desfecho_clinico = 'r2_insulina' AND bloco = 'justificativa' AND status = 'publicado'
  AND tipo_consulta IN ('ficha_a','ficha_c') AND idioma = 'en-US'
  AND texto NOT LIKE '%only once during this pregnancy%';

UPDATE public.laudo_textos
SET texto = texto || ' El refuerzo de dieta y actividad física se pacta una única vez en este embarazo, conforme al protocolo; al no haber una nueva pactación, la inadecuación actual del control glucémico indica la asociación de INSULINA.',
    observacoes = coalesce(observacoes || ' ', '') || 'Frase da repactuação única acrescentada em 2026-08-27 (regra 42F).'
WHERE desfecho_clinico = 'r2_insulina' AND bloco = 'justificativa' AND status = 'publicado'
  AND tipo_consulta IN ('ficha_a','ficha_c') AND idioma = 'es'
  AND texto NOT LIKE '%una única vez en este embarazo%';