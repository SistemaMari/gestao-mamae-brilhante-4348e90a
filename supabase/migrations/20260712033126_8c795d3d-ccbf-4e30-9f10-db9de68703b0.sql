-- Split evolução mensal de profissionais by tipo_conta (consultorio vs institucional).
-- tipo_conta = 'institucional' se o profissional tem unidade_id, senão 'consultorio'.

DROP MATERIALIZED VIEW IF EXISTS public.mv_admin_evolucao_mensal_profissionais_tipo CASCADE;

CREATE MATERIALIZED VIEW public.mv_admin_evolucao_mensal_profissionais_tipo AS
WITH meses AS (
  SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) d
),
tipos AS (
  SELECT unnest(ARRAY['consultorio','institucional']) AS tipo_conta
),
grid AS (
  SELECT m.mes, t.tipo_conta FROM meses m CROSS JOIN tipos t
),
prof_tipo AS (
  SELECT id,
         created_at,
         CASE WHEN unidade_id IS NULL THEN 'consultorio' ELSE 'institucional' END AS tipo_conta
    FROM public.profissionais
),
novos AS (
  SELECT date_trunc('month', created_at)::date AS mes,
         tipo_conta,
         count(*)::int AS qtd
    FROM prof_tipo
   GROUP BY 1, 2
),
atividades AS (
  SELECT profissional_id, created_at FROM public.pacientes
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
),
ativos AS (
  SELECT date_trunc('month', a.created_at)::date AS mes,
         pt.tipo_conta,
         count(DISTINCT a.profissional_id)::int AS qtd
    FROM atividades a
    JOIN prof_tipo pt ON pt.id = a.profissional_id
   WHERE a.profissional_id IS NOT NULL
   GROUP BY 1, 2
)
SELECT g.mes,
       g.tipo_conta,
       coalesce(n.qtd, 0) AS novos_profissionais,
       coalesce(at.qtd, 0) AS profissionais_ativos
  FROM grid g
  LEFT JOIN novos n
    ON n.mes = g.mes AND n.tipo_conta = g.tipo_conta
  LEFT JOIN ativos at
    ON at.mes = g.mes AND at.tipo_conta = g.tipo_conta;

CREATE UNIQUE INDEX idx_mv_evol_prof_tipo_pk
  ON public.mv_admin_evolucao_mensal_profissionais_tipo(mes, tipo_conta);

GRANT SELECT ON public.mv_admin_evolucao_mensal_profissionais_tipo TO authenticated;
GRANT SELECT ON public.mv_admin_evolucao_mensal_profissionais_tipo TO service_role;

REFRESH MATERIALIZED VIEW public.mv_admin_evolucao_mensal_profissionais_tipo;