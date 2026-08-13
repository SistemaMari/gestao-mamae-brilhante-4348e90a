-- V4 · Textos de laudo do desfecho `rf_insulina` (Ficha A/C)
-- ---------------------------------------------------------------------------
-- Desfecho novo: indicadores ultrassonográficos alterados (PFE-US ≥ P90, CA ≥ P75
-- e/ou LA anormal, a partir de 28 semanas) → insulinoterapia + encerramento da MARI.
-- Distingue-se das demais chaves de insulina (r2/r3/r4b) pela JUSTIFICATIVA: aqui a
-- indicação vem do comprometimento fetal, não do percentual glicêmico.
--
--   • bloco `justificativa` (ordem 2): específico do caso fetal — RASCUNHO do
--     assistente, baseado na conduta descrita pelas especialistas na reunião,
--     PENDENTE de ratificação clínica (Dras. Marilsa/Iracema, em /admin/laudos).
--   • bloco `conduta` (ordem 3): IDÊNTICO ao das demais chaves de insulina —
--     encerramento por insulinização com os 3 arranjos de continuidade (Prompt 43).
--
-- Publicado para tipo_consulta = ficha_a E ficha_c. Upsert idempotente no publicado
-- (mesmo padrão de seed_laudo_textos): preserva placeholders [entre colchetes].
--
-- ⚠️ Migrations de laudo_textos NÃO rodam no Publish do Lovable — aplicar este SQL
--    à mão no Supabase.
-- ---------------------------------------------------------------------------

-- 1) Justificativa (específica do caso fetal)
INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
SELECT
  t.tipo,
  'rf_insulina',
  'justificativa',
  2,
  'Justificativa Científica',
$t$A partir de 28 semanas, a avaliação ultrassonográfica do crescimento fetal integra a conduta do DMG. Nesta gestante, ao menos um dos indicadores ultrassonográficos encontra-se alterado — peso fetal estimado ≥ percentil 90 (macrossomia), circunferência abdominal ≥ percentil 75 e/ou líquido amniótico anormal —, evidência de comprometimento fetal atribuível ao ambiente hiperglicêmico. Diante do comprometimento fetal, já não há tempo hábil para repactuar dieta e exercício: independentemente do percentual de glicemias na meta, está indicada a associação de INSULINA, com encerramento do acompanhamento ativo da MARI.$t$,
  'publicado',
  'RASCUNHO de IA (V4 — indicadores ultrassonográficos alterados) pendente de ratificação clínica das Dras. Marilsa/Iracema — publicado em 2026-08-13.'
FROM (VALUES ('ficha_a'), ('ficha_c')) AS t(tipo)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET ordem_bloco = EXCLUDED.ordem_bloco, titulo_bloco = EXCLUDED.titulo_bloco,
              texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;

-- 2) Conduta Orientativa (encerramento por insulinização — idêntica às demais chaves)
INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
SELECT
  t.tipo,
  'rf_insulina',
  'conduta',
  3,
  'Conduta Orientativa',
$t$Iniciar insulinoterapia na dose de [dose total de insulina]:

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

ATENÇÃO: Reteste puerperal: realizar GTT 75g (jejum e 2h) entre 6 e 8 semanas após o parto, para reclassificação do estado glicêmico.$t$,
  'publicado',
  'Conduta de encerramento por insulinização (espelho do Prompt 43) aplicada ao desfecho fetal — publicado em 2026-08-13.'
FROM (VALUES ('ficha_a'), ('ficha_c')) AS t(tipo)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;
