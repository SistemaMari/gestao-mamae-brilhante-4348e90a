
-- =============================================================
-- 1) RLS SELECT-only para Gestor Geral nas 3 tabelas faltantes
-- =============================================================

DROP POLICY IF EXISTS "Gestor geral ve pacientes das unidades vinculadas" ON public.pacientes;
CREATE POLICY "Gestor geral ve pacientes das unidades vinculadas"
ON public.pacientes
FOR SELECT
TO authenticated
USING (
  unidade_id IS NOT NULL
  AND public.is_gestor_geral(auth.uid())
  AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
);

DROP POLICY IF EXISTS "Gestor geral ve laudos das unidades vinculadas" ON public.laudos;
CREATE POLICY "Gestor geral ve laudos das unidades vinculadas"
ON public.laudos
FOR SELECT
TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = laudos.paciente_id
      AND p.unidade_id IS NOT NULL
      AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

DROP POLICY IF EXISTS "Gestor geral ve exames das unidades vinculadas" ON public.exames_glicemia;
CREATE POLICY "Gestor geral ve exames das unidades vinculadas"
ON public.exames_glicemia
FOR SELECT
TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = exames_glicemia.paciente_id
      AND p.unidade_id IS NOT NULL
      AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

-- =============================================================
-- 2) Helper: validação tripla de acesso à unidade
-- =============================================================

CREATE OR REPLACE FUNCTION public._pode_ver_unidade(_user uuid, _unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user)
    OR public.gestor_da_unidade(_user, _unidade)
    OR (public.is_gestor_geral(_user) AND public.gestor_geral_tem_unidade(_user, _unidade));
$$;

-- =============================================================
-- 3) Refazer as 4 RPCs do painel de unidade como SECURITY DEFINER
--    com validação tripla de chamador
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_painel_operacao(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_gestantes_ativas integer;
  v_laudos_30d integer;
  v_distribuicao jsonb;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_gestantes_ativas
  FROM public.pacientes
  WHERE unidade_id = p_unidade_id
    AND is_rascunho = false
    AND dum IS NOT NULL
    AND dum >= (CURRENT_DATE - INTERVAL '280 days');

  SELECT count(*) INTO v_laudos_30d
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = p_unidade_id
    AND l.created_at >= (NOW() - INTERVAL '30 days');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'profissional_id', t.profissional_id,
           'nome', t.nome,
           'total_pacientes_ativos', t.total
         ) ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_distribuicao
  FROM (
    SELECT pr.id AS profissional_id, pr.nome,
           count(pa.id) AS total
    FROM public.profissionais pr
    LEFT JOIN public.pacientes pa
      ON pa.profissional_id = pr.id
     AND pa.unidade_id = p_unidade_id
     AND pa.is_rascunho = false
     AND pa.dum IS NOT NULL
     AND pa.dum >= (CURRENT_DATE - INTERVAL '280 days')
    WHERE pr.unidade_id = p_unidade_id
      AND pr.acesso_revogado = false
    GROUP BY pr.id, pr.nome
  ) t;

  RETURN jsonb_build_object(
    'gestantes_ativas', coalesce(v_gestantes_ativas, 0),
    'laudos_30d', coalesce(v_laudos_30d, 0),
    'distribuicao_profissionais', v_distribuicao
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_painel_perfil_clinico(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total integer;
  v_dmg integer;
  v_insulina integer;
  v_anterior integer;
  v_ig_dias integer;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

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

CREATE OR REPLACE FUNCTION public.get_painel_gargalos(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_a_ids uuid[];
  v_b_ids uuid[];
  v_c_ids uuid[];
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT id, dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
      AND dum >= (CURRENT_DATE - INTERVAL '280 days')
  )
  SELECT coalesce(array_agg(b.id), ARRAY[]::uuid[]) INTO v_a_ids
  FROM base b
  WHERE EXISTS (SELECT 1 FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.exames_glicemia eg
      WHERE eg.paciente_id = b.id
        AND (eg.tipo_exame ILIKE '%gj%' OR eg.tipo_exame = 'plasmatica')
    );

  WITH base AS (
    SELECT id, dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
      AND dum >= (CURRENT_DATE - INTERVAL '280 days')
  )
  SELECT coalesce(array_agg(b.id), ARRAY[]::uuid[]) INTO v_b_ids
  FROM base b
  WHERE b.dum <= (CURRENT_DATE - INTERVAL '196 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.exames_glicemia eg
      WHERE eg.paciente_id = b.id
        AND eg.tipo_exame ILIKE '%gtt%'
    );

  WITH base AS (
    SELECT id
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
      AND dum >= (CURRENT_DATE - INTERVAL '280 days')
  ),
  dmg AS (
    SELECT DISTINCT l.paciente_id
    FROM public.laudos l
    WHERE l.paciente_id IN (SELECT id FROM base)
      AND l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
  ),
  ult AS (
    SELECT ra.paciente_id, max(ra.created_at) AS ultima
    FROM public.registros_atendimento ra
    WHERE ra.paciente_id IN (SELECT paciente_id FROM dmg)
    GROUP BY ra.paciente_id
  )
  SELECT coalesce(array_agg(d.paciente_id), ARRAY[]::uuid[]) INTO v_c_ids
  FROM dmg d
  LEFT JOIN ult u ON u.paciente_id = d.paciente_id
  WHERE u.ultima IS NULL OR u.ultima <= (NOW() - INTERVAL '14 days');

  RETURN jsonb_build_object(
    'sem_gj_primeira_consulta', jsonb_build_object(
      'count', coalesce(array_length(v_a_ids, 1), 0),
      'paciente_ids', to_jsonb(v_a_ids)
    ),
    'atrasadas_gtt', jsonb_build_object(
      'count', coalesce(array_length(v_b_ids, 1), 0),
      'paciente_ids', to_jsonb(v_b_ids)
    ),
    'confirmadas_sem_retorno', jsonb_build_object(
      'count', coalesce(array_length(v_c_ids, 1), 0),
      'paciente_ids', to_jsonb(v_c_ids)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_painel_tendencia(p_unidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_resultado jsonb;
  v_meses_pt text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

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
    'prevalencia_pct', CASE WHEN coalesce(g.total,0)=0 THEN 0
                            ELSE round(coalesce(d.total,0)::numeric / g.total * 100, 1) END
  ) ORDER BY m.mes_inicio), '[]'::jsonb)
  INTO v_resultado
  FROM meses m
  LEFT JOIN gest_mes g ON g.mes = m.mes_inicio
  LEFT JOIN dmg_mes d ON d.mes = m.mes_inicio;

  RETURN v_resultado;
END;
$function$;

-- =============================================================
-- 4) Helper: resolver unidades efetivas do gestor geral
--    Retorna interseção entre unidades vinculadas e p_unidades (ou todas se NULL)
-- =============================================================

CREATE OR REPLACE FUNCTION public._unidades_gg(_user uuid, _unidades uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vinc AS (
    SELECT ggu.unidade_id
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = _user
  )
  SELECT coalesce(array_agg(unidade_id), ARRAY[]::uuid[])
  FROM vinc
  WHERE _unidades IS NULL OR unidade_id = ANY(_unidades);
$$;

-- =============================================================
-- 5) RPCs do consolidador do Gestor Geral
--    Janela parametrizada via p_data_inicio / p_data_fim.
--    Diferente do painel do gestor de unidade (fixo 30d) — proposital.
-- =============================================================

-- 5.1 Visão geral por unidade
CREATE OR REPLACE FUNCTION public.get_visao_geral_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
)
RETURNS TABLE (
  unidade_id uuid,
  unidade_nome text,
  gestor_nome text,
  pacientes_ativos integer,
  laudos_emitidos integer,
  partos_registrados integer,
  profissionais_ativos integer,
  taxa_dmg_positivo_pct numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- Diferente do painel do gestor de unidade (fixo 30d) — proposital.
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
      AND p.dum IS NOT NULL
      AND p.dum >= (CURRENT_DATE - INTERVAL '280 days')
    GROUP BY p.unidade_id
  ),
  laud AS (
    SELECT p.unidade_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b'))::int AS dmg
    FROM public.laudos l
    JOIN public.pacientes p ON p.id = l.paciente_id
    WHERE p.unidade_id = ANY(v_unidades)
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim
    GROUP BY p.unidade_id
  ),
  par AS (
    SELECT pa.unidade_id, count(*)::int AS total
    FROM public.partos pa
    WHERE pa.unidade_id = ANY(v_unidades)
      AND pa.is_rascunho = false
      AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim
    GROUP BY pa.unidade_id
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
          AND pp.dum IS NOT NULL
          AND pp.dum >= (CURRENT_DATE - INTERVAL '280 days')
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
    CASE WHEN coalesce(l.total,0) = 0 THEN 0
         ELSE round(coalesce(l.dmg,0)::numeric / l.total * 100, 1) END
  FROM unids u
  LEFT JOIN gestor g ON g.unidade_id = u.id
  LEFT JOIN pac pc ON pc.unidade_id = u.id
  LEFT JOIN laud l ON l.unidade_id = u.id
  LEFT JOIN par pa ON pa.unidade_id = u.id
  LEFT JOIN prof pr ON pr.unidade_id = u.id
  ORDER BY u.nome;
END;
$$;

-- 5.2 Consolidador de operação
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
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- Diferente do painel do gestor de unidade (fixo 30d) — proposital.
DECLARE
  v_unidades uuid[];
  v_partos integer;
  v_prof integer;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object('partos_registrados', 0, 'profissionais_ativos', 0);
  END IF;

  SELECT count(*) INTO v_partos
  FROM public.partos pa
  WHERE pa.unidade_id = ANY(v_unidades)
    AND pa.is_rascunho = false
    AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim;

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
    'partos_registrados', coalesce(v_partos, 0),
    'profissionais_ativos', coalesce(v_prof, 0)
  );
END;
$$;

-- 5.3 Consolidador de perfil clínico
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
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- Diferente do painel do gestor de unidade (fixo 30d) — proposital.
DECLARE
  v_unidades uuid[];
  v_total_laudos integer;
  v_dmg integer;
  v_ig_dias numeric;
  v_dum_diag numeric;
  v_fechamento numeric;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'taxa_dmg_positivo_pct', 0,
      'ig_media_diagnostico_dias', NULL,
      'tempo_medio_dum_diagnostico_dias', NULL,
      'tempo_medio_fechamento_dias', NULL
    );
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')),
    avg(l.created_at::date - p.dum) FILTER (
      WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b') AND p.dum IS NOT NULL
    ),
    avg(l.created_at::date - p.dum) FILTER (
      WHERE l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b') AND p.dum IS NOT NULL
    )
  INTO v_total_laudos, v_dmg, v_ig_dias, v_dum_diag
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

  RETURN jsonb_build_object(
    'taxa_dmg_positivo_pct', CASE WHEN coalesce(v_total_laudos,0)=0 THEN 0
                                  ELSE round(v_dmg::numeric / v_total_laudos * 100, 1) END,
    'ig_media_diagnostico_dias', CASE WHEN v_ig_dias IS NULL THEN NULL ELSE round(v_ig_dias, 1) END,
    'tempo_medio_dum_diagnostico_dias', CASE WHEN v_dum_diag IS NULL THEN NULL ELSE round(v_dum_diag, 1) END,
    'tempo_medio_fechamento_dias', CASE WHEN v_fechamento IS NULL THEN NULL ELSE round(v_fechamento, 1) END
  );
END;
$$;

-- 5.4 Consolidador de gargalos
CREATE OR REPLACE FUNCTION public.get_consolidador_gargalos_gestor_geral(
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
-- Janela parametrizada via p_data_inicio / p_data_fim.
-- Definições idênticas a get_painel_gargalos (gestor de unidade) — labels e cores
-- alinhados com BlocoGargalos.tsx para evitar discrepância visual entre painéis.
-- Não retorna paciente_ids — gestor geral não tem drill-down de paciente.
DECLARE
  v_unidades uuid[];
  v_a integer;
  v_b integer;
  v_c integer;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    v_a := 0; v_b := 0; v_c := 0;
  ELSE
    WITH base AS (
      SELECT id, dum, unidade_id
      FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND dum IS NOT NULL
        AND dum >= (CURRENT_DATE - INTERVAL '280 days')
    )
    SELECT count(*) INTO v_a
    FROM base b
    WHERE EXISTS (SELECT 1 FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = b.id
          AND (eg.tipo_exame ILIKE '%gj%' OR eg.tipo_exame = 'plasmatica')
      );

    WITH base AS (
      SELECT id, dum FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND dum IS NOT NULL
        AND dum >= (CURRENT_DATE - INTERVAL '280 days')
    )
    SELECT count(*) INTO v_b
    FROM base b
    WHERE b.dum <= (CURRENT_DATE - INTERVAL '196 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = b.id
          AND eg.tipo_exame ILIKE '%gtt%'
      );

    WITH base AS (
      SELECT id FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND dum IS NOT NULL
        AND dum >= (CURRENT_DATE - INTERVAL '280 days')
    ),
    dmg AS (
      SELECT DISTINCT l.paciente_id
      FROM public.laudos l
      WHERE l.paciente_id IN (SELECT id FROM base)
        AND l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
    ),
    ult AS (
      SELECT ra.paciente_id, max(ra.created_at) AS ultima
      FROM public.registros_atendimento ra
      WHERE ra.paciente_id IN (SELECT paciente_id FROM dmg)
      GROUP BY ra.paciente_id
    )
    SELECT count(*) INTO v_c
    FROM dmg d
    LEFT JOIN ult u ON u.paciente_id = d.paciente_id
    WHERE u.ultima IS NULL OR u.ultima <= (NOW() - INTERVAL '14 days');
  END IF;

  RETURN jsonb_build_object(
    'sem_gj_primeira_consulta', jsonb_build_object(
      'count', coalesce(v_a, 0),
      'label', 'Sem GJ na primeira consulta',
      'severidade', 'amarelo'
    ),
    'atrasadas_gtt', jsonb_build_object(
      'count', coalesce(v_b, 0),
      'label', 'GTT em atraso',
      'severidade', 'laranja'
    ),
    'confirmadas_sem_retorno', jsonb_build_object(
      'count', coalesce(v_c, 0),
      'label', 'DMG confirmado sem retorno',
      'severidade', 'vermelho'
    )
  );
END;
$$;

-- 5.5 Consolidador de tendência (12 meses)
CREATE OR REPLACE FUNCTION public.get_consolidador_tendencia_gestor_geral(
  p_unidades uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
-- Série de 12 meses (cross-rede). Não usa janela parametrizada — é fotografia mensal.
DECLARE
  v_unidades uuid[];
  v_resultado jsonb;
  v_meses_pt text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH meses AS (
    SELECT
      date_trunc('month', d)::date AS mes_inicio,
      (date_trunc('month', d) + INTERVAL '1 month - 1 day')::date AS mes_fim
    FROM generate_series(
      date_trunc('month', NOW()) - INTERVAL '11 months',
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) d
  ),
  base_pacientes AS (
    SELECT id, dum
    FROM public.pacientes
    WHERE unidade_id = ANY(v_unidades)
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
     AND p.unidade_id = ANY(v_unidades)
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
    'prevalencia_pct', CASE WHEN coalesce(g.total,0)=0 THEN 0
                            ELSE round(coalesce(d.total,0)::numeric / g.total * 100, 1) END
  ) ORDER BY m.mes_inicio), '[]'::jsonb)
  INTO v_resultado
  FROM meses m
  LEFT JOIN gest_mes g ON g.mes = m.mes_inicio
  LEFT JOIN dmg_mes d ON d.mes = m.mes_inicio;

  RETURN v_resultado;
END;
$$;

-- =============================================================
-- 6) Permissões: liberar EXECUTE para usuários autenticados
-- =============================================================

GRANT EXECUTE ON FUNCTION public.get_visao_geral_gestor_geral(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidador_operacao_gestor_geral(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidador_gargalos_gestor_geral(date, date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_consolidador_tendencia_gestor_geral(uuid[]) TO authenticated;
