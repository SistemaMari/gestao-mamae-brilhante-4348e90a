CREATE OR REPLACE FUNCTION public._rastreio_dmg_gg(p_unidades uuid[], p_inicio date, p_fim date)
RETURNS TABLE(unidade_id uuid, rastreadas integer, dmg integer, overt integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT x.unidade_id,
         count(*)::int,
         count(*) FILTER (WHERE x.tem_dmg)::int,
         count(*) FILTER (WHERE x.tem_overt)::int
  FROM (
    SELECT p.unidade_id, c.paciente_id,
           bool_or(c.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')) AS tem_dmg,
           bool_or(c.cenario_clinico IN ('8','cenario_8')) AS tem_overt
    FROM public.consultas c
    JOIN public.pacientes p ON p.id = c.paciente_id
    WHERE p.unidade_id = ANY(p_unidades)
      AND p.is_rascunho = false
      AND c.is_rascunho = false
      AND c.tipo IN ('retorno_1', 'gtt')
      AND c.data BETWEEN p_inicio AND p_fim
    GROUP BY p.unidade_id, c.paciente_id
  ) x
  GROUP BY x.unidade_id;
$$;

CREATE OR REPLACE FUNCTION public._partos_gg(p_unidades uuid[], p_inicio date, p_fim date)
RETURNS TABLE(unidade_id uuid, partos integer, media_fechamento numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH ev AS (
    SELECT p.unidade_id, p.id AS paciente_id,
           coalesce(p.data_encerramento, p.data_ultima_consulta) AS data_parto
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(p_unidades)
      AND p.is_rascunho = false
      AND (p.motivo_encerramento::text = 'parto' OR p.status_ficha = 'resultado_parto')
    UNION ALL
    SELECT pa.unidade_id, pa.paciente_id, pa.data_parto
    FROM public.partos pa
    WHERE pa.unidade_id = ANY(p_unidades)
      AND pa.is_rascunho = false
  ),
  um_por_gestante AS (
    SELECT DISTINCT ON (paciente_id) unidade_id, paciente_id, data_parto
    FROM ev
    WHERE data_parto IS NOT NULL
    ORDER BY paciente_id, data_parto
  )
  SELECT g.unidade_id,
         count(*)::int,
         avg(g.data_parto - public.dum_efetiva(g.paciente_id))
           FILTER (WHERE public.dum_efetiva(g.paciente_id) IS NOT NULL)::numeric
  FROM um_por_gestante g
  WHERE g.data_parto BETWEEN p_inicio AND p_fim
  GROUP BY g.unidade_id;
$$;

REVOKE ALL ON FUNCTION public._rastreio_dmg_gg(uuid[], date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._partos_gg(uuid[], date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_painel_perfil_clinico(p_unidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
  v_dmg integer;
  v_overt integer;
  v_insulina integer;
  v_anterior integer;
  v_ig_dias integer;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT id, dmg_gestacao_anterior, status_ficha, motivo_encerramento
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND public.dum_efetiva(id) IS NOT NULL
      AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
  ),
  laudos_paciente AS (
    SELECT l.paciente_id,
           bool_or(l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')) AS tem_dmg,
           bool_or(l.cenario_clinico IN ('3','4','7','cenario_3','cenario_4','cenario_7')) AS em_insulina,
           bool_or(l.cenario_clinico IN ('8','cenario_8')) AS tem_overt
    FROM public.laudos l
    WHERE l.paciente_id IN (SELECT id FROM base)
    GROUP BY l.paciente_id
  )
  SELECT
    (SELECT count(*) FROM base),
    (SELECT count(*) FROM laudos_paciente WHERE tem_dmg),
    (SELECT count(*) FROM laudos_paciente lp JOIN base b ON b.id = lp.paciente_id
      WHERE lp.tem_dmg
        AND (b.motivo_encerramento::text = 'insulinizacao'
             OR b.status_ficha IN ('encerrada_insulinizacao','encaminhada_endocrino'))),
    (SELECT count(*) FROM base WHERE dmg_gestacao_anterior = true),
    (SELECT count(*) FROM laudos_paciente WHERE tem_overt)
  INTO v_total, v_dmg, v_insulina, v_anterior, v_overt;

  SELECT avg(l.created_at::date - public.dum_efetiva(p.id))::int
    INTO v_ig_dias
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = p_unidade_id
    AND l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')
    AND l.created_at >= (NOW() - INTERVAL '90 days')
    AND public.dum_efetiva(p.id) IS NOT NULL;

  RETURN jsonb_build_object(
    'total_acompanhadas', coalesce(v_total, 0),
    'total_dmg_confirmadas', coalesce(v_dmg, 0),
    'total_overt', coalesce(v_overt, 0),
    'prevalencia_pct', CASE WHEN coalesce(v_total,0)=0 THEN 0
                            ELSE round(v_dmg::numeric / v_total * 100, 1) END,
    'benchmark_min_pct', 7.0,
    'benchmark_max_pct', 18.0,
    'em_insulina', coalesce(v_insulina, 0),
    'em_insulina_pct', CASE WHEN coalesce(v_dmg,0)=0 THEN 0
                            ELSE round(v_insulina::numeric / v_dmg * 100, 1) END,
    'dmg_anterior', coalesce(v_anterior, 0),
    'dmg_anterior_pct', CASE WHEN coalesce(v_total,0)=0 THEN 0
                             ELSE round(v_anterior::numeric / v_total * 100, 1) END,
    'ig_media_diagnostico_dias', v_ig_dias
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_consolidador_operacao_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT count(*) INTO v_gest
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND public.dum_efetiva(p.id) IS NOT NULL
    AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
    AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text);

  SELECT count(*) INTO v_laudos
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  SELECT count(*) INTO v_exames
  FROM public.exames_glicemia eg
  JOIN public.pacientes p ON p.id = eg.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND eg.data_exame BETWEEN p_data_inicio AND p_data_fim;

  SELECT coalesce(sum(x.partos), 0)::int INTO v_partos
  FROM public._partos_gg(v_unidades, p_data_inicio, p_data_fim) x;

  SELECT count(DISTINCT pr.id) INTO v_prof
  FROM public.profissionais pr
  WHERE pr.unidade_id = ANY(v_unidades)
    AND pr.acesso_revogado = false
    AND EXISTS (
      SELECT 1 FROM public.pacientes pp
      WHERE pp.profissional_id = pr.id
        AND pp.is_rascunho = false
        AND public.dum_efetiva(pp.id) IS NOT NULL
        AND public.dum_efetiva(pp.id) >= (CURRENT_DATE - INTERVAL '280 days')
        AND public.paciente_em_acompanhamento(pp.status_ficha, pp.motivo_encerramento::text)
    );

  RETURN jsonb_build_object(
    'gestantes_ativas', coalesce(v_gest, 0),
    'laudos_emitidos', coalesce(v_laudos, 0),
    'exames_realizados', coalesce(v_exames, 0),
    'partos_registrados', coalesce(v_partos, 0),
    'profissionais_ativos', coalesce(v_prof, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_ranking_unidades_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(unidade_id uuid, unidade_nome text, pacientes_ativos integer, laudos_emitidos integer, taxa_dmg_positivo_pct numeric, tempo_medio_fechamento_dias numeric, status_operacional text, ultima_atividade timestamp with time zone, dias_sem_atividade integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unidades uuid[];
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH unids AS (
    SELECT u.id, u.nome FROM public.unidades u WHERE u.id = ANY(v_unidades)
  ),
  pac AS (
    SELECT p.unidade_id, count(*)::int AS total
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(v_unidades)
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
    GROUP BY p.unidade_id
  ),
  laud AS (
    SELECT p.unidade_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b'))::int AS dmg
    FROM public.laudos l
    JOIN public.pacientes p ON p.id = l.paciente_id
    WHERE p.unidade_id = ANY(v_unidades)
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim
    GROUP BY p.unidade_id
  ),
  fech AS (
    SELECT x.unidade_id, x.media_fechamento AS media_dias
    FROM public._partos_gg(v_unidades, p_data_inicio, p_data_fim) x
  ),
  rast AS (
    SELECT * FROM public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim)
  ),
  ult AS (
    SELECT mv.unidade_id, max(mv.ultima_atividade) AS ultima
    FROM public.mv_metricas_unidade mv
    WHERE mv.unidade_id = ANY(v_unidades)
    GROUP BY mv.unidade_id
  )
  SELECT
    u.id,
    u.nome,
    coalesce(pc.total, 0),
    coalesce(l.total, 0),
    CASE WHEN coalesce(r.rastreadas, 0) = 0 THEN 0::numeric
         ELSE round(coalesce(r.dmg,0)::numeric / r.rastreadas * 100, 1) END,
    CASE WHEN f.media_dias IS NULL THEN NULL ELSE round(f.media_dias, 1) END,
    CASE
      WHEN ut.ultima IS NULL THEN 'nao_iniciada'
      WHEN ut.ultima >= now() - interval '30 days' THEN 'ativa'
      WHEN ut.ultima >= now() - interval '60 days' THEN 'atencao'
      ELSE 'inativa'
    END,
    ut.ultima,
    CASE WHEN ut.ultima IS NULL THEN NULL
         ELSE (current_date - ut.ultima::date)::int END
  FROM unids u
  LEFT JOIN pac pc ON pc.unidade_id = u.id
  LEFT JOIN laud l ON l.unidade_id = u.id
  LEFT JOIN fech f ON f.unidade_id = u.id
  LEFT JOIN rast r ON r.unidade_id = u.id
  LEFT JOIN ult ut ON ut.unidade_id = u.id
  ORDER BY
    CASE
      WHEN ut.ultima IS NULL THEN 0
      WHEN ut.ultima < now() - interval '60 days' THEN 1
      WHEN ut.ultima < now() - interval '30 days' THEN 2
      ELSE 3
    END ASC,
    coalesce(l.total, 0) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_visao_geral_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(unidade_id uuid, unidade_nome text, gestor_nome text, pacientes_ativos integer, laudos_emitidos integer, partos_registrados integer, profissionais_ativos integer, taxa_dmg_positivo_pct numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unidades uuid[];
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH unids AS (
    SELECT u.id, u.nome
    FROM public.unidades u
    WHERE u.id = ANY(v_unidades)
  ),
  gestor AS (
    SELECT pr.unidade_id,
           (array_agg(pr.nome ORDER BY pr.created_at))[1] AS nome
    FROM public.profissionais pr
    WHERE pr.unidade_id = ANY(v_unidades)
      AND pr.perfil_institucional = 'gestor'
      AND pr.acesso_revogado = false
    GROUP BY pr.unidade_id
  ),
  pac AS (
    SELECT p.unidade_id, count(*)::int AS total
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(v_unidades)
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
    GROUP BY p.unidade_id
  ),
  laud AS (
    SELECT p.unidade_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b'))::int AS dmg
    FROM public.laudos l
    JOIN public.pacientes p ON p.id = l.paciente_id
    WHERE p.unidade_id = ANY(v_unidades)
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim
    GROUP BY p.unidade_id
  ),
  par AS (
    SELECT x.unidade_id, x.partos AS total
    FROM public._partos_gg(v_unidades, p_data_inicio, p_data_fim) x
  ),
  rast AS (
    SELECT * FROM public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim)
  ),
  prof AS (
    SELECT pr.unidade_id, count(*)::int AS total
    FROM public.profissionais pr
    WHERE pr.unidade_id = ANY(v_unidades)
      AND pr.acesso_revogado = false
      AND EXISTS (
        SELECT 1 FROM public.pacientes pp
        WHERE pp.profissional_id = pr.id
          AND pp.is_rascunho = false
          AND public.dum_efetiva(pp.id) IS NOT NULL
          AND public.dum_efetiva(pp.id) >= (CURRENT_DATE - INTERVAL '280 days')
          AND public.paciente_em_acompanhamento(pp.status_ficha, pp.motivo_encerramento::text)
      )
    GROUP BY pr.unidade_id
  )
  SELECT
    u.id,
    u.nome,
    g.nome,
    coalesce(pc.total, 0),
    coalesce(l.total, 0),
    coalesce(pa.total, 0),
    coalesce(pr.total, 0),
    CASE WHEN coalesce(r.rastreadas,0) = 0 THEN 0
         ELSE round(coalesce(r.dmg,0)::numeric / r.rastreadas * 100, 1) END
  FROM unids u
  LEFT JOIN gestor g ON g.unidade_id = u.id
  LEFT JOIN pac pc ON pc.unidade_id = u.id
  LEFT JOIN laud l ON l.unidade_id = u.id
  LEFT JOIN par pa ON pa.unidade_id = u.id
  LEFT JOIN prof pr ON pr.unidade_id = u.id
  LEFT JOIN rast r ON r.unidade_id = u.id
  ORDER BY u.nome;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_metricas_consolidadas_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_rast int;
  v_rast_ant int;
  v_overt int;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);

  v_dias := (p_data_fim - p_data_inicio) + 1;
  v_ant_fim := p_data_inicio - 1;
  v_ant_inicio := v_ant_fim - (v_dias - 1);

  SELECT count(*)::int INTO v_pa
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND public.dum_efetiva(p.id) IS NOT NULL
    AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
    AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text);

  SELECT count(*)::int INTO v_le
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  SELECT coalesce(sum(r.rastreadas), 0)::int, coalesce(sum(r.dmg), 0)::int, coalesce(sum(r.overt), 0)::int
    INTO v_rast, v_dmg, v_overt
  FROM public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim) r;

  SELECT coalesce(sum(x.partos), 0)::int INTO v_partos
  FROM public._partos_gg(v_unidades, p_data_inicio, p_data_fim) x;

  SELECT count(DISTINCT pr.id)::int INTO v_prof
  FROM public.profissionais pr
  WHERE pr.unidade_id = ANY(v_unidades)
    AND pr.acesso_revogado = false
    AND coalesce(pr.perfil_institucional, '') <> 'gestor'
    AND EXISTS (
      SELECT 1 FROM public.pacientes pp
      WHERE pp.profissional_id = pr.id
        AND pp.is_rascunho = false
        AND public.dum_efetiva(pp.id) IS NOT NULL
        AND public.dum_efetiva(pp.id) >= (CURRENT_DATE - INTERVAL '280 days')
        AND public.paciente_em_acompanhamento(pp.status_ficha, pp.motivo_encerramento::text)
    );

  SELECT count(*)::int INTO v_pa_ant
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND public.dum_efetiva(p.id) IS NOT NULL
    AND public.dum_efetiva(p.id) BETWEEN (v_ant_fim - INTERVAL '280 days')::date AND v_ant_fim
    AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text);

  SELECT count(*)::int INTO v_le_ant
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN v_ant_inicio AND v_ant_fim;

  SELECT coalesce(sum(r.rastreadas), 0)::int, coalesce(sum(r.dmg), 0)::int
    INTO v_rast_ant, v_dmg_ant
  FROM public._rastreio_dmg_gg(v_unidades, v_ant_inicio, v_ant_fim) r;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
    'unidades_total', coalesce(array_length(v_unidades, 1), 0),
    'totais', jsonb_build_object(
      'pacientes_ativos', coalesce(v_pa, 0),
      'laudos_emitidos', coalesce(v_le, 0),
      'taxa_dmg_positivo_pct', CASE WHEN coalesce(v_rast,0) = 0 THEN 0
        ELSE round(v_dmg::numeric / v_rast * 100, 1) END,
      'gestantes_rastreadas', coalesce(v_rast, 0),
      'gestantes_dmg', coalesce(v_dmg, 0),
      'gestantes_overt', coalesce(v_overt, 0),
      'partos_registrados', coalesce(v_partos, 0),
      'profissionais_ativos', coalesce(v_prof, 0)
    ),
    'variacao_periodo_anterior', jsonb_build_object(
      'pacientes_ativos_pct', CASE WHEN coalesce(v_pa_ant,0) = 0 THEN NULL
        ELSE round((v_pa - v_pa_ant)::numeric / v_pa_ant * 100, 1) END,
      'laudos_emitidos_pct', CASE WHEN coalesce(v_le_ant,0) = 0 THEN NULL
        ELSE round((v_le - v_le_ant)::numeric / v_le_ant * 100, 1) END,
      'taxa_dmg_positivo_delta', CASE
        WHEN coalesce(v_rast_ant,0) = 0 OR coalesce(v_rast,0) = 0 THEN NULL
        ELSE round(
          (v_dmg::numeric / v_rast * 100) - (v_dmg_ant::numeric / v_rast_ant * 100), 1) END
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unidades uuid[];
  v_rast int;
  v_dmg int;
  v_overt int;
  v_ig_avg numeric;
  v_fechamento numeric;
  v_ig_total int;
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
      'gestantes_rastreadas', 0,
      'total_overt', 0,
      'ig_media_diagnostico', NULL,
      'tempo_medio_dum_diagnostico', NULL,
      'tempo_medio_fechamento_dias', NULL
    );
  END IF;

  SELECT coalesce(sum(r.rastreadas), 0)::int, coalesce(sum(r.dmg), 0)::int, coalesce(sum(r.overt), 0)::int
    INTO v_rast, v_dmg, v_overt
  FROM public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim) r;

  SELECT avg(d.data - public.dum_efetiva(d.paciente_id))
    INTO v_ig_avg
  FROM (
    SELECT DISTINCT ON (c.paciente_id) c.paciente_id, c.data
    FROM public.consultas c
    JOIN public.pacientes p ON p.id = c.paciente_id
    WHERE p.unidade_id = ANY(v_unidades)
      AND p.is_rascunho = false
      AND c.is_rascunho = false
      AND c.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')
      AND c.data BETWEEN p_data_inicio AND p_data_fim
    ORDER BY c.paciente_id, c.data
  ) d
  WHERE public.dum_efetiva(d.paciente_id) IS NOT NULL;

  SELECT avg(x.media_fechamento) INTO v_fechamento
  FROM public._partos_gg(v_unidades, p_data_inicio, p_data_fim) x;

  v_ig_total   := CASE WHEN v_ig_avg IS NULL THEN NULL ELSE round(v_ig_avg)::int END;
  v_fech_total := CASE WHEN v_fechamento IS NULL THEN NULL ELSE round(v_fechamento)::int END;

  RETURN jsonb_build_object(
    'taxa_dmg_positivo_pct', CASE WHEN coalesce(v_rast,0)=0 THEN 0
                                  ELSE round(v_dmg::numeric / v_rast * 100, 1) END,
    'total_diagnosticos_no_calculo', coalesce(v_dmg, 0),
    'gestantes_rastreadas', coalesce(v_rast, 0),
    'total_overt', coalesce(v_overt, 0),
    'ig_media_diagnostico', CASE WHEN v_ig_total IS NULL THEN NULL ELSE jsonb_build_object(
      'semanas', floor(v_ig_total / 7)::int,
      'dias', (v_ig_total % 7)::int,
      'total_dias', v_ig_total
    ) END,
    'tempo_medio_dum_diagnostico', CASE WHEN v_ig_total IS NULL THEN NULL ELSE jsonb_build_object(
      'semanas', floor(v_ig_total / 7)::int,
      'dias', (v_ig_total % 7)::int,
      'total_dias', v_ig_total
    ) END,
    'tempo_medio_fechamento_dias', v_fech_total
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_destaques_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT u.id AS unidade_id, u.nome AS unidade_nome, coalesce(r.dmg, 0)::int AS diagnosticos
    FROM public.unidades u
    LEFT JOIN public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim) r ON r.unidade_id = u.id
    WHERE u.id = ANY(v_unidades)
  )
  SELECT unidade_id, unidade_nome, diagnosticos INTO v_mais
  FROM dmg ORDER BY diagnosticos DESC, unidade_nome ASC LIMIT 1;

  WITH dmg AS (
    SELECT u.id AS unidade_id, u.nome AS unidade_nome, coalesce(r.dmg, 0)::int AS diagnosticos
    FROM public.unidades u
    LEFT JOIN public._rastreio_dmg_gg(v_unidades, p_data_inicio, p_data_fim) r ON r.unidade_id = u.id
    WHERE u.id = ANY(v_unidades)
  )
  SELECT unidade_id, unidade_nome, diagnosticos INTO v_menos
  FROM dmg ORDER BY diagnosticos ASC, unidade_nome ASC LIMIT 1;

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
$function$;