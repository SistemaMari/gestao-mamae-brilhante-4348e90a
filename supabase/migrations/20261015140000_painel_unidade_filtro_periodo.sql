-- ============================================================
-- Painel do gestor de unidade com FILTRO DE PERÍODO (mesmos presets do
-- gestor geral: 7d/30d/90d/12m/ano/personalizado).
--
-- As 3 RPCs do painel que dependem de período ganham dois parâmetros
-- OPCIONAIS no fim: p_data_inicio date, p_data_fim date (DEFAULT NULL).
-- Com os dois NULL o resultado é EXATAMENTE o de antes (janelas fixas:
-- DUM 280 dias, laudos 30 dias, IG 90 dias, tendência 6 meses) — quem chama
-- só com p_unidade_id (Equipe, PDF, drill-down antigo) não muda.
--
--  • get_painel_operacao: + 'laudos_periodo' (laudos emitidos no período) e
--    'periodo'. Gestantes ativas e distribuição por profissional continuam
--    sendo a situação de HOJE (não dependem de período).
--  • get_painel_perfil_clinico: com período, usa a MESMA regra do gestor
--    geral (consolidador): base = gestantes rastreadas no período (Retorno 1
--    ou GTT com data no período); diagnóstico = DMG ou overt nessas consultas;
--    insulina = dessas, encerradas por insulinização; DMG anterior = das
--    rastreadas; IG ao diagnóstico = na 1ª consulta que confirmou o
--    diagnóstico dentro do período. Devolve 'base' = 'periodo' (ou
--    'dum_280d' sem período) para a tela ajustar os textos.
--  • get_painel_tendencia: com período, os meses vão do mês do início ao mês
--    do fim (no mínimo 6 meses, no máximo 24, terminando no mês do fim).
--  • get_painel_gargalos: NÃO muda — gargalo é situação de hoje.
--
-- Mudar a lista de parâmetros cria outra função no Postgres; por isso a
-- versão antiga (só uuid) é removida antes (senão a chamada com 1 argumento
-- ficaria ambígua). Mesma autorização de antes (_pode_ver_unidade).
--
-- ⚠️ Lista de DMG com OVERT ('8'/'cenario_8'), como no banco desde
--    20261015090000 (que alterou as funções em tempo de execução).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015090000. Idempotente.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_painel_operacao(uuid);
DROP FUNCTION IF EXISTS public.get_painel_perfil_clinico(uuid);
DROP FUNCTION IF EXISTS public.get_painel_tendencia(uuid);

CREATE OR REPLACE FUNCTION public.get_painel_operacao(
  p_unidade_id uuid,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gestantes_ativas integer;
  v_laudos_30d integer;
  v_laudos_periodo integer;
  v_distribuicao jsonb;
  v_com_periodo boolean := p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL;
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

  IF v_com_periodo THEN
    SELECT count(*) INTO v_laudos_periodo
    FROM public.laudos l
    JOIN public.pacientes p ON p.id = l.paciente_id
    WHERE p.unidade_id = p_unidade_id
      AND l.created_at::date BETWEEN p_data_inicio AND p_data_fim;
  ELSE
    v_laudos_periodo := v_laudos_30d;
  END IF;

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
    'laudos_periodo', coalesce(v_laudos_periodo, 0),
    'periodo', CASE WHEN v_com_periodo
                    THEN jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim)
                    ELSE NULL END,
    'distribuicao_profissionais', v_distribuicao
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_painel_perfil_clinico(
  p_unidade_id uuid,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
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
  v_com_periodo boolean := p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  IF v_com_periodo THEN
    -- Mesma base do gestor geral: gestantes rastreadas no período.
    WITH rastreio AS (
      SELECT c.paciente_id,
             bool_or(c.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')) AS tem_dmg,
             bool_or(c.cenario_clinico IN ('8','cenario_8')) AS tem_overt
      FROM public.consultas c
      JOIN public.pacientes p ON p.id = c.paciente_id
      WHERE p.unidade_id = p_unidade_id
        AND p.is_rascunho = false
        AND c.is_rascunho = false
        AND c.tipo IN ('retorno_1', 'gtt')
        AND c.data BETWEEN p_data_inicio AND p_data_fim
      GROUP BY c.paciente_id
    )
    SELECT count(*),
           count(*) FILTER (WHERE r.tem_dmg),
           count(*) FILTER (WHERE r.tem_overt),
           count(*) FILTER (WHERE r.tem_dmg
             AND (p.motivo_encerramento::text = 'insulinizacao'
                  OR p.status_ficha IN ('encerrada_insulinizacao','encaminhada_endocrino'))),
           count(*) FILTER (WHERE p.dmg_gestacao_anterior = true)
      INTO v_total, v_dmg, v_overt, v_insulina, v_anterior
    FROM rastreio r
    JOIN public.pacientes p ON p.id = r.paciente_id;

    SELECT avg(d.data - public.dum_efetiva(d.paciente_id))::int
      INTO v_ig_dias
    FROM (
      SELECT DISTINCT ON (c.paciente_id) c.paciente_id, c.data
      FROM public.consultas c
      JOIN public.pacientes p ON p.id = c.paciente_id
      WHERE p.unidade_id = p_unidade_id
        AND p.is_rascunho = false
        AND c.is_rascunho = false
        AND c.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')
        AND c.data BETWEEN p_data_inicio AND p_data_fim
      ORDER BY c.paciente_id, c.data
    ) d
    WHERE public.dum_efetiva(d.paciente_id) IS NOT NULL;
  ELSE
    -- Sem período: comportamento anterior (DUM nos últimos 280 dias).
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
             bool_or(l.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')) AS tem_dmg,
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
      AND l.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')
      AND l.created_at >= (NOW() - INTERVAL '90 days')
      AND public.dum_efetiva(p.id) IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'base', CASE WHEN v_com_periodo THEN 'periodo' ELSE 'dum_280d' END,
    'periodo', CASE WHEN v_com_periodo
                    THEN jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim)
                    ELSE NULL END,
    'total_acompanhadas', coalesce(v_total, 0),
    'total_dmg_confirmadas', coalesce(v_dmg, 0),
    -- Overt (diabetes prévio, cenário 8): já incluído no total acima.
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

CREATE OR REPLACE FUNCTION public.get_painel_tendencia(
  p_unidade_id uuid,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultado jsonb;
  v_meses_pt text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  v_mes_fim date;
  v_mes_ini date;
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;

  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL THEN
    v_mes_fim := date_trunc('month', p_data_fim)::date;
    -- No mínimo 6 meses (para ter tendência), no máximo 24.
    v_mes_ini := greatest(
      least(date_trunc('month', p_data_inicio)::date, (v_mes_fim - INTERVAL '5 months')::date),
      (v_mes_fim - INTERVAL '23 months')::date
    );
  ELSE
    v_mes_fim := date_trunc('month', NOW())::date;
    v_mes_ini := (v_mes_fim - INTERVAL '5 months')::date;
  END IF;

  WITH meses AS (
    SELECT
      date_trunc('month', d)::date AS mes_inicio,
      (date_trunc('month', d) + INTERVAL '1 month - 1 day')::date AS mes_fim
    FROM generate_series(v_mes_ini::timestamp, v_mes_fim::timestamp, INTERVAL '1 month') d
  ),
  base_pacientes AS (
    SELECT id, public.dum_efetiva(id) AS dum
    FROM public.pacientes
    WHERE unidade_id = p_unidade_id
      AND is_rascunho = false
      AND public.dum_efetiva(id) IS NOT NULL
  ),
  gest_mes AS (
    SELECT m.mes_inicio AS mes, count(bp.id) AS total
    FROM meses m
    LEFT JOIN base_pacientes bp
      ON public.dum_efetiva(bp.id) <= m.mes_fim
     AND public.dum_efetiva(bp.id) >= (m.mes_fim - INTERVAL '280 days')
    GROUP BY m.mes_inicio
  ),
  dmg_mes AS (
    SELECT m.mes_inicio AS mes, count(DISTINCT l.paciente_id) AS total
    FROM meses m
    LEFT JOIN public.laudos l
      ON l.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')
     AND l.created_at::date <= m.mes_fim
    LEFT JOIN public.pacientes p
      ON p.id = l.paciente_id
     AND p.unidade_id = p_unidade_id
     AND p.is_rascunho = false
     AND public.dum_efetiva(p.id) IS NOT NULL
     AND public.dum_efetiva(p.id) <= m.mes_fim
     AND public.dum_efetiva(p.id) >= (m.mes_fim - INTERVAL '280 days')
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

REVOKE ALL ON FUNCTION public.get_painel_operacao(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_painel_perfil_clinico(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_painel_tendencia(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_operacao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_painel_perfil_clinico(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_painel_tendencia(uuid, date, date) TO authenticated;
