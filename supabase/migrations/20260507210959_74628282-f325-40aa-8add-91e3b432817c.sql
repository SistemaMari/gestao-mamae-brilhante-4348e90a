CREATE OR REPLACE FUNCTION public.get_painel_tendencia(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
-- DMG = cenarios 1, 6, 6b — mesma definição de metricas_diagnosticos_admin.
-- Cenário 8 (overt) excluído da contagem.
-- Gestante ativa = DUM nos últimos 280 dias. Não filtra por status_ficha
-- intencionalmente — métrica baseada em verdade biológica para resistir
-- a evolução do schema.
DECLARE
  v_resultado jsonb;
  v_meses_pt text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
BEGIN
  WITH meses AS (
    SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(
      date_trunc('month', NOW()) - INTERVAL '5 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) d
  ),
  primeiras_consultas AS (
    SELECT ra.paciente_id, min(ra.created_at)::date AS data_primeira
    FROM public.registros_atendimento ra
    JOIN public.pacientes p ON p.id = ra.paciente_id
    WHERE p.unidade_id = p_unidade_id
    GROUP BY ra.paciente_id
  ),
  gest_mes AS (
    SELECT date_trunc('month', data_primeira)::date AS mes, count(*) AS total
    FROM primeiras_consultas
    GROUP BY 1
  ),
  dmg_mes AS (
    SELECT date_trunc('month', l.created_at)::date AS mes,
           count(DISTINCT l.paciente_id) AS total
    FROM public.laudos l
    JOIN public.pacientes p ON p.id = l.paciente_id
    WHERE p.unidade_id = p_unidade_id
      AND l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mes_referencia', m.mes,
    'mes_label', v_meses_pt[EXTRACT(MONTH FROM m.mes)::int]
                 || '/' || to_char(m.mes, 'YY'),
    'total_gestantes', coalesce(g.total, 0),
    'total_dmg_confirmadas', coalesce(d.total, 0),
    'prevalencia_pct', CASE WHEN coalesce(g.total,0) = 0 THEN 0
                            ELSE round(coalesce(d.total,0)::numeric / g.total * 100, 1) END
  ) ORDER BY m.mes), '[]'::jsonb)
  INTO v_resultado
  FROM meses m
  LEFT JOIN gest_mes g ON g.mes = m.mes
  LEFT JOIN dmg_mes d ON d.mes = m.mes;

  RETURN v_resultado;
END;
$$;