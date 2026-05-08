
-- =============================================================
-- Operação: agora 5 campos
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- Diferente do painel do gestor de unidade (fixo 30d) — proposital.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_consolidador_operacao_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidades uuid[];
  v_gest integer;
  v_laudos integer;
  v_exames integer;
  v_partos integer;
  v_prof integer;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'gestantes_ativas', 0,
      'laudos_emitidos', 0,
      'exames_realizados', 0,
      'partos_registrados', 0,
      'profissionais_ativos', 0
    );
  END IF;

  -- "Gestantes ativas" = população em curso (DUM ≤ 280d). NÃO usa janela
  -- parametrizada, pois é uma fotografia do momento atual.
  SELECT count(*) INTO v_gest
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND p.dum IS NOT NULL
    AND p.dum >= (CURRENT_DATE - INTERVAL '280 days');

  -- Laudos emitidos no período (janela parametrizada).
  SELECT count(*) INTO v_laudos
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  -- Exames de glicemia realizados no período (janela parametrizada).
  SELECT count(*) INTO v_exames
  FROM public.exames_glicemia eg
  JOIN public.pacientes p ON p.id = eg.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND eg.data_exame BETWEEN p_data_inicio AND p_data_fim;

  -- Partos registrados no período (janela parametrizada).
  SELECT count(*) INTO v_partos
  FROM public.partos pa
  WHERE pa.unidade_id = ANY(v_unidades)
    AND pa.is_rascunho = false
    AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim;

  -- Profissionais ativos = têm pelo menos 1 paciente ativo agora (não janela).
  SELECT count(DISTINCT pr.id) INTO v_prof
  FROM public.profissionais pr
  WHERE pr.unidade_id = ANY(v_unidades)
    AND pr.acesso_revogado = false
    AND EXISTS (
      SELECT 1 FROM public.pacientes pp
      WHERE pp.profissional_id = pr.id
        AND pp.is_rascunho = false
        AND pp.dum IS NOT NULL
        AND pp.dum >= (CURRENT_DATE - INTERVAL '280 days')
    );

  RETURN jsonb_build_object(
    'gestantes_ativas', coalesce(v_gest, 0),
    'laudos_emitidos', coalesce(v_laudos, 0),
    'exames_realizados', coalesce(v_exames, 0),
    'partos_registrados', coalesce(v_partos, 0),
    'profissionais_ativos', coalesce(v_prof, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_consolidador_operacao_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consolidador_operacao_gestor_geral(date, date, uuid[]) TO authenticated;

-- =============================================================
-- Perfil clínico: ig/dum como objeto {semanas, dias, total_dias} + N
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidades uuid[];
  v_total_laudos integer;
  v_dmg integer;
  v_n integer;
  v_ig_avg numeric;
  v_dum_avg numeric;
  v_fechamento numeric;
  v_ig_total int;
  v_dum_total int;
  v_fech_total int;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'taxa_dmg_positivo_pct', 0,
      'total_diagnosticos_no_calculo', 0,
      'ig_media_diagnostico', NULL,
      'tempo_medio_dum_diagnostico', NULL,
      'tempo_medio_fechamento_dias', NULL
    );
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')),
    count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b') AND p.dum IS NOT NULL),
    avg(l.created_at::date - p.dum) FILTER (
      WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b') AND p.dum IS NOT NULL
    ),
    avg(l.created_at::date - p.dum) FILTER (
      WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b') AND p.dum IS NOT NULL
    )
  INTO v_total_laudos, v_dmg, v_n, v_ig_avg, v_dum_avg
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  SELECT avg(pa.data_parto - p.dum)
  INTO v_fechamento
  FROM public.partos pa
  JOIN public.pacientes p ON p.id = pa.paciente_id
  WHERE pa.unidade_id = ANY(v_unidades)
    AND pa.is_rascunho = false
    AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim
    AND p.dum IS NOT NULL;

  v_ig_total   := CASE WHEN v_ig_avg IS NULL THEN NULL ELSE round(v_ig_avg)::int END;
  v_dum_total  := CASE WHEN v_dum_avg IS NULL THEN NULL ELSE round(v_dum_avg)::int END;
  v_fech_total := CASE WHEN v_fechamento IS NULL THEN NULL ELSE round(v_fechamento)::int END;

  RETURN jsonb_build_object(
    'taxa_dmg_positivo_pct', CASE WHEN coalesce(v_total_laudos,0)=0 THEN 0
                                  ELSE round(v_dmg::numeric / v_total_laudos * 100, 1) END,
    'total_diagnosticos_no_calculo', coalesce(v_n, 0),
    'ig_media_diagnostico', CASE WHEN v_ig_total IS NULL THEN NULL ELSE jsonb_build_object(
      'semanas', floor(v_ig_total / 7)::int,
      'dias', (v_ig_total % 7)::int,
      'total_dias', v_ig_total
    ) END,
    'tempo_medio_dum_diagnostico', CASE WHEN v_dum_total IS NULL THEN NULL ELSE jsonb_build_object(
      'semanas', floor(v_dum_total / 7)::int,
      'dias', (v_dum_total % 7)::int,
      'total_dias', v_dum_total
    ) END,
    'tempo_medio_fechamento_dias', v_fech_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(date, date, uuid[]) TO authenticated;

-- =============================================================
-- Comentário sobre divergência intencional de janela em gargalos
-- =============================================================
COMMENT ON FUNCTION public.get_consolidador_gargalos_gestor_geral(date, date, uuid[]) IS
'Indicadores de gargalo. NÃO usa p_data_inicio/p_data_fim para filtrar — opera sobre a
população em curso (DUM ≤ 280d) e o histórico completo de laudos DMG (cenarios 1/6/6b).
Por isso o count de "DMG confirmado sem retorno" pode ser MAIOR que "laudos_emitidos"
do mesmo período em get_consolidador_operacao_gestor_geral / get_visao_geral_gestor_geral
(estes últimos respeitam a janela). Diferença intencional — gargalo é estado clínico atual.';

COMMENT ON FUNCTION public.get_consolidador_operacao_gestor_geral(date, date, uuid[]) IS
'Métricas de operação. laudos_emitidos / exames_realizados / partos_registrados usam
p_data_inicio/p_data_fim. gestantes_ativas e profissionais_ativos são fotografia do
momento (DUM ≤ 280d), independente da janela.';
