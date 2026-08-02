-- ============================================================================
-- Ficha E (perfil de 6 pontos SEM insulina) no laudo — Ajustes V4 (Vídeo 1, item 4).
--
-- Até aqui a Ficha E não tinha texto em laudo_textos nem era um cenário do editor
-- /admin/laudos → o laudo do retorno de 6 pontos sem insulina caía em
-- "Texto pendente — solicitar ao time clínico". Esta migration cria os textos
-- (Justificativa + Conduta) dos dois desfechos da Ficha E, nos 3 idiomas:
--   • e_manter   — controle adequado (≥70%): permanece 6 pontos sem insulina, 7 dias.
--   • e_insulina — controle inadequado (<70%): inicia insulina e ENCERRA a MARI
--                  (reaproveita a conduta ratificada de encerramento por insulinização).
--
-- 🚨 RODAR SÓ DEPOIS de publicar o código que deriva o desfecho da Ficha E
--    (laudoMapping.derivarDesfechoClinico → 'e_manter'/'e_insulina'). Se rodar
--    antes, não há prejuízo (o laudo segue como está); depois do código é que os
--    textos passam a aparecer.
--
-- status='publicado' (usável já; as Dras refinam pelo editor /admin/laudos).
-- Idempotente: ON CONFLICT no índice único parcial (tipo, desfecho, bloco, idioma
-- WHERE status='publicado').
-- ============================================================================

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, idioma, observacoes)
VALUES
-- ── pt-BR ───────────────────────────────────────────────────────────────────
('ficha_e','e_manter','justificativa',2,'Justificativa Científica',
$L$Ao longo dos [dias preenchidos] dias de monitorização no perfil ampliado de 6 pontos, [% na meta]% das medições ficaram dentro da meta. De acordo com o protocolo de tratamento do DMG no Brasil, considera-se controle adequado quando 70% ou mais dos valores estão na meta. A ampliação para o perfil de 6 pontos — ainda sem insulina — havia sido indicada para confirmar, com mais aferições ao longo do dia, o controle que os dados iniciais já sugeriam. O resultado confirma que a dieta e a atividade física seguem suficientes para o controle glicêmico e, portanto, devem ser mantidas, sem necessidade de insulina neste momento.$L$,
'publicado','pt-BR','Rascunho de IA (Ficha E no laudo) pendente de ratificação clínica — 2026-08-02'),

('ficha_e','e_manter','conduta',3,'Conduta Orientativa',
$L$Manter a dieta, a atividade física e a monitorização glicêmica diária em 6 pontos — jejum, pré e pós-prandiais —, sem necessidade de insulina neste momento. Reforçar a adesão ao plano alimentar e à atividade física. Solicitar avaliação ultrassonográfica do crescimento fetal e do líquido amniótico. Manter o perfil de 6 pontos até a próxima consulta — não há retorno ao perfil de 4 pontos. O próximo retorno deve acontecer no dia [data do próximo retorno].
Prazo de retorno: 7 dias.$L$,
'publicado','pt-BR','Rascunho de IA (Ficha E no laudo) pendente de ratificação clínica — 2026-08-02'),

('ficha_e','e_insulina','justificativa',2,'Justificativa Científica',
$L$Ao longo dos [dias preenchidos] dias de monitorização no perfil de 6 pontos (sem insulina), apenas [% na meta]% das medições ficaram dentro da meta, abaixo do mínimo de 70% recomendado. Mesmo com a ampliação da monitorização para 6 pontos e a manutenção da dieta e da atividade física, o controle glicêmico permaneceu inadequado. Esgotadas as medidas de estilo de vida, está indicada a introdução de INSULINA.$L$,
'publicado','pt-BR','Rascunho de IA (Ficha E no laudo) pendente de ratificação clínica — 2026-08-02'),

('ficha_e','e_insulina','conduta',3,'Conduta Orientativa',
$L$Iniciar insulinoterapia na dose de [dose total de insulina]:

>> 2/3 pela manhã: [dose manhã] e
>> 1/3 às 22h (bed time): [dose noite]

— Ambos por via subcutânea —

Orientar a técnica de aplicação, os cuidados no armazenamento e transporte da insulina e os sinais de hipoglicemia.

Manter a dieta, a atividade física e a monitorização glicêmica diária em 6 pontos — jejum, pré e pós-prandiais —, pactuando com a paciente a aferição pós-prandial de 1h ou de 2h.

A partir da introdução da insulina, o acompanhamento ativo da MARI se encerra.

A responsabilidade pela gestante permanece com o obstetra (GO), cujas metas glicêmicas obstétricas sempre prevalecem.

A continuidade do controle glicêmico pode seguir três arranjos, à escolha do obstetra:
(1) o próprio obstetra conduz o ajuste das doses, se houver confiança para isso;
(2) associação com endocrinologista, que faz os acertos das doses de insulina, sem assumir o caso; ou
(3) referência a serviço especializado, na rede pública.

Caso opte por associar ou referenciar o endocrinologista, a consulta deve ocorrer em 7 a 10 dias a partir da data de hoje.

Se não houver agenda do profissional nesse prazo, oriente a paciente a procurar outro endocrinologista com urgência. Um feto em regime hiperglicêmico não pode esperar.

ATENÇÃO: Reteste puerperal: realizar GTT 75g (jejum e 2h) entre 6 e 8 semanas após o parto, para reclassificação do estado glicêmico.$L$,
'publicado','pt-BR','Rascunho de IA (Ficha E no laudo) — conduta = encerramento por insulinização ratificado; pendente de ratificação clínica — 2026-08-02'),

-- ── en-US ───────────────────────────────────────────────────────────────────
('ficha_e','e_manter','justificativa',2,'Scientific Rationale',
$L$Over the [dias preenchidos] days of monitoring on the expanded 6-point profile, [% na meta]% of measurements were within target. According to the GDM treatment protocol in Brazil, adequate control is defined as 70% or more of values within target. Expanding to the 6-point profile — still without insulin — had been indicated to confirm, with more measurements throughout the day, the control that the initial data already suggested. The result confirms that diet and physical activity remain sufficient for glycemic control and should therefore be maintained, with no need for insulin at this time.$L$,
'publicado','en-US','AI draft (Form E in the report) pending clinical ratification — 2026-08-02'),

('ficha_e','e_manter','conduta',3,'Recommended Management',
$L$Maintain the diet, physical activity, and daily 6-point glycemic monitoring — fasting, pre- and postprandial —, with no need for insulin at this time. Reinforce adherence to the meal plan and physical activity. Request an ultrasound to monitor fetal growth and amniotic fluid. Keep the 6-point profile until the next visit — there is no return to the 4-point profile. The next follow-up should take place on [data do próximo retorno].
Follow-up interval: 7 days.$L$,
'publicado','en-US','AI draft (Form E in the report) pending clinical ratification — 2026-08-02'),

('ficha_e','e_insulina','justificativa',2,'Scientific Rationale',
$L$Over the [dias preenchidos] days of monitoring on the 6-point profile (no insulin), only [% na meta]% of measurements were within target, below the minimum of 70% recommended. Even after expanding monitoring to 6 points and maintaining diet and physical activity, glycemic control remained inadequate. With lifestyle measures exhausted, the introduction of INSULIN is indicated.$L$,
'publicado','en-US','AI draft (Form E in the report) pending clinical ratification — 2026-08-02'),

('ficha_e','e_insulina','conduta',3,'Recommended Management',
$L$Start insulin therapy at a dose of [dose total de insulina]:
>> 2/3 in the morning: [dose manhã] and
>> 1/3 at 10 p.m. (bed time): [dose noite]
— Both subcutaneously —
Instruct on injection technique, care in the storage and transport of insulin, and signs of hypoglycemia.
Maintain the diet, physical activity, and daily 6-point glycemic monitoring — fasting, pre- and postprandial —, agreeing with the patient on 1-hour or 2-hour postprandial measurement.
Once insulin is introduced, MARI's active follow-up is discontinued.
Responsibility for the pregnant patient remains with the obstetrician (OB), whose obstetric glycemic targets always prevail.
Continued glycemic control may follow three arrangements, at the obstetrician's choice:
(1) the obstetrician themselves manages the dose adjustment, if confident to do so;
(2) collaboration with an endocrinologist, who makes the insulin dose adjustments without taking over the case; or
(3) referral to a specialized service, in the public system.
ATTENTION: Postpartum retesting: perform a 75g OGTT (fasting and 2h) between 6 and 8 weeks after delivery, to reclassify the glycemic status.$L$,
'publicado','en-US','AI draft (Form E in the report) — management = ratified closure-by-insulinization; pending clinical ratification — 2026-08-02'),

-- ── es ──────────────────────────────────────────────────────────────────────
('ficha_e','e_manter','justificativa',2,'Justificación Científica',
$L$A lo largo de los [dias preenchidos] días de monitorización en el perfil ampliado de 6 puntos, el [% na meta]% de las mediciones estuvieron dentro de la meta. De acuerdo con el protocolo de tratamiento de la DMG en Brasil, se considera control adecuado cuando el 70% o más de los valores están en la meta. La ampliación al perfil de 6 puntos — aún sin insulina — se había indicado para confirmar, con más mediciones a lo largo del día, el control que los datos iniciales ya sugerían. El resultado confirma que la dieta y la actividad física siguen siendo suficientes para el control glucémico y, por lo tanto, deben mantenerse, sin necesidad de insulina en este momento.$L$,
'publicado','es','Borrador de IA (Ficha E en el informe) pendiente de ratificación clínica — 2026-08-02'),

('ficha_e','e_manter','conduta',3,'Conducta Orientativa',
$L$Mantener la dieta, la actividad física y la monitorización glucémica diaria en 6 puntos — en ayunas, pre y posprandiales —, sin necesidad de insulina en este momento. Reforzar la adherencia al plan alimentario y a la actividad física. Solicitar evaluación ecográfica del crecimiento fetal y del líquido amniótico. Mantener el perfil de 6 puntos hasta la próxima consulta — no hay retorno al perfil de 4 puntos. El próximo retorno debe ocurrir el día [data do próximo retorno].
Plazo de retorno: 7 días.$L$,
'publicado','es','Borrador de IA (Ficha E en el informe) pendiente de ratificación clínica — 2026-08-02'),

('ficha_e','e_insulina','justificativa',2,'Justificación Científica',
$L$A lo largo de los [dias preenchidos] días de monitorización en el perfil de 6 puntos (sin insulina), solo el [% na meta]% de las mediciones estuvieron dentro de la meta, por debajo del mínimo del 70% recomendado. Aun con la ampliación de la monitorización a 6 puntos y el mantenimiento de la dieta y la actividad física, el control glucémico siguió siendo inadecuado. Agotadas las medidas de estilo de vida, está indicada la introducción de INSULINA.$L$,
'publicado','es','Borrador de IA (Ficha E en el informe) pendiente de ratificación clínica — 2026-08-02'),

('ficha_e','e_insulina','conduta',3,'Conducta Orientativa',
$L$Iniciar insulinoterapia en la dosis de [dose total de insulina]:
>> 2/3 por la mañana: [dose manhã] y
>> 1/3 a las 22h (bed time): [dose noite]
— Ambos por vía subcutánea —
Orientar sobre la técnica de aplicación, los cuidados en el almacenamiento y transporte de la insulina y los signos de hipoglucemia.
Mantener la dieta, la actividad física y la monitorización glucémica diaria en 6 puntos — en ayunas, pre y posprandiales —, acordando con la paciente la medición posprandial de 1h o de 2h.
A partir de la introducción de la insulina, el seguimiento activo de la MARI se cierra.
La responsabilidad por la gestante permanece con el obstetra (GO), cuyas metas glucémicas obstétricas siempre prevalecen.
La continuidad del control glucémico puede seguir tres arreglos, a elección del obstetra:
(1) el propio obstetra conduce el ajuste de las dosis, si hay confianza para ello;
(2) asociación con endocrinólogo, que hace los ajustes de las dosis de insulina, sin asumir el caso; o
(3) referencia a un servicio especializado, en la red pública.
ATENCIÓN: Reevaluación puerperal: realizar PTOG 75g (en ayunas y 2h) entre 6 y 8 semanas después del parto, para reclasificación del estado glucémico.$L$,
'publicado','es','Borrador de IA (Ficha E en el informe) — conducta = cierre por insulinización ratificado; pendiente de ratificación clínica — 2026-08-02')

ON CONFLICT (tipo_consulta, desfecho_clinico, bloco, idioma) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco,
              texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;
