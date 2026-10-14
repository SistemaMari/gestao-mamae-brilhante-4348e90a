-- ============================================================
-- Painéis do gestor de unidade e do gestor geral: "gestantes ativas" passa a
-- significar EM ACOMPANHAMENTO — a mesma regra das listas do app
-- (isPacienteEncerrada em src/lib/fichaUtils.ts). Antes contava toda gestante
-- com DUM nos últimos 280 dias, inclusive encerradas (parto, aborto, não
-- retornou, insulinização) e com DMG afastado, então o painel não batia com a
-- lista de fichas.
--
-- Muda (sobre as definições vigentes de 20260518150113 + literais de 20261013120000):
--  • gestantes ativas / distribuição por profissional / profissionais ativos:
--    só em acompanhamento (operacao, visao_geral, ranking, consolidador_operacao,
--    metricas_consolidadas — inclusive o período anterior da variação).
--  • gargalos (unidade e rede): ignoram encerradas; "GTT em atraso" só conta
--    quem ainda está no rastreamento (aguardando GJ/GTT) — quem já teve DMG
--    diagnosticado pela GJ não precisa de GTT.
--  • "em insulina": DMG com encerramento por insulinização (antes contava os
--    cenários 3/4/7, que incluem perfil inadequado sem insulina e Ficha E).
--  • get_painel_gargalos_detalhado: SECURITY DEFINER + checagem de acesso
--    (sob RLS o nome da profissional saía vazio no PDF).
-- NÃO muda: prevalência de DMG (denominador = gestantes da unidade com DUM
-- nos últimos 280 dias, inclusive encerradas — é a coorte rastreada) e tendência.
-- Gerada a partir das definições vigentes; testada em PGlite.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

-- Em acompanhamento = sem motivo de encerramento e sem status terminal.
-- Espelha isPacienteEncerrada/resolverMotivoEfetivo (src/lib/fichaUtils.ts).
CREATE OR REPLACE FUNCTION public.paciente_em_acompanhamento(p_status_ficha text, p_motivo_encerramento text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT p_motivo_encerramento IS NULL
     AND coalesce(p_status_ficha, '') NOT IN
         ('dmg_afastado', 'encerrada_insulinizacao', 'resultado_parto', 'encaminhada_endocrino');
$$;
GRANT EXECUTE ON FUNCTION public.paciente_em_acompanhamento(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_painel_operacao(p_unidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    AND public.dum_efetiva(id) IS NOT NULL
    AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
    AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text);

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
     AND public.dum_efetiva(pa.id) IS NOT NULL
     AND public.dum_efetiva(pa.id) >= (CURRENT_DATE - INTERVAL '280 days')
     AND public.paciente_em_acompanhamento(pa.status_ficha, pa.motivo_encerramento::text)
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

CREATE OR REPLACE FUNCTION public.get_painel_gargalos(p_unidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    SELECT id, public.dum_efetiva(id) AS dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND public.dum_efetiva(id) IS NOT NULL
      AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
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
    SELECT id, public.dum_efetiva(id) AS dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND public.dum_efetiva(id) IS NOT NULL
      AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
  )
  SELECT coalesce(array_agg(b.id), ARRAY[]::uuid[]) INTO v_b_ids
  FROM base b
  WHERE public.dum_efetiva(b.id) <= (CURRENT_DATE - INTERVAL '196 days')
  AND (SELECT px.status_ficha FROM public.pacientes px WHERE px.id = b.id) IN ('aguardando_gj','aguardando_gtt')
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
      AND public.dum_efetiva(id) IS NOT NULL
      AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
  ),
  dmg AS (
    SELECT DISTINCT l.paciente_id
    FROM public.laudos l
    WHERE l.paciente_id IN (SELECT id FROM base)
      AND l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')
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

CREATE OR REPLACE FUNCTION public.get_painel_gargalos_detalhado(p_unidade_id uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT p.id, p.nome, public.dum_efetiva(p.id) AS dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
      AND EXISTS (SELECT 1 FROM public.registros_atendimento ra WHERE ra.paciente_id = p.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = p.id
          AND (eg.tipo_exame ILIKE '%gj%' OR eg.tipo_exame = 'plasmatica')
      )
  ),
  enriched AS (
    SELECT
      b.id AS paciente_id,
      b.nome,
      (CURRENT_DATE - public.dum_efetiva(b.id))::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC), '[]'::jsonb)
  INTO v_a
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC LIMIT p_limit) e;

  WITH base AS (
    SELECT p.id, p.nome, public.dum_efetiva(p.id) AS dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
      AND public.dum_efetiva(p.id) <= (CURRENT_DATE - INTERVAL '196 days')
      AND p.status_ficha IN ('aguardando_gj','aguardando_gtt')
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = p.id AND eg.tipo_exame ILIKE '%gtt%'
      )
  ),
  enriched AS (
    SELECT
      b.id AS paciente_id,
      b.nome,
      (CURRENT_DATE - public.dum_efetiva(b.id))::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC), '[]'::jsonb)
  INTO v_b
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC LIMIT p_limit) e;

  WITH base AS (
    SELECT p.id, p.nome, public.dum_efetiva(p.id) AS dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
      AND EXISTS (
        SELECT 1 FROM public.laudos l
        WHERE l.paciente_id = p.id
          AND l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')
      )
  ),
  ult AS (
    SELECT ra.paciente_id, max(ra.created_at) AS ultima
    FROM public.registros_atendimento ra
    WHERE ra.paciente_id IN (SELECT id FROM base)
    GROUP BY ra.paciente_id
  ),
  filtered AS (
    SELECT b.*, u.ultima
    FROM base b
    LEFT JOIN ult u ON u.paciente_id = b.id
    WHERE u.ultima IS NULL OR u.ultima <= (NOW() - INTERVAL '14 days')
  ),
  enriched AS (
    SELECT
      f.id AS paciente_id,
      f.nome,
      (CURRENT_DATE - public.dum_efetiva(f.id))::int AS ig_atual_dias,
      f.ultima::date AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM filtered f
    LEFT JOIN public.profissionais pr ON pr.id = f.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ultima_consulta NULLS FIRST), '[]'::jsonb)
  INTO v_c
  FROM (SELECT * FROM enriched ORDER BY ultima_consulta NULLS FIRST LIMIT p_limit) e;

  RETURN jsonb_build_object(
    'sem_gj_primeira_consulta', v_a,
    'atrasadas_gtt', v_b,
    'confirmadas_sem_retorno', v_c
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_painel_perfil_clinico(p_unidade_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
           bool_or(l.cenario_clinico IN ('3','4','7','cenario_3','cenario_4','cenario_7')) AS em_insulina
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
    (SELECT count(*) FROM base WHERE dmg_gestacao_anterior = true)
  INTO v_total, v_dmg, v_insulina, v_anterior;

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

CREATE OR REPLACE FUNCTION public.get_consolidador_gargalos_gestor_geral(p_data_inicio date, p_data_fim date, p_unidades uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      SELECT id, public.dum_efetiva(id) AS dum, unidade_id
      FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND public.dum_efetiva(id) IS NOT NULL
        AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
        AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
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
      SELECT id, public.dum_efetiva(id) AS dum FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND public.dum_efetiva(id) IS NOT NULL
        AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
        AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
    )
    SELECT count(*) INTO v_b
    FROM base b
    WHERE public.dum_efetiva(b.id) <= (CURRENT_DATE - INTERVAL '196 days')
    AND (SELECT px.status_ficha FROM public.pacientes px WHERE px.id = b.id) IN ('aguardando_gj','aguardando_gtt')
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = b.id
          AND eg.tipo_exame ILIKE '%gtt%'
      );

    WITH base AS (
      SELECT id FROM public.pacientes
      WHERE unidade_id = ANY(v_unidades)
        AND is_rascunho = false
        AND public.dum_efetiva(id) IS NOT NULL
        AND public.dum_efetiva(id) >= (CURRENT_DATE - INTERVAL '280 days')
        AND public.paciente_em_acompanhamento(status_ficha, motivo_encerramento::text)
    ),
    dmg AS (
      SELECT DISTINCT l.paciente_id
      FROM public.laudos l
      WHERE l.paciente_id IN (SELECT id FROM base)
        AND l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b')
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
      'label', 'GTT 75g em atraso',
      'severidade', 'laranja'
    ),
    'confirmadas_sem_retorno', jsonb_build_object(
      'count', coalesce(v_c, 0),
      'label', 'DMG confirmado sem retorno',
      'severidade', 'vermelho'
    )
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

  SELECT count(*)::int,
         count(*) FILTER (WHERE l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b'))::int
    INTO v_le, v_dmg
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = ANY(v_unidades)
    AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;

  SELECT count(*)::int INTO v_partos
  FROM public.partos pa
  WHERE pa.unidade_id = ANY(v_unidades)
    AND pa.is_rascunho = false
    AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim;

  SELECT count(DISTINCT p.profissional_id)::int INTO v_prof
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false;

  SELECT count(*)::int INTO v_pa_ant
  FROM public.pacientes p
  WHERE p.unidade_id = ANY(v_unidades)
    AND p.is_rascunho = false
    AND public.dum_efetiva(p.id) IS NOT NULL
    AND public.dum_efetiva(p.id) BETWEEN (v_ant_fim - INTERVAL '280 days')::date AND v_ant_fim
    AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text);

  SELECT count(*)::int,
         count(*) FILTER (WHERE l.cenario_clinico IN ('1','6','6B','cenario_1','cenario_6','cenario_6b'))::int
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
    SELECT pa.unidade_id,
           avg(pa.data_parto - public.dum_efetiva(p.id))::numeric AS media_dias
    FROM public.partos pa
    JOIN public.pacientes p ON p.id = pa.paciente_id
    WHERE pa.unidade_id = ANY(v_unidades)
      AND pa.is_rascunho = false
      AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim
      AND public.dum_efetiva(p.id) IS NOT NULL
    GROUP BY pa.unidade_id
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
    CASE WHEN coalesce(l.total, 0) = 0 THEN 0::numeric
         ELSE round(coalesce(l.dmg,0)::numeric / l.total * 100, 1) END,
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
$function$;

REVOKE ALL ON FUNCTION public.get_painel_gargalos_detalhado(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_gargalos_detalhado(uuid, integer) TO authenticated;
