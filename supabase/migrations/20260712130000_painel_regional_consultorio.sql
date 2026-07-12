-- ============================================================
-- Aba Painel (Visão Geral): quebras geográficas de PROFISSIONAIS passam a
-- refletir SÓ consultório (profissionais sem unidade), espelhando a aba de
-- diagnósticos. Profissionais institucionais já aparecem nas tabelas por
-- unidade (mv_admin_unidades_resumo, inalterada).
--
--   • mv_admin_distribuicao_geografica → só consultório; REMOVE a coluna
--     total_unidades (unidades são institucional, saem dessa tabela).
--   • mv_admin_top_cidades            → só consultório (WHERE unidade_id IS NULL).
--
-- MV não aceita CREATE OR REPLACE → DROP + CREATE. Índices únicos recriados
-- (necessários pro REFRESH ... CONCURRENTLY do cron refresh_admin_views_hourly).
-- CREATE ... AS já popula na hora. A edge function admin-metrics faz SELECT *,
-- então remover coluna é transparente pra ela.
-- ⚠️ Aplicar à mão no Supabase (não roda no Publish).
-- ============================================================

-- distribuicao_geografica: só consultório, sem coluna de unidades.
DROP MATERIALIZED VIEW IF EXISTS mv_admin_distribuicao_geografica CASCADE;
CREATE MATERIALIZED VIEW mv_admin_distribuicao_geografica AS
SELECT
  coalesce(pais, 'Brasil') AS pais,
  coalesce(estado, '—')    AS estado,
  coalesce(cidade, '—')    AS cidade,
  count(*)::int            AS total_profissionais
FROM public.profissionais
WHERE unidade_id IS NULL
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX idx_mv_distrib_pk
  ON mv_admin_distribuicao_geografica(pais, estado, cidade);

-- top_cidades: só consultório.
DROP MATERIALIZED VIEW IF EXISTS mv_admin_top_cidades CASCADE;
CREATE MATERIALIZED VIEW mv_admin_top_cidades AS
SELECT
  row_number() OVER (ORDER BY count(*) DESC, cidade)::int AS posicao,
  coalesce(pais, 'Brasil') AS pais,
  coalesce(estado, '—')    AS estado,
  coalesce(cidade, '—')    AS cidade,
  count(*)::int            AS total_profissionais
FROM public.profissionais
WHERE unidade_id IS NULL
GROUP BY pais, estado, cidade
ORDER BY total_profissionais DESC, cidade
LIMIT 20;
CREATE UNIQUE INDEX idx_mv_top_cidades_pk ON mv_admin_top_cidades(posicao);
