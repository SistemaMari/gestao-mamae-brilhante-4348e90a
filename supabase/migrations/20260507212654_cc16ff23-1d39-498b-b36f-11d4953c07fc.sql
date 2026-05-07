CREATE OR REPLACE FUNCTION public.get_painel_tendencia(p_unidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
-- DMG = cenarios 1, 6, 6b — mesma definição de metricas_diagnosticos_admin.
-- Cenário 8 (overt) excluído da contagem.
-- Gestante ativa = DUM nos últimos 280 dias (fotografia mensal).
-- Não filtra por status_ficha intencionalmente — métrica baseada em
-- verdade biológica para resistir a evolução do schema.
-- total_gestantes = fotografia: pacientes com DUM nos 280 dias anteriores
-- ao último dia do mês de referência. Alinhado ao Bloco 2 (perfil clínico).
-- total_dmg_confirmadas = pacientes com laudo DMG (cenarios 1/6/6b) emitido
-- até o último dia do mês de referência E que estavam ativas naquele mês.
DECLARE
  v_resultado jsonb;
  v_meses_pt text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
BEGIN
  WITH meses AS (
    SELECT
      date_trunc('month', d)::date AS mes_inicio,
      (date_trunc('month', d) + INTERVAL '1 month - 1 day')::date AS mes_fim
    FROM generate_series(
      date_trunc('month', NOW()) - INTERVAL '5 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) d
  ),
  base_pacientes AS (
    SELECT id, dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
  ),
  gest_mes AS (
    SELECT m.mes_inicio AS mes, count(bp.id) AS total
    FROM meses m
    LEFT JOIN base_pacientes bp
      ON bp.dum <= m.mes_fim
     AND bp.dum >= (m.mes_fim - INTERVAL '280 days')
    GROUP BY m.mes_inicio
  ),
  dmg_mes AS (
    SELECT m.mes_inicio AS mes, count(DISTINCT l.paciente_id) AS total
    FROM meses m
    LEFT JOIN public.laudos l
      ON l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
     AND l.created_at::date <= m.mes_fim
    LEFT JOIN public.pacientes p
      ON p.id = l.paciente_id
     AND p.unidade_id = p_unidade_id
     AND p.is_rascunho = false
     AND p.dum IS NOT NULL
     AND p.dum <= m.mes_fim
     AND p.dum >= (m.mes_fim - INTERVAL '280 days')
    WHERE p.id IS NOT NULL OR l.id IS NULL
    GROUP BY m.mes_inicio
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mes_referencia', m.mes_inicio,
    'mes_label', v_meses_pt[EXTRACT(MONTH FROM m.mes_inicio)::int]
                 || '/' || to_char(m.mes_inicio, 'YY'),
    'total_gestantes', coalesce(g.total, 0),
    'total_dmg_confirmadas', coalesce(d.total, 0),
    'prevalencia_pct', CASE WHEN coalesce(g.total,0) = 0 THEN 0
                            ELSE round(coalesce(d.total,0)::numeric / g.total * 100, 1) END
  ) ORDER BY m.mes_inicio), '[]'::jsonb)
  INTO v_resultado
  FROM meses m
  LEFT JOIN gest_mes g ON g.mes = m.mes_inicio
  LEFT JOIN dmg_mes d ON d.mes = m.mes_inicio;

  RETURN v_resultado;
END;
$function$;