-- ============================================================================
-- 34D-C — Rede de segurança para Retorno 1 com DMG confirmado.
-- Um Retorno 1 com DMG mas SEM cenário gravado caía no fallback de mapearCenario,
-- que devolvia '6' (DMG por GTT). O conserto no código (mapearCenario → '1')
-- resolve a raiz; este bloco cobre eventuais consultas que ainda emitam '6'.
-- Texto = idêntico ao (retorno_1, '1') — é o MESMO diagnóstico (DMG pela GJ).
-- Idempotente: insere só os blocos que ainda não existem publicados.
-- ============================================================================
INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status)
SELECT v.tipo_consulta, v.desfecho_clinico, v.bloco, v.ordem_bloco, v.titulo_bloco, v.texto, v.status
FROM (VALUES
  ('retorno_1','6','justificativa',2,'Justificativa Científica',
$t$A paciente [nome da paciente], com [IG], apresenta glicemia de jejum de [glicemia de jejum] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, valores iguais ou superiores a 92 mg/dL e menores que 126 mg/dL, em qualquer idade gestacional, confirmam o diagnóstico de DMG. CONCLUSÃO: ESTA PACIENTE TEM DIABETE GESTACIONAL (DMG). Não há necessidade de outros exames para confirmar DMG.$t$,'publicado'),
  ('retorno_1','6','conduta',3,'Conduta Orientativa',
$t$O tratamento deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. O controle adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado')
) AS v(tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.laudo_textos x
  WHERE x.tipo_consulta = v.tipo_consulta
    AND x.desfecho_clinico = v.desfecho_clinico
    AND x.bloco = v.bloco
    AND x.status = 'publicado'
);
