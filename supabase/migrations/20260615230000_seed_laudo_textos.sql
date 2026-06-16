-- ============================================================================
-- Seed de laudo_textos — textos DEFINITIVOS das especialistas (por cenário/conduta).
-- Substitui os placeholders ("Texto pendente") pelos blocos 2 (Justificativa) e
-- 3 (Conduta). Bloco 1 (resultado) é gerado pelo sistema.
--
-- Chaves (tipo_consulta, desfecho_clinico):
--   • Diagnóstico: retorno_1/gtt + 'negativo'|'1'|'6'|'6B'|'8'.
--   • Ficha A/C (Retorno 2): chave por CONDUTA — r1_manter, r2_reforcar,
--     r2_insulina, r3_insulina, r4a_fichae, r4_reforcar, r4b_insulina
--     (emitidas por derivarDesfechoClinico/chaveCondutaFichaA). '2'/'3' ficam
--     como fallback (decisão não computada).
--   • Ficha B/D: '4' (controle adequado com insulina).
-- Cenários 5 (parto) e 7 (encerramento) NÃO entram aqui — são cards próprios.
--
-- Idempotente: ON CONFLICT no índice único parcial (status='publicado').
-- Os 2 textos sem validação clínica (r2_insulina, r4_reforcar) vão com
-- observacoes='RASCUNHO ...' — o texto visível fica limpo; as especialistas
-- editam pelo admin.
-- ============================================================================

-- ── 1) DIAGNÓSTICO — Retorno 1 (glicemia de jejum) ──────────────────────────
INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status) VALUES
('retorno_1','negativo','justificativa',2,'Justificativa Científica',
$t$A paciente [nome da paciente] apresenta glicemia de jejum de [glicemia de jejum] mg/dL, abaixo do ponto de corte de 92 mg/dL. Esta paciente NÃO TEM diabete mellitus gestacional neste momento.$t$,'publicado'),
('retorno_1','negativo','conduta',3,'Conduta Orientativa',
$t$Como o rastreamento inicial foi normal, a paciente deve realizar o teste de tolerância à glicose (GTT 75g) entre a 24ª e a 28ª semana. Seu GTT 75g deverá ser feito entre [janela GTT início] e [janela GTT fim]. Mantenha o pré-natal habitual até a realização e análise do resultado do GTT.
Prazo de retorno: Sem retorno de controle — a paciente retorna para o GTT 75g na janela de 24 a 28 semanas.$t$,'publicado'),
('retorno_1','1','justificativa',2,'Justificativa Científica',
$t$A paciente [nome da paciente], com [IG], apresenta glicemia de jejum de [glicemia de jejum] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, valores iguais ou superiores a 92 mg/dL e menores que 126 mg/dL, em qualquer idade gestacional, confirmam o diagnóstico de DMG. CONCLUSÃO: ESTA PACIENTE TEM DIABETE GESTACIONAL (DMG). Não há necessidade de outros exames para confirmar DMG.$t$,'publicado'),
('retorno_1','1','conduta',3,'Conduta Orientativa',
$t$O tratamento deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. O controle adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado'),
('retorno_1','8','justificativa',2,'Justificativa Científica',
$t$A paciente [nome da paciente] apresenta glicemia de jejum de [glicemia de jejum] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, valores iguais ou superiores a 126 mg/dL confirmam o diabete diagnosticado pela primeira vez na gestação (Overt DM). CONCLUSÃO: Esta paciente TEM diabete diagnosticado na gestação (Overt DM). Não há necessidade de outros exames para confirmar Overt DM.$t$,'publicado'),
('retorno_1','8','conduta',3,'Conduta Orientativa',
$t$O tratamento deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. O controle adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado')
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco, texto = EXCLUDED.texto;

-- ── 2) DIAGNÓSTICO — GTT 75g ────────────────────────────────────────────────
INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status) VALUES
('gtt','negativo','justificativa',2,'Justificativa Científica',
$t$No teste de tolerância à glicose realizado com [IG no GTT], a paciente [nome da paciente] apresentou jejum de [GTT jejum] mg/dL, 1 hora de [GTT 1h] mg/dL e 2 horas de [GTT 2h] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, esses valores estão abaixo dos respectivos pontos de corte e afastam o diagnóstico de DMG. CONCLUSÃO: Esta paciente NÃO TEM diabete mellitus gestacional.$t$,'publicado'),
('gtt','negativo','conduta',3,'Conduta Orientativa',
$t$Não há indicação de tratamento para controle da hiperglicemia. O GTT 75g normal a partir de 24 semanas de gestação afasta o risco de DMG. Essa paciente não precisa ser investigada novamente para DMG nesta gestação e NÃO DEVE SER TRATADA. O GTT 75g não deve ser repetido nesta gestação. ENCERRADA A INVESTIGAÇÃO DO DIABETE GESTACIONAL.
Prazo de retorno: Sem retorno para controle da hiperglicemia — apenas pré-natal habitual (mensal até 32 sem; a cada 15 dias até 36 sem; semanal até o parto).$t$,'publicado'),
('gtt','6','justificativa',2,'Justificativa Científica',
$t$No teste de tolerância à glicose realizado com [IG no GTT], a paciente [nome da paciente] apresentou glicemia de jejum de [GTT jejum] mg/dL, de 1 hora de [GTT 1h] mg/dL e de 2 horas de [GTT 2h] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, apenas um valor alterado no GTT 75g confirma o diagnóstico de DMG. CONCLUSÃO: Esta paciente TEM diabete mellitus gestacional. Não repita nenhum outro exame para diagnóstico do DMG: o diagnóstico já está confirmado.$t$,'publicado'),
('gtt','6','conduta',3,'Conduta Orientativa',
$t$O tratamento do DMG deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física orientada e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. Avaliação ultrassonográfica do crescimento fetal e do líquido amniótico. O controle glicêmico materno adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado'),
('gtt','6B','nota_tardio',1,'Diagnóstico tardio',
$t$Diagnóstico de DMG realizado tardiamente (idade gestacional superior a 28 semanas no momento do GTT). O início imediato do tratamento é crítico: o tempo de exposição à hiperglicemia já foi maior, elevando o risco de desfechos maternos e fetais adversos. Não há margem para adiar. Iniciar o tratamento agora.$t$,'publicado'),
('gtt','6B','justificativa',2,'Justificativa Científica',
$t$No teste de tolerância à glicose realizado com [IG no GTT], a paciente [nome da paciente] apresentou glicemia de jejum de [GTT jejum] mg/dL, de 1 hora de [GTT 1h] mg/dL e de 2 horas de [GTT 2h] mg/dL. De acordo com o protocolo diagnóstico do DMG no Brasil, apenas um valor alterado no GTT 75g confirma o diagnóstico de DMG. CONCLUSÃO: Esta paciente TEM diabete mellitus gestacional. Não repita nenhum outro exame para diagnóstico do DMG: o diagnóstico já está confirmado.$t$,'publicado'),
('gtt','6B','conduta',3,'Conduta Orientativa',
$t$O tratamento do DMG deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física orientada e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. Avaliação ultrassonográfica do crescimento fetal e do líquido amniótico. O controle glicêmico materno adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado'),
('gtt','8','justificativa',2,'Justificativa Científica',
$t$No GTT 75g realizado com [IG no GTT], a paciente [nome da paciente] apresentou glicemia de jejum de [GTT jejum] mg/dL, de 1 hora de [GTT 1h] mg/dL e de 2 horas de [GTT 2h] mg/dL, confirmando Overt DM. Esta paciente TEM Overt DM.$t$,'publicado'),
('gtt','8','conduta',3,'Conduta Orientativa',
$t$O tratamento deve ser iniciado imediatamente, com adequação nutricional individualizada, atividade física e monitorização diária da glicemia capilar, avaliando 4 pontos — jejum, pós-café da manhã, pós-almoço e pós-jantar. As metas do controle glicêmico são: jejum abaixo de 95 mg/dL e pós-prandial de 1 hora menor que 140 mg/dL e/ou de 2 horas menor que 120 mg/dL. O controle adequado reduz desfechos maternos e fetais adversos. O próximo retorno deve acontecer no dia [data do próximo retorno]. O diagnóstico oportuno e correto salva vidas. NÃO espere. NÃO repita o teste! TRATE!
Prazo de retorno: 7 a 10 dias.$t$,'publicado')
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco, texto = EXCLUDED.texto;

-- ── 3) RETORNO 2 — Ficha A/C (por conduta; cada texto vale p/ ficha_a e ficha_c)
--      Inclui '2'/'3' como fallback (decisão não computada → R1/R3).
INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
SELECT t.tipo, v.desfecho, v.bloco, v.ordem, v.titulo, v.texto, 'publicado', v.obs
FROM (VALUES ('ficha_a'),('ficha_c')) AS t(tipo)
CROSS JOIN (VALUES
  -- R1 — manter (e fallback cenário '2')
  ('r1_manter','justificativa',2,'Justificativa Científica',
$t$Nos [dias preenchidos] dias de monitorização, [% na meta]% das medições estiveram dentro das metas. De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido a partir de 70% dos valores na meta. Além disso, os indicadores metabólicos (e os indicadores ultrassonográficos, quando possível) também estão adequados, atestando que a terapêutica com dieta e exercício está sendo suficiente para o controle glicêmico e, portanto, deve ser mantida.$t$, NULL::text),
  ('r1_manter','conduta',3,'Conduta Orientativa',
$t$Manter a dieta, a atividade física e a monitorização diária de 4 pontos, sem necessidade de insulina neste momento. Reforçar a adesão ao plano alimentar e à atividade física. Solicitar ultrassom para controle do crescimento e desenvolvimento fetal e do volume de líquido amniótico. O próximo retorno deve acontecer no dia [data do próximo retorno].
Prazo de retorno: 15 dias até 30 semanas; a partir daí, 7 dias até o parto.$t$, NULL::text),
  ('2','justificativa',2,'Justificativa Científica',
$t$Nos [dias preenchidos] dias de monitorização, [% na meta]% das medições estiveram dentro das metas. De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido a partir de 70% dos valores na meta. Além disso, os indicadores metabólicos (e os indicadores ultrassonográficos, quando possível) também estão adequados, atestando que a terapêutica com dieta e exercício está sendo suficiente para o controle glicêmico e, portanto, deve ser mantida.$t$, NULL::text),
  ('2','conduta',3,'Conduta Orientativa',
$t$Manter a dieta, a atividade física e a monitorização diária de 4 pontos, sem necessidade de insulina neste momento. Reforçar a adesão ao plano alimentar e à atividade física. Solicitar ultrassom para controle do crescimento e desenvolvimento fetal e do volume de líquido amniótico. O próximo retorno deve acontecer no dia [data do próximo retorno].
Prazo de retorno: 15 dias até 30 semanas; a partir daí, 7 dias até o parto.$t$, NULL::text),
  -- R2 — reforçar (aceita)
  ('r2_reforcar','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle inadequado é definido por menos de 70% dos valores dentro da meta. Apenas [% na meta]% das glicemias estiveram dentro da meta, abaixo do mínimo de 70% preconizado. Além disso, há dieta inadequada, exercício irregular e ganho de peso materno excessivo. (Quando possível, a partir de 28 semanas, associar indicadores ultrassonográficos — PFE/US, CA e LA normais, sem comprometimento fetal e/ou do líquido amniótico.) Neste caso, há chance de que a adesão integral ao tratamento recomendado — dieta + exercício — ainda possa atingir as metas glicêmicas estabelecidas.$t$, NULL::text),
  ('r2_reforcar','conduta',3,'Conduta Orientativa',
$t$Reforçar a importância da pactuação com a gestante para adesão à dieta prescrita e à prática regular de exercício, pactuando com a gestante a adesão integral. Manter dieta + exercício, com avaliação em intervalo mais curto. O próximo retorno deve ocorrer no dia [data do próximo retorno].
Prazo de retorno: 7 a 10 dias (avaliar a adesão à dieta + exercício).$t$, NULL::text),
  -- R2 — recusa → insulina (RASCUNHO do assistente)
  ('r2_insulina','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle inadequado é definido por menos de 70% dos valores dentro da meta. Apenas [% na meta]% das glicemias estiveram dentro da meta, abaixo do mínimo de 70% preconizado, com dieta inadequada, exercício irregular e/ou ganho de peso materno excessivo. Diante da inadequação do controle, da não-adesão e da ausência de pactuação para o reforço integral da dieta e do exercício, está indicada a associação de INSULINA.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (caminho R2 + recusa → insulina).$t$),
  ('r2_insulina','conduta',3,'Conduta Orientativa',
$t$Iniciar insulina na dose de [dose total de insulina], por via subcutânea: ⅔ pela manhã ([dose manhã]) e ⅓ às 22 horas / bed time ([dose noite]). Orientar técnica de aplicação, cuidados no armazenamento e transporte da insulina e sinais de hipoglicemia. Prescrever controle glicêmico diário de 6 pontos — jejum, pós-café da manhã, pré e pós-almoço e pré e pós-jantar. O próximo retorno deve ocorrer no dia [data do próximo retorno].
Prazo de retorno: 7 a 10 dias.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (caminho R2 + recusa → insulina).$t$),
  -- R3 — insulina (e fallback cenário '3')
  ('r3_insulina','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle inadequado é definido por menos de 70% dos valores dentro da meta. Apenas [% na meta]% das glicemias estiveram dentro da meta, abaixo do mínimo de 70% preconizado. Os demais indicadores metabólicos (e indicadores ultrassonográficos, quando possível) não estão alterados. Isso indica que a terapêutica com dieta e exercício está insuficiente para o controle da hiperglicemia e, portanto, há necessidade de associar INSULINA.$t$, NULL::text),
  ('r3_insulina','conduta',3,'Conduta Orientativa',
$t$Reforçar a importância da adesão à dieta prescrita e à prática regular de exercício. Iniciar insulina na dose de [dose total de insulina], por via subcutânea: ⅔ pela manhã ([dose manhã]) e ⅓ às 22 horas / bed time ([dose noite]). Orientar técnica de aplicação, cuidados no armazenamento e transporte da insulina e sinais de hipoglicemia. Prescrever controle glicêmico diário de 6 pontos — jejum, pós-café da manhã, pré e pós-almoço e pré e pós-jantar. O próximo retorno deve ocorrer no dia [data do próximo retorno].
Prazo de retorno: 7 a 10 dias (avaliar os efeitos da insulina introduzida).$t$, NULL::text),
  ('3','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle inadequado é definido por menos de 70% dos valores dentro da meta. Apenas [% na meta]% das glicemias estiveram dentro da meta, abaixo do mínimo de 70% preconizado. Os demais indicadores metabólicos (e indicadores ultrassonográficos, quando possível) não estão alterados. Isso indica que a terapêutica com dieta e exercício está insuficiente para o controle da hiperglicemia e, portanto, há necessidade de associar INSULINA.$t$, NULL::text),
  ('3','conduta',3,'Conduta Orientativa',
$t$Reforçar a importância da adesão à dieta prescrita e à prática regular de exercício. Iniciar insulina na dose de [dose total de insulina], por via subcutânea: ⅔ pela manhã ([dose manhã]) e ⅓ às 22 horas / bed time ([dose noite]). Orientar técnica de aplicação, cuidados no armazenamento e transporte da insulina e sinais de hipoglicemia. Prescrever controle glicêmico diário de 6 pontos — jejum, pós-café da manhã, pré e pós-almoço e pré e pós-jantar. O próximo retorno deve ocorrer no dia [data do próximo retorno].
Prazo de retorno: 7 a 10 dias (avaliar os efeitos da insulina introduzida).$t$, NULL::text),
  -- R4a — Ficha E (memória confirma)
  ('r4a_fichae','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido por pelo menos 70% dos valores dentro da meta. Neste caso, [% na meta]% das glicemias estiveram dentro da meta, igual ou superior ao mínimo de 70% preconizado. Entretanto, há dieta inadequada e/ou exercício irregular e/ou ganho de peso materno excessivo. Deve-se avaliar a memória do glicosímetro: ela CONFIRMA o controle glicêmico adequado — ou seja, apesar do controle adequado, a gestante não está fazendo adesão integral ao tratamento, com possíveis picos de hiperglicemia não detectados nos 4 pontos avaliados, o que representa risco para o feto.$t$, NULL::text),
  ('r4a_fichae','conduta',3,'Conduta Orientativa',
$t$Recomendar perfil glicêmico diário de 6 pontos, reforçar e pactuar dieta + exercício e reavaliar com retorno mais breve.
OBSERVAÇÃO —
Se confirmar PG de 6 pontos adequado avaliar as características fetais de crescimento fetal.
> Se adequado manter com dieta e AF e continuar monitorando a cad 7-10 dias;
> No momento que que mostrar que o PG está inadequado entrar com insulina na dose inicial padronizada.
> Se o feto estiver com crescimento exagerado iniciar insulinoterapia VS continuar monitorando pois o PG deve se alterar em breve
Prazo de retorno: 7 a 10 dias (avaliar adesão e possíveis picos de hiperglicemia).$t$, NULL::text),
  -- R4 — memória não confirma + aceita → mantém 4 pontos (RASCUNHO do assistente)
  ('r4_reforcar','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido por pelo menos 70% dos valores dentro da meta. Neste caso, [% na meta]% das glicemias estiveram dentro da meta, igual ou superior ao mínimo de 70%. Entretanto, há dieta inadequada e/ou exercício irregular e/ou ganho de peso materno excessivo, e a memória do glicosímetro NÃO CONFIRMA o controle relatado. A gestante pactuou reforçar a adesão integral à dieta e à atividade física; optou-se por reforçar e reavaliar em intervalo curto, mantendo o perfil de 4 pontos, antes de associar insulina.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (caminho R4 + memória não confirma + aceita → mantém 4 pontos).$t$),
  ('r4_reforcar','conduta',3,'Conduta Orientativa',
$t$Reforçar e pactuar a adesão integral à dieta e à atividade física. Manter o perfil glicêmico diário de 4 pontos e reavaliar em retorno mais breve. Se, na reavaliação, o controle se confirmar inadequado ou houver crescimento fetal exagerado, associar insulina na dose inicial padronizada (0,5 UI/kg/dia). O próximo retorno deve ocorrer no dia [data do próximo retorno].
Prazo de retorno: 7 a 10 dias.$t$,
$t$RASCUNHO gerado pelo assistente — validar com as especialistas (caminho R4 + memória não confirma + aceita → mantém 4 pontos).$t$),
  -- R4b — memória não confirma + recusa → insulina
  ('r4b_insulina','justificativa',2,'Justificativa Científica',
$t$De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido por pelo menos 70% dos valores dentro da meta. Neste caso, [% na meta]% das glicemias estiveram dentro da meta, igual ou superior ao mínimo de 70% preconizado. A memória do glicosímetro NÃO CONFIRMA o controle glicêmico adequado: os valores reais das glicemias indicam risco para o feto, pois a gestante não faz adesão integral ao tratamento e apresenta picos de hiperglicemia no perfil glicêmico.$t$, NULL::text),
  ('r4b_insulina','conduta',3,'Conduta Orientativa',
$t$Reforçar a importância da adesão à dieta prescrita e à prática regular de exercício. Iniciar insulina na dose de [dose total de insulina], por via subcutânea: ⅔ pela manhã ([dose manhã]) e ⅓ às 22 horas / bed time ([dose noite]). Orientar técnica de aplicação, cuidados no armazenamento e transporte da insulina e sinais de hipoglicemia. Prescrever controle glicêmico diário de 6 pontos — jejum, pós-café da manhã, pré e pós-almoço e pré e pós-jantar.
OBSERVAÇÃO —
Se confirmar PG de 6 pontos adequado avaliar as características fetais de crescimento fetal.
> Se adequado manter com dieta e AF e continuar monitorando a cad 7-10 dias;
> No momento que que mostrar que o PG está inadequado entrar com insulina na dose inicial padronizada.
> Se o feto estiver com crescimento exagerado iniciar insulinoterapia VS continuar monitorando pois o PG deve se alterar em breve
Prazo de retorno: 7 a 10 dias (avaliar adesão e efeitos da insulina associada).$t$, NULL::text)
) AS v(desfecho, bloco, ordem, titulo, texto, obs)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco, texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;

-- ── 4) Acompanhamento com insulina — Ficha B/D, cenário '4' (ficha_b e ficha_d)
INSERT INTO public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status)
SELECT t.tipo, '4', v.bloco, v.ordem, v.titulo, v.texto, 'publicado'
FROM (VALUES ('ficha_b'),('ficha_d')) AS t(tipo)
CROSS JOIN (VALUES
  ('justificativa',2,'Justificativa Científica',
$t$Nos [dias preenchidos] dias de monitorização com perfil de 6 pontos, [% na meta]% das medições estiveram dentro das metas. De acordo com o protocolo de tratamento do DMG no Brasil, o controle adequado é definido a partir de 70% dos valores na meta. Com a paciente em uso de insulina associada à dieta e à atividade física, e com os indicadores metabólicos (e indicadores ultrassonográficos, quando possível) adequados, confirma-se que o esquema terapêutico atual está sendo suficiente para o controle glicêmico e deve ser mantido neste momento.$t$),
  ('conduta',3,'Conduta Orientativa',
$t$Manter a dose atual de insulina ([dose atual de insulina]), a dieta, a atividade física e a monitorização diária de 6 pontos — jejum, pós-café da manhã, pré e pós-almoço e pré e pós-jantar. Reforçar a adesão ao plano alimentar, à atividade física e à técnica de aplicação e armazenamento da insulina. Solicitar ultrassom para controle do crescimento fetal e do volume de líquido amniótico. O próximo retorno deve acontecer no dia [data do próximo retorno].
Prazo de retorno: 15 dias até 30 semanas; a partir daí, 7 dias até o parto.$t$)
) AS v(bloco, ordem, titulo, texto)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco, texto = EXCLUDED.texto;
