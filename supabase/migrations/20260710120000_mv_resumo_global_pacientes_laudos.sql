-- ============================================================
-- Painel admin: contar PACIENTES e LAUDOS no resumo global
-- ------------------------------------------------------------
-- Os cards "Total de pacientes" e "Total de laudos" davam 0 porque a contagem
-- era feita no navegador (RLS) e o admin não tem policy p/ ler dados clínicos.
-- Decisão (privacidade): NÃO abrir acesso do admin às linhas de pacientes.
-- Em vez disso, a MV agregada (que já roda com privilégio e fura RLS) passa a
-- expor apenas os NÚMEROS totais. Só contagem, sem dado individual.
--
-- A MV é atualizada de hora em hora pelo cron 'refresh_admin_views_hourly'
-- (referencia por nome → recriar mantém o refresh). A Edge Function admin-metrics
-- lê a MV com select('*'), então as colunas novas fluem automaticamente.
--
-- ⚠️ Aplicar via chat do Lovable (ele roda a migration) OU à mão no Supabase.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_admin_resumo_global CASCADE;
CREATE MATERIALIZED VIEW mv_admin_resumo_global AS
SELECT
  1::int AS singleton,
  (SELECT count(*)::int FROM public.profissionais)   AS total_profissionais,
  (SELECT count(*)::int FROM public.unidades)        AS total_unidades,
  (SELECT count(*)::int FROM public.gestores_gerais) AS total_gestores_gerais,
  (SELECT count(*)::int FROM public.consolidacoes)   AS total_consolidacoes,
  (SELECT count(*)::int FROM public.pacientes)       AS total_pacientes,
  (SELECT count(*)::int FROM public.laudos)          AS total_laudos,
  now() AS atualizado_em;

-- Índice único exigido pelo REFRESH ... CONCURRENTLY do cron horário.
CREATE UNIQUE INDEX idx_mv_resumo_global_pk ON mv_admin_resumo_global(singleton);

-- Popula agora (o 1º refresh precisa ser não-concorrente).
REFRESH MATERIALIZED VIEW mv_admin_resumo_global;
