-- ============================================================
-- V4 · Vídeo 2 · item #2 — Caso Novo (pedido de exame) editável no admin.
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
--
-- Seed dos textos do Caso Novo em `laudo_textos`, nos 3 idiomas:
--   (tipo_consulta='consulta_1', desfecho_clinico='pedido_exame', bloco='orientacao')
--
-- Idempotente: usa NOT EXISTS filtrado por (tipo, desfecho, bloco, IDIOMA, status).
-- ⚠️ FILTRAR POR `idioma` no WHERE é obrigatório — sem isso, o INSERT do texto
--    português "atenderia" as linhas em EN/ES e as três colunas nunca seriam
--    criadas. Sempre repetir a mesma estrutura para as três línguas.
--
-- Ordem 1: entra ANTES de todos os laudos no editor (Caso Novo é a 1ª consulta).
-- ============================================================

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, idioma, observacoes)
SELECT
  'consulta_1', 'pedido_exame', 'orientacao', 1,
  'Orientação do exame',
  'Caso Novo registrado com sucesso. Solicitar glicemia plasmática de jejum. Jejum de 8 a 12 horas. Coleta venosa processada em laboratório — glicemia capilar em ponta de dedo não é válida para fins diagnósticos.',
  'publicado', 'pt-BR',
  'Pedido de exame do Caso Novo. NÃO é um laudo — orientação editável no /admin/laudos.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.laudo_textos
  WHERE tipo_consulta = 'consulta_1'
    AND desfecho_clinico = 'pedido_exame'
    AND bloco = 'orientacao'
    AND idioma = 'pt-BR'
    AND status = 'publicado'
);

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, idioma, observacoes)
SELECT
  'consulta_1', 'pedido_exame', 'orientacao', 1,
  'Test instructions',
  'New Case registered successfully. Request fasting plasma glucose. Fasting of 8 to 12 hours. Venous sample processed in a laboratory — capillary fingerstick glucose is not valid for diagnostic purposes.',
  'publicado', 'en-US',
  'New Case test request. NOT a report — instructions editable at /admin/laudos.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.laudo_textos
  WHERE tipo_consulta = 'consulta_1'
    AND desfecho_clinico = 'pedido_exame'
    AND bloco = 'orientacao'
    AND idioma = 'en-US'
    AND status = 'publicado'
);

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, idioma, observacoes)
SELECT
  'consulta_1', 'pedido_exame', 'orientacao', 1,
  'Orientación del examen',
  'Caso Nuevo registrado con éxito. Solicitar glucemia plasmática en ayunas. Ayuno de 8 a 12 horas. Muestra venosa procesada en laboratorio — la glucemia capilar en la yema del dedo no es válida para fines diagnósticos.',
  'publicado', 'es',
  'Solicitud de examen del Caso Nuevo. NO es un informe — orientación editable en /admin/laudos.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.laudo_textos
  WHERE tipo_consulta = 'consulta_1'
    AND desfecho_clinico = 'pedido_exame'
    AND bloco = 'orientacao'
    AND idioma = 'es'
    AND status = 'publicado'
);

-- ── Conferência (opcional): deve trazer 3 linhas ─────────────────────────────
-- SELECT idioma, titulo_bloco, LEFT(texto, 60) AS preview, status
--   FROM public.laudo_textos
--  WHERE tipo_consulta = 'consulta_1' AND desfecho_clinico = 'pedido_exame'
--  ORDER BY idioma;
