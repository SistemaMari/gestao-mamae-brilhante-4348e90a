
-- =============================================================
-- Reescreve KPIs do consolidador (Aba 3) usando as mesmas
-- definições de get_visao_geral_gestor_geral / get_ranking_unidades_gestor_geral.
-- pacientes_ativos = snapshot DUM ≤ 280d (NÃO somar mensais da MV).
-- laudos_emitidos / dmg_positivo = janela do filtro.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_metricas_consolidadas_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidades uuid[];
  v_dias int;
  v_ant_inicio date;
  v_ant_fim date;
  v_pa int;
  v_le int;
  v_dmg int;
  v_partos int;
  v_prof int;
  v_pa_ant int;
  v_le_ant int;
  v_dmg_ant int;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);

  v_dias := (p_data_fim - p_data_inicio) + 1;
  v_ant_fim := p_data_inicio - 1;
  v_ant_inicio := v_ant_fim - (v_dias - 1);

  -- Snapshot atual de pacientes ativos (DUM ≤ 280d)
  SELECT count(*)::int INTO v_pa
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND p.dum IS NOT NULL
    AND p.dum >= (CURRENT_DATE - INTERVAL '280 days');

  -- Laudos emitidos no período
  SELECT count(*)::int,
         count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b'))::int
    INTO v_le, v_dmg
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  -- Partos no período
  SELECT count(*)::int INTO v_partos
  FROM public.partos pa
  WHERE pa.unidade_id = ANY(v_unidades)
    AND pa.is_rascunho = false
    AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim;

  -- Profissionais ativos (com pelo menos 1 paciente não-rascunho na unidade)
  SELECT count(DISTINCT p.profissional_id)::int INTO v_prof
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false;

  -- Período anterior — pacientes ativos via "DUM dentro de 280d antes do v_ant_fim"
  SELECT count(*)::int INTO v_pa_ant
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND p.dum IS NOT NULL
    AND p.dum BETWEEN (v_ant_fim - INTERVAL '280 days')::date AND v_ant_fim;

  SELECT count(*)::int,
         count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b'))::int
    INTO v_le_ant, v_dmg_ant
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN v_ant_inicio AND v_ant_fim;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'unidades_total', coalesce(array_length(v_unidades, 1), 0),
    'totais', jsonb_build_object(
      'pacientes_ativos', coalesce(v_pa, 0),
      'laudos_emitidos', coalesce(v_le, 0),
      'taxa_dmg_positivo_pct', CASE WHEN coalesce(v_le,0) = 0 THEN 0
        ELSE round(v_dmg::numeric / v_le * 100, 1) END,
      'partos_registrados', coalesce(v_partos, 0),
      'profissionais_ativos', coalesce(v_prof, 0)
    ),
    'variacao_periodo_anterior', jsonb_build_object(
      'pacientes_ativos_pct', CASE WHEN coalesce(v_pa_ant,0) = 0 THEN NULL
        ELSE round((v_pa - v_pa_ant)::numeric / v_pa_ant * 100, 1) END,
      'laudos_emitidos_pct', CASE WHEN coalesce(v_le_ant,0) = 0 THEN NULL
        ELSE round((v_le - v_le_ant)::numeric / v_le_ant * 100, 1) END,
      'taxa_dmg_positivo_delta', CASE
        WHEN coalesce(v_le_ant,0) = 0 OR coalesce(v_le,0) = 0 THEN NULL
        ELSE round(
          (v_dmg::numeric / v_le * 100) - (v_dmg_ant::numeric / v_le_ant * 100), 1) END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_metricas_consolidadas_gestor_geral(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_metricas_consolidadas_gestor_geral(date,date,uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_metricas_consolidadas_gestor_geral(date,date,uuid[]) IS
'KPIs do topo da Aba 3. Usa as MESMAS definições de get_visao_geral_gestor_geral / get_ranking_unidades_gestor_geral:
pacientes_ativos = snapshot DUM ≤ 280d; laudos_emitidos e taxa_dmg_positivo_pct respeitam a janela.';

-- =============================================================
-- Top destaques (cards "Diagnostica MAIS / MENOS" da Aba 3)
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_top_destaques_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidades uuid[];
  v_mais record;
  v_menos record;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object('mais', NULL, 'menos', NULL);
  END IF;

  WITH dmg AS (
    SELECT u.id AS unidade_id,
           u.nome AS unidade_nome,
           coalesce(count(l.*) FILTER (
             WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
           ), 0)::int AS diagnosticos
    FROM public.unidades u
    LEFT JOIN public.pacientes p ON p.unidade_id = u.id
    LEFT JOIN public.laudos l ON l.paciente_id = p.id
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim
    WHERE u.id = ANY(v_unidades)
    GROUP BY u.id, u.nome
  )
  SELECT unidade_id, unidade_nome, diagnosticos
    INTO v_mais
  FROM dmg
  ORDER BY diagnosticos DESC, unidade_nome ASC
  LIMIT 1;

  WITH dmg AS (
    SELECT u.id AS unidade_id,
           u.nome AS unidade_nome,
           coalesce(count(l.*) FILTER (
             WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
           ), 0)::int AS diagnosticos
    FROM public.unidades u
    LEFT JOIN public.pacientes p ON p.unidade_id = u.id
    LEFT JOIN public.laudos l ON l.paciente_id = p.id
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim
    WHERE u.id = ANY(v_unidades)
    GROUP BY u.id, u.nome
  )
  SELECT unidade_id, unidade_nome, diagnosticos
    INTO v_menos
  FROM dmg
  ORDER BY diagnosticos ASC, unidade_nome ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'mais', CASE WHEN v_mais IS NULL THEN NULL ELSE jsonb_build_object(
      'unidade_id', v_mais.unidade_id,
      'unidade_nome', v_mais.unidade_nome,
      'diagnosticos', v_mais.diagnosticos
    ) END,
    'menos', CASE WHEN v_menos IS NULL THEN NULL ELSE jsonb_build_object(
      'unidade_id', v_menos.unidade_id,
      'unidade_nome', v_menos.unidade_nome,
      'diagnosticos', v_menos.diagnosticos
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_destaques_gestor_geral(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_destaques_gestor_geral(date,date,uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_top_destaques_gestor_geral(date,date,uuid[]) IS
'Retorna {mais, menos} — unidades com mais e menos diagnósticos confirmados de DMG no período.';
