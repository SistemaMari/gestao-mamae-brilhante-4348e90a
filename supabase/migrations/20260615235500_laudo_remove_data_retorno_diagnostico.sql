-- ============================================================================
-- Laudo (34D-B variáveis) — remove "[data do próximo retorno]" dos 6 textos de
-- CONDUTA do DIAGNÓSTICO de DMG (Retorno 1 e GTT).
--
-- Motivo: o diagnóstico trabalha com prazo-FAIXA ("Prazo de retorno: 7 a 10
-- dias", já presente no próprio texto) e NÃO fixa data exata — Retorno1Form e
-- GttForm não gravam `data_proximo_retorno`. Com a substituição de variáveis
-- (PR #24), a frase "O próximo retorno deve acontecer no dia
-- [data do próximo retorno]." renderizaria "(não informado)" numa frase central
-- desses laudos. A orientação de prazo logo abaixo cobre o que a paciente precisa.
--
-- Afeta só: (retorno_1, '1'|'6'|'8') e (gtt, '6'|'6B'|'8'), bloco 'conduta' (6 linhas).
-- Idempotente: o LIKE só seleciona registros que ainda têm a variável; o REPLACE
-- não altera nada se a substring exata não existir.
--
-- ⚠️ Migration de PR NÃO roda no Publish do Lovable — aplicar este SQL
--    MANUALMENTE no Supabase SQL Editor (mesmo gotcha de #19 e #22).
--    O UPDATE deve afetar 6 linhas; se vier menos, algum texto foi editado no
--    admin e o fraseado divergiu — conferir antes de publicar.
-- ============================================================================
UPDATE public.laudo_textos
SET texto = REPLACE(
  texto,
  'O próximo retorno deve acontecer no dia [data do próximo retorno]. ',
  ''
)
WHERE bloco = 'conduta'
  AND status = 'publicado'
  AND (
    (tipo_consulta = 'retorno_1' AND desfecho_clinico IN ('1', '6', '8'))
    OR (tipo_consulta = 'gtt' AND desfecho_clinico IN ('6', '6B', '8'))
  )
  AND texto LIKE '%[data do próximo retorno]%';
