-- ============================================================
-- Painel Estratégico do Gestor de Unidade — 4 RPCs
-- DMG = cenarios 1, 6, 6b — mesma definição de metricas_diagnosticos_admin.
-- Cenário 8 (overt) excluído da contagem.
-- Gestante ativa = DUM nos últimos 280 dias. Não filtra por status_ficha
-- intencionalmente — métrica baseada em verdade biológica para resistir
-- a evolução do schema.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_painel_operacao(uuid);
DROP FUNCTION IF EXISTS public.get_painel_perfil_clinico(uuid);
DROP FUNCTION IF EXISTS public.get_painel_gargalos(uuid);
DROP FUNCTION IF EXISTS public.get_painel_tendencia(uuid);

-- ------------------------------------------------------------
-- 3.1 get_painel_operacao
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_painel_operacao(p_unidade_id uuid)
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
  v_gestantes_ativas integer;
  v_laudos_30d integer;
  v_distribuicao jsonb;
BEGIN
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
    SELECT pr.id AS profissional_id,
           pr.nome,
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
$$;

-- ------------------------------------------------------------
-- 3.2 get_painel_perfil_clinico
-- ------------------------------------------------------------
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
-- Insulina ativa = paciente com laudo cenario_3 OR cenario_4 OR cenario_7
-- (mesma convenção de metricas_diagnosticos_admin).
DECLARE
  v_total integer;
  v_dmg integer;
  v_insulina integer;
  v_anterior integer;
  v_ig_dias integer;
BEGIN
  -- Base: gestantes ativas da unidade
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

  -- IG média no diagnóstico (últimos 90 dias) — em dias
  SELECT avg(EXTRACT(EPOCH FROM (l.created_at::date - p.dum)) / 86400.0)::int
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

-- ------------------------------------------------------------
-- 3.3 get_painel_gargalos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_painel_gargalos(p_unidade_id uuid)
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
  v_a_ids uuid[];
  v_b_ids uuid[];
  v_c_ids uuid[];
BEGIN
  -- Base: gestantes ativas
  WITH base AS (
    SELECT id, dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND dum IS NOT NULL
      AND dum >= (CURRENT_DATE - INTERVAL '280 days')
  )
  -- Grupo A: tem registro de atendimento mas nenhum exame GJ (plasmatica)
  SELECT coalesce(array_agg(b.id), ARRAY[]::uuid[]) INTO v_a_ids
  FROM base b
  WHERE EXISTS (SELECT 1 FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.exames_glicemia eg
      WHERE eg.paciente_id = b.id
        AND (eg.tipo_exame ILIKE '%gj%' OR eg.tipo_exame = 'plasmatica')
    );

  -- Grupo B: IG >= 28 sem (DUM <= hoje - 196 dias) sem GTT registrado
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

  -- Grupo C: DMG confirmado, último registro_atendimento >= 14 dias atrás
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
$$;

-- ------------------------------------------------------------
-- 3.4 get_painel_tendencia
-- ------------------------------------------------------------
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
-- "Total gestantes do mês" = pacientes cuja primeira entrada em
-- registros_atendimento ocorreu naquele mês (proxy de "primeira consulta").
DECLARE
  v_resultado jsonb;
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
    'mes_label', initcap(to_char(m.mes, 'TMMon/YY')),
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