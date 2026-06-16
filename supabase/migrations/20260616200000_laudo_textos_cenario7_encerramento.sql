-- ============================================================================
-- Cenário 7 — Ficha B/D: controle inadequado com insulina (<70%) → encerrar MARI.
--
-- Antes esse cenário era "card-only" (só o card vermelho de encerramento, sem
-- laudo). Decisão revista (Suellen, 16/06): o card sozinho não explica o que
-- aconteceu nem o próximo passo. Agora o cenário tem laudo (Justificativa +
-- Conduta) explicando: a dose de insulina está insuficiente e precisa ser
-- REAJUSTADA; esse ajuste pode ser feito pelo próprio obstetra, em associação com
-- endocrinologista ou por referenciamento a serviço especializado; e as metas que
-- valem seguem sendo as OBSTÉTRICAS do DMG. A MARI encerra o suporte automatizado
-- (não calcula reajuste de dose), mas o acompanhamento do DMG continua.
--
-- Chave: (tipo_consulta ∈ {ficha_b, ficha_d}, desfecho_clinico='7'). Bloco 1
-- (card de encerramento) é gerado pelo sistema; aqui entram os blocos 2 e 3.
--
-- RASCUNHO: textos gerados pelo assistente, ainda SEM validação clínica — vão com
-- observacoes='RASCUNHO ...'. As especialistas refinam pelo editor (/admin/laudos).
-- Idempotente: ON CONFLICT no índice único parcial (status='publicado').
-- ============================================================================

INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
SELECT t.tipo, '7', v.bloco, v.ordem, v.titulo, v.texto, 'publicado', v.obs
FROM (VALUES ('ficha_b'),('ficha_d')) AS t(tipo)
CROSS JOIN (VALUES
  ('justificativa',2,'Justificativa Científica',
$t$A paciente [nome da paciente], em uso de insulina, realizou [dias preenchidos] dias de monitorização com perfil de 6 pontos, com [% na meta]% das medições dentro das metas. De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido a partir de 70% dos valores na meta. Mesmo em uso de insulina associada à dieta e à atividade física, o controle permaneceu inadequado — o que indica que a dose atual de insulina está insuficiente e precisa ser reajustada. O ajuste de dose está fora do escopo de orientação automatizada da MARI; por isso o suporte da MARI se encerra neste ponto. O acompanhamento do diabetes gestacional, no entanto, deve continuar.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (Ficha B/D, controle inadequado com insulina → encerrar MARI / reajuste de dose).$t$),
  ('conduta',3,'Conduta Orientativa',
$t$O próximo passo é o reajuste da dose de insulina (atual: [dose atual de insulina]), conforme os valores do perfil glicêmico. Esse ajuste pode ser conduzido de três formas, segundo a sua segurança e o contexto de atendimento: (1) pelo próprio obstetra, se houver segurança para titular a insulina; (2) em associação com endocrinologista; ou (3) por referenciamento a serviço especializado (especialmente no sistema público). Independentemente de quem conduza o ajuste, as metas que permanecem válidas são as metas obstétricas do DMG: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. Manter a monitorização diária de 6 pontos, a dieta e a atividade física, e reforçar a técnica de aplicação e o armazenamento da insulina.
Prazo de retorno: definir conforme o reajuste da dose e o serviço que assumir o acompanhamento.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (Ficha B/D, controle inadequado com insulina → encerrar MARI / reajuste de dose).$t$)
) AS v(bloco, ordem, titulo, texto, obs)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco, texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;
