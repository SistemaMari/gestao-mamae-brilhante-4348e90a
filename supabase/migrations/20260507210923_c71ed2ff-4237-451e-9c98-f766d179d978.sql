CREATE OR REPLACE FUNCTION public.get_painel_perfil_clinico(p_unidade_id uuid)
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
-- Insulina ativa = paciente com laudo cenario_3 OR cenario_4 OR cenario_7.
DECLARE
  v_total integer;
  v_dmg integer;
  v_insulina integer;
  v_anterior integer;
  v_ig_dias integer;
BEGIN
  WITH base AS (
    SELECT id, dmg_gestacao_anterior
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
      AND dum >= (CURRENT_DATE - INTERVAL '280 days')
  ),
  laudos_paciente AS (
    SELECT l.paciente_id,
           bool_or(l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')) AS tem_dmg,
           bool_or(l.cenario_clinico IN ('cenario_3','cenario_4','cenario_7')) AS em_insulina
    FROM public.laudos l
    WHERE l.paciente_id IN (SELECT id FROM base)
    GROUP BY l.paciente_id
  )
  SELECT
    (SELECT count(*) FROM base),
    (SELECT count(*) FROM laudos_paciente WHERE tem_dmg),
    (SELECT count(*) FROM laudos_paciente WHERE tem_dmg AND em_insulina),
    (SELECT count(*) FROM base WHERE dmg_gestacao_anterior = true)
  INTO v_total, v_dmg, v_insulina, v_anterior;

  -- date - date no Postgres já retorna integer (dias)
  SELECT avg(l.created_at::date - p.dum)::int
    INTO v_ig_dias
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = p_unidade_id
    AND l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
    AND l.created_at >= (NOW() - INTERVAL '90 days')
    AND p.dum IS NOT NULL;

  RETURN jsonb_build_object(
    'total_acompanhadas', coalesce(v_total, 0),
    'total_dmg_confirmadas', coalesce(v_dmg, 0),
    'prevalencia_pct', CASE WHEN coalesce(v_total,0) = 0 THEN 0
                            ELSE round(v_dmg::numeric / v_total * 100, 1) END,
    'benchmark_min_pct', 7.0,
    'benchmark_max_pct', 18.0,
    'em_insulina', coalesce(v_insulina, 0),
    'em_insulina_pct', CASE WHEN coalesce(v_dmg,0) = 0 THEN 0
                            ELSE round(v_insulina::numeric / v_dmg * 100, 1) END,
    'dmg_anterior', coalesce(v_anterior, 0),
    'dmg_anterior_pct', CASE WHEN coalesce(v_total,0) = 0 THEN 0
                             ELSE round(v_anterior::numeric / v_total * 100, 1) END,
    'ig_media_diagnostico_dias', v_ig_dias
  );
END;
$$;