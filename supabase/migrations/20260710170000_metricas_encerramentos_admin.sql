-- ============================================================
-- Novas métricas do painel /admin/diagnosticos: encerramentos, adesão,
-- IG no encaminhamento ao endócrino e laudos gerados por mês.
-- Função dedicada (não mexe na metricas_diagnosticos_admin, que é grande).
-- Admin-only, SECURITY DEFINER.
-- ⚠️ Aplicar via chat do Lovable (não roda no Publish).
-- ============================================================

CREATE OR REPLACE FUNCTION public.metricas_encerramentos_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH enc AS (
    -- Motivo EFETIVO: motivo_encerramento OR (status encerrada_insulinizacao).
    SELECT
      count(*) FILTER (
        WHERE motivo_encerramento IS NULL
          AND coalesce(status_ficha, '') <> 'encerrada_insulinizacao'
      ) AS ativas,
      count(*) FILTER (
        WHERE motivo_encerramento IS NOT NULL
           OR status_ficha = 'encerrada_insulinizacao'
      ) AS encerradas,
      count(*) FILTER (WHERE motivo_encerramento = 'parto')        AS parto,
      count(*) FILTER (WHERE motivo_encerramento = 'aborto')       AS aborto,
      count(*) FILTER (
        WHERE motivo_encerramento = 'insulinizacao'
           OR status_ficha = 'encerrada_insulinizacao'
      )                                                            AS insulinizacao,
      count(*) FILTER (WHERE motivo_encerramento = 'nao_retornou') AS nao_retornou,
      count(*) FILTER (WHERE motivo_encerramento = 'outro')        AS outro
    FROM public.pacientes
    WHERE is_rascunho = false
  ),
  meses AS (
    SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(date_trunc('month', now()) - interval '11 months',
                         date_trunc('month', now()),
                         interval '1 month') d
  ),
  laudos_m AS (
    SELECT date_trunc('month', created_at)::date AS mes, count(*) AS qtd
    FROM public.laudos
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'ativas',     (SELECT ativas FROM enc),
    'encerradas', (SELECT encerradas FROM enc),
    'por_motivo', (SELECT jsonb_build_object(
        'parto',         parto,
        'aborto',        aborto,
        'insulinizacao', insulinizacao,
        'nao_retornou',  nao_retornou,
        'outro',         outro
      ) FROM enc),
    'taxa_nao_retornou', (
      SELECT CASE WHEN encerradas = 0 THEN 0
                  ELSE round(nao_retornou::numeric / encerradas * 100, 1) END
      FROM enc
    ),
    'ig_ao_endocrino', (
      SELECT round(avg(coalesce(ig_semanas, 0) + coalesce(ig_dias, 0) / 7.0)::numeric, 1)
      FROM public.consultas
      WHERE cenario_clinico = '7' AND is_rascunho = false
    ),
    'laudos_mensais', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'qtd', coalesce(lm.qtd, 0)
             ) ORDER BY m.mes), '[]'::jsonb)
      FROM meses m
      LEFT JOIN laudos_m lm ON lm.mes = m.mes
    )
  ) INTO v;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.metricas_encerramentos_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metricas_encerramentos_admin() TO authenticated;
