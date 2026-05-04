-- PROMPT 23A — Backend Dashboard Admin (corrigido: consultas sem updated_at)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- View auxiliar
DROP MATERIALIZED VIEW IF EXISTS mv_profissionais_ativos_30d CASCADE;
CREATE MATERIALIZED VIEW mv_profissionais_ativos_30d AS
SELECT profissional_id, MAX(ultima_acao) AS ultima_acao
FROM (
  SELECT profissional_id, created_at AS ultima_acao
    FROM public.pacientes
   WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT profissional_id, created_at
    FROM public.consultas
   WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT profissional_id, created_at
    FROM public.laudos
   WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT profissional_id, created_at
    FROM public.partos
   WHERE created_at > now() - interval '30 days'
  UNION ALL
  SELECT profissional_id, created_at
    FROM public.exames_glicemia
   WHERE created_at > now() - interval '30 days'
) sub
WHERE profissional_id IS NOT NULL
GROUP BY profissional_id;
CREATE UNIQUE INDEX idx_mv_ativos_30d_pk ON mv_profissionais_ativos_30d(profissional_id);

-- mv_admin_resumo_global
DROP MATERIALIZED VIEW IF EXISTS mv_admin_resumo_global CASCADE;
CREATE MATERIALIZED VIEW mv_admin_resumo_global AS
SELECT
  1::int AS singleton,
  (SELECT count(*)::int FROM public.profissionais)   AS total_profissionais,
  (SELECT count(*)::int FROM public.unidades)        AS total_unidades,
  (SELECT count(*)::int FROM public.gestores_gerais) AS total_gestores_gerais,
  (SELECT count(*)::int FROM public.consolidacoes)   AS total_consolidacoes,
  now() AS atualizado_em;
CREATE UNIQUE INDEX idx_mv_resumo_global_pk ON mv_admin_resumo_global(singleton);

-- mv_admin_distribuicao_geografica
DROP MATERIALIZED VIEW IF EXISTS mv_admin_distribuicao_geografica CASCADE;
CREATE MATERIALIZED VIEW mv_admin_distribuicao_geografica AS
WITH prof AS (
  SELECT coalesce(pais, 'Brasil') AS pais,
         coalesce(estado, '—')    AS estado,
         coalesce(cidade, '—')    AS cidade,
         count(*)::int            AS total_profissionais
    FROM public.profissionais GROUP BY 1,2,3
),
uni AS (
  SELECT coalesce(pais, 'Brasil') AS pais,
         coalesce(estado, '—')    AS estado,
         coalesce(cidade, '—')    AS cidade,
         count(*)::int            AS total_unidades
    FROM public.unidades GROUP BY 1,2,3
)
SELECT
  coalesce(p.pais, u.pais)     AS pais,
  coalesce(p.estado, u.estado) AS estado,
  coalesce(p.cidade, u.cidade) AS cidade,
  coalesce(p.total_profissionais, 0) AS total_profissionais,
  coalesce(u.total_unidades, 0)      AS total_unidades
FROM prof p
FULL OUTER JOIN uni u
  ON p.pais = u.pais AND p.estado = u.estado AND p.cidade = u.cidade;
CREATE UNIQUE INDEX idx_mv_distrib_pk
  ON mv_admin_distribuicao_geografica(pais, estado, cidade);

-- mv_admin_top_cidades
DROP MATERIALIZED VIEW IF EXISTS mv_admin_top_cidades CASCADE;
CREATE MATERIALIZED VIEW mv_admin_top_cidades AS
SELECT
  row_number() OVER (ORDER BY count(*) DESC, cidade)::int AS posicao,
  coalesce(pais, 'Brasil') AS pais,
  coalesce(estado, '—')    AS estado,
  coalesce(cidade, '—')    AS cidade,
  count(*)::int            AS total_profissionais
FROM public.profissionais
GROUP BY pais, estado, cidade
ORDER BY total_profissionais DESC, cidade
LIMIT 20;
CREATE UNIQUE INDEX idx_mv_top_cidades_pk ON mv_admin_top_cidades(posicao);

-- mv_admin_unidades_resumo
DROP MATERIALIZED VIEW IF EXISTS mv_admin_unidades_resumo CASCADE;
CREATE MATERIALIZED VIEW mv_admin_unidades_resumo AS
SELECT
  u.id AS unidade_id,
  u.nome,
  coalesce(tu.nome, u.tipo) AS tipo,
  coalesce(u.pais, 'Brasil') AS pais,
  coalesce(u.estado, '—')    AS estado,
  coalesce(u.cidade, '—')    AS cidade,
  u.ativa,
  (SELECT count(*)::int FROM public.profissionais p WHERE p.unidade_id = u.id) AS total_profissionais,
  (SELECT count(*)::int FROM public.pacientes pac WHERE pac.unidade_id = u.id) AS total_pacientes,
  (SELECT count(*)::int FROM public.laudos l
     JOIN public.profissionais p ON p.id = l.profissional_id
    WHERE p.unidade_id = u.id) AS total_laudos
FROM public.unidades u
LEFT JOIN public.tipos_unidade tu ON tu.id = u.tipo_id;
CREATE UNIQUE INDEX idx_mv_unidades_resumo_pk ON mv_admin_unidades_resumo(unidade_id);

-- mv_admin_profissionais_por_plano
DROP MATERIALIZED VIEW IF EXISTS mv_admin_profissionais_por_plano CASCADE;
CREATE MATERIALIZED VIEW mv_admin_profissionais_por_plano AS
SELECT
  pl.id   AS plano_id,
  pl.slug AS plano_slug,
  pl.nome AS plano_nome,
  pl.preco_mensal,
  pl.ordem,
  count(p.id)::int AS total,
  count(p.id) FILTER (
    WHERE p.id IN (SELECT profissional_id FROM mv_profissionais_ativos_30d)
  )::int AS ativos_30d
FROM public.planos pl
LEFT JOIN public.profissionais p ON p.plano_id = pl.id
GROUP BY pl.id, pl.slug, pl.nome, pl.preco_mensal, pl.ordem;
CREATE UNIQUE INDEX idx_mv_prof_por_plano_pk ON mv_admin_profissionais_por_plano(plano_id);

-- mv_admin_evolucao_mensal_planos
DROP MATERIALIZED VIEW IF EXISTS mv_admin_evolucao_mensal_planos CASCADE;
CREATE MATERIALIZED VIEW mv_admin_evolucao_mensal_planos AS
WITH meses AS (
  SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) d
),
planos_grid AS (
  SELECT m.mes, pl.id AS plano_id, pl.slug AS plano_slug, pl.nome AS plano_nome
    FROM meses m CROSS JOIN public.planos pl
),
contagens AS (
  SELECT date_trunc('month', created_at)::date AS mes,
         plano_id, count(*)::int AS novos
    FROM public.profissionais
   WHERE created_at >= date_trunc('month', now()) - interval '11 months'
   GROUP BY 1, 2
)
SELECT pg.mes, pg.plano_id, pg.plano_slug, pg.plano_nome,
       coalesce(c.novos, 0) AS novos
FROM planos_grid pg
LEFT JOIN contagens c ON c.mes = pg.mes AND c.plano_id = pg.plano_id;
CREATE UNIQUE INDEX idx_mv_evol_planos_pk ON mv_admin_evolucao_mensal_planos(mes, plano_id);

-- mv_admin_evolucao_mensal_profissionais
DROP MATERIALIZED VIEW IF EXISTS mv_admin_evolucao_mensal_profissionais CASCADE;
CREATE MATERIALIZED VIEW mv_admin_evolucao_mensal_profissionais AS
WITH meses AS (
  SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) d
),
novos AS (
  SELECT date_trunc('month', created_at)::date AS mes, count(*)::int AS qtd
    FROM public.profissionais
   GROUP BY 1
),
ativos AS (
  SELECT date_trunc('month', acao)::date AS mes,
         count(DISTINCT profissional_id)::int AS qtd
  FROM (
    SELECT profissional_id, created_at AS acao FROM public.pacientes
     WHERE created_at >= date_trunc('month', now()) - interval '11 months'
    UNION ALL
    SELECT profissional_id, created_at FROM public.consultas
     WHERE created_at >= date_trunc('month', now()) - interval '11 months'
    UNION ALL
    SELECT profissional_id, created_at FROM public.laudos
     WHERE created_at >= date_trunc('month', now()) - interval '11 months'
    UNION ALL
    SELECT profissional_id, created_at FROM public.partos
     WHERE created_at >= date_trunc('month', now()) - interval '11 months'
  ) acoes
  WHERE profissional_id IS NOT NULL
  GROUP BY 1
)
SELECT m.mes,
       coalesce(n.qtd, 0) AS novos_profissionais,
       coalesce(a.qtd, 0) AS profissionais_ativos
FROM meses m
LEFT JOIN novos n ON n.mes = m.mes
LEFT JOIN ativos a ON a.mes = m.mes;
CREATE UNIQUE INDEX idx_mv_evol_prof_pk ON mv_admin_evolucao_mensal_profissionais(mes);

-- mv_admin_alertas_operacionais
DROP MATERIALIZED VIEW IF EXISTS mv_admin_alertas_operacionais CASCADE;
CREATE MATERIALIZED VIEW mv_admin_alertas_operacionais AS
SELECT 'profissional_inativo_30d'::text AS tipo_alerta,
       (SELECT count(*)::int FROM public.profissionais p
         WHERE p.id NOT IN (SELECT profissional_id FROM mv_profissionais_ativos_30d)) AS total
UNION ALL
SELECT 'intermediaria_inativo_30d',
       (SELECT count(*)::int FROM public.profissionais p
          JOIN public.planos pl ON pl.id = p.plano_id
         WHERE pl.slug = 'intermediaria'
           AND p.id NOT IN (SELECT profissional_id FROM mv_profissionais_ativos_30d))
UNION ALL
SELECT 'inicial_inativo_30d',
       (SELECT count(*)::int FROM public.profissionais p
          JOIN public.planos pl ON pl.id = p.plano_id
         WHERE pl.slug = 'inicial'
           AND p.id NOT IN (SELECT profissional_id FROM mv_profissionais_ativos_30d))
UNION ALL
SELECT 'unidade_dormente',
       (SELECT count(*)::int FROM public.unidades u
         WHERE NOT EXISTS (
           SELECT 1 FROM public.profissionais p
            WHERE p.unidade_id = u.id
              AND p.id IN (SELECT profissional_id FROM mv_profissionais_ativos_30d)
         ))
UNION ALL
SELECT 'onboarding_travado',
       (SELECT count(*)::int FROM public.profissionais p
         WHERE p.created_at < now() - interval '7 days'
           AND (p.crm IS NULL OR p.especialidade IS NULL OR p.unidade_id IS NULL));
CREATE UNIQUE INDEX idx_mv_alertas_pk ON mv_admin_alertas_operacionais(tipo_alerta);

-- admin_access_log
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.profissionais(id),
  view_consultada TEXT NOT NULL,
  pais_filtro TEXT NULL,
  ip TEXT NULL,
  user_agent TEXT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin
  ON public.admin_access_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_view
  ON public.admin_access_log(view_consultada, created_at DESC);
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins veem logs" ON public.admin_access_log;
CREATE POLICY "Admins veem logs"
  ON public.admin_access_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Revoke direto às MVs
REVOKE ALL ON
  mv_admin_resumo_global,
  mv_admin_distribuicao_geografica,
  mv_admin_top_cidades,
  mv_admin_unidades_resumo,
  mv_admin_profissionais_por_plano,
  mv_admin_evolucao_mensal_planos,
  mv_admin_evolucao_mensal_profissionais,
  mv_admin_alertas_operacionais,
  mv_profissionais_ativos_30d
FROM authenticated, anon;

-- Refresh inicial
REFRESH MATERIALIZED VIEW mv_profissionais_ativos_30d;
REFRESH MATERIALIZED VIEW mv_admin_resumo_global;
REFRESH MATERIALIZED VIEW mv_admin_distribuicao_geografica;
REFRESH MATERIALIZED VIEW mv_admin_top_cidades;
REFRESH MATERIALIZED VIEW mv_admin_unidades_resumo;
REFRESH MATERIALIZED VIEW mv_admin_profissionais_por_plano;
REFRESH MATERIALIZED VIEW mv_admin_evolucao_mensal_planos;
REFRESH MATERIALIZED VIEW mv_admin_evolucao_mensal_profissionais;
REFRESH MATERIALIZED VIEW mv_admin_alertas_operacionais;