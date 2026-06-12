CREATE OR REPLACE FUNCTION public.get_painel_gargalos_detalhado(
  p_unidade_id uuid,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
BEGIN
  -- Grupo A: gestantes ativas com registro de atendimento mas sem GJ/plasmatica
  WITH base AS (
    SELECT p.id, p.nome, p.dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND p.dum IS NOT NULL
      AND p.dum >= (CURRENT_DATE - INTERVAL '280 days')
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
      (CURRENT_DATE - b.dum)::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC), '[]'::jsonb)
  INTO v_a
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC LIMIT p_limit) e;

  -- Grupo B: IG >= 28sem (DUM <= hoje-196d) sem GTT 75g
  WITH base AS (
    SELECT p.id, p.nome, p.dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND p.dum IS NOT NULL
      AND p.dum >= (CURRENT_DATE - INTERVAL '280 days')
      AND p.dum <= (CURRENT_DATE - INTERVAL '196 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.paciente_id = p.id AND eg.tipo_exame ILIKE '%gtt%'
      )
  ),
  enriched AS (
    SELECT
      b.id AS paciente_id,
      b.nome,
      (CURRENT_DATE - b.dum)::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC), '[]'::jsonb)
  INTO v_b
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC LIMIT p_limit) e;

  -- Grupo C: DMG confirmado sem retorno >=14d
  WITH base AS (
    SELECT p.id, p.nome, p.dum, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = p_unidade_id
      AND p.is_rascunho = false
      AND p.dum IS NOT NULL
      AND p.dum >= (CURRENT_DATE - INTERVAL '280 days')
      AND EXISTS (
        SELECT 1 FROM public.laudos l
        WHERE l.paciente_id = p.id
          AND l.cenario_clinico IN ('cenario_1','cenario_6','cenario_6b')
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
      (CURRENT_DATE - f.dum)::int AS ig_atual_dias,
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
$$;