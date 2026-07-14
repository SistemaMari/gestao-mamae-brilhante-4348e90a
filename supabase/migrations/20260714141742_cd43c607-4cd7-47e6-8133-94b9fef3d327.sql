CREATE OR REPLACE FUNCTION public.metricas_diagnosticos_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
  v_total_gestantes integer := 0;
  v_total_dmg integer := 0;
  v_total_overt integer := 0;
  v_total_dieta integer := 0;
  v_total_insulina_ok integer := 0;
  v_total_cenario7 integer := 0;
  v_mev_base integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base_pacientes AS (
    SELECT p.id, p.estado, p.cidade, p.unidade_id,
           p.dmg_gestacao_anterior, p.created_at
    FROM public.pacientes p
    WHERE p.is_rascunho = false
  ),
  cenarios_por_paciente AS (
    SELECT
      c.paciente_id,
      bool_or(c.cenario_clinico IN ('1','6','6B'))      AS tem_dmg,
      bool_or(c.cenario_clinico IN ('8','8'))           AS tem_overt,
      bool_or(c.cenario_clinico = '1')                  AS dx_retorno1,
      bool_or(c.cenario_clinico = '6')                  AS dx_gtt_janela,
      bool_or(c.cenario_clinico = '6B')                 AS dx_gtt_tardio,
      bool_or(c.cenario_clinico = '3')                  AS iniciou_insulina,
      bool_or(c.cenario_clinico = '4')                  AS insulina_ok,
      bool_or(c.cenario_clinico = '7')                  AS cenario7,
      avg(CASE WHEN c.cenario_clinico='1'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_retorno1,
      avg(CASE WHEN c.cenario_clinico='6'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_gtt_janela,
      avg(CASE WHEN c.cenario_clinico='6B'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_gtt_tardio
    FROM public.consultas c
    WHERE c.is_rascunho = false
    GROUP BY c.paciente_id
  ),
  resumo AS (
    SELECT
      count(*)                                                 AS total,
      count(*) FILTER (WHERE cp.tem_dmg)                       AS dmg,
      count(*) FILTER (WHERE cp.tem_overt)                     AS overt,
      count(*) FILTER (WHERE cp.tem_dmg AND NOT cp.iniciou_insulina AND NOT cp.cenario7) AS so_dieta,
      count(*) FILTER (WHERE cp.iniciou_insulina AND cp.insulina_ok AND NOT cp.cenario7) AS insulina_ok,
      count(*) FILTER (WHERE cp.cenario7)                      AS cenario7
    FROM base_pacientes bp
    LEFT JOIN cenarios_por_paciente cp ON cp.paciente_id = bp.id
  )
  SELECT total, dmg, overt, so_dieta, insulina_ok, cenario7
  INTO v_total_gestantes, v_total_dmg, v_total_overt,
       v_total_dieta, v_total_insulina_ok, v_total_cenario7
  FROM resumo;

  v_mev_base := v_total_dieta + v_total_cenario7;

  WITH base_pacientes AS (
    SELECT p.id, p.estado, p.cidade, p.unidade_id,
           p.dmg_gestacao_anterior, p.created_at
    FROM public.pacientes p
    WHERE p.is_rascunho = false
  ),
  cenarios_por_paciente AS (
    SELECT
      c.paciente_id,
      bool_or(c.cenario_clinico IN ('1','6','6B')) AS tem_dmg,
      bool_or(c.cenario_clinico IN ('8','8'))      AS tem_overt,
      bool_or(c.cenario_clinico = '1')             AS dx_retorno1,
      bool_or(c.cenario_clinico = '6')             AS dx_gtt_janela,
      bool_or(c.cenario_clinico = '6B')            AS dx_gtt_tardio,
      bool_or(c.cenario_clinico = '3')             AS iniciou_insulina,
      bool_or(c.cenario_clinico = '4')             AS insulina_ok,
      bool_or(c.cenario_clinico = '7')             AS cenario7,
      avg(CASE WHEN c.cenario_clinico='1'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_retorno1,
      avg(CASE WHEN c.cenario_clinico='6'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_gtt_janela,
      avg(CASE WHEN c.cenario_clinico='6B'
               THEN coalesce(c.ig_semanas,0) + coalesce(c.ig_dias,0)/7.0 END) AS ig_dx_gtt_tardio
    FROM public.consultas c
    WHERE c.is_rascunho = false
    GROUP BY c.paciente_id
  ),
  pp AS (
    SELECT bp.*, cp.tem_dmg, cp.tem_overt, cp.dx_retorno1, cp.dx_gtt_janela,
           cp.dx_gtt_tardio, cp.iniciou_insulina, cp.insulina_ok, cp.cenario7
    FROM base_pacientes bp
    LEFT JOIN cenarios_por_paciente cp ON cp.paciente_id = bp.id
  ),
  meses AS (
    SELECT date_trunc('month', d)::date AS mes
    FROM generate_series(date_trunc('month', now()) - interval '11 months',
                         date_trunc('month', now()),
                         interval '1 month') d
  ),
  evol_gest AS (
    SELECT date_trunc('month', created_at)::date AS mes, count(*) AS qtd
    FROM base_pacientes
    GROUP BY 1
  ),
  evol_dx AS (
    SELECT date_trunc('month', c.created_at)::date AS mes, count(DISTINCT c.paciente_id) AS qtd
    FROM public.consultas c
    WHERE c.cenario_clinico IN ('1','6','6B','8','8')
      AND c.is_rascunho = false
    GROUP BY 1
  ),
  desfechos AS (
    SELECT
      count(*)                                                                          AS partos_total,
      count(*) FILTER (WHERE via_parto = 'vaginal')                                     AS via_vaginal,
      count(*) FILTER (WHERE via_parto = 'cesarea')                                     AS via_cesarea,
      count(*) FILTER (WHERE classificacao_rn = 'AIG')                                  AS rn_aig,
      count(*) FILTER (WHERE classificacao_rn = 'GIG')                                  AS rn_gig,
      count(*) FILTER (WHERE classificacao_rn = 'PIG')                                  AS rn_pig,
      avg(peso_rn_g)::int                                                               AS peso_medio_g,
      avg(coalesce(ig_parto_semanas,0) + coalesce(ig_parto_dias,0)/7.0)                 AS ig_parto_media,
      count(*) FILTER (WHERE intercorrencia_materna)                                    AS interc_maternas,
      count(*) FILTER (WHERE intercorrencia_neonatal)                                   AS interc_neonatais
    FROM public.partos
    WHERE is_rascunho = false
  )
  SELECT jsonb_build_object(
    'resumo', jsonb_build_object(
      'total_gestantes', v_total_gestantes,
      'dmg', v_total_dmg,
      'overt', v_total_overt,
      'dmg_overt_total', v_total_dmg + v_total_overt,
      'mev_base', v_mev_base,
      'taxa_controle_global',
        CASE WHEN v_mev_base = 0 THEN 0
             ELSE round(v_total_dieta::numeric / v_mev_base * 100, 1) END,
      'taxa_controle_inadequado',
        CASE WHEN v_mev_base = 0 THEN 0
             ELSE round(v_total_cenario7::numeric / v_mev_base * 100, 1) END
    ),
    'evolucao_mensal', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'mes', to_char(m.mes, 'YYYY-MM'),
        'gestantes', coalesce(eg.qtd, 0),
        'diagnosticos', coalesce(ed.qtd, 0)
      ) ORDER BY m.mes), '[]'::jsonb)
      FROM meses m
      LEFT JOIN evol_gest eg ON eg.mes = m.mes
      LEFT JOIN evol_dx ed ON ed.mes = m.mes
    ),
    'momento_diagnostico', jsonb_build_object(
      'retorno1',     (SELECT count(*) FROM pp WHERE dx_retorno1),
      'gtt_janela',   (SELECT count(*) FROM pp WHERE dx_gtt_janela),
      'gtt_tardio',   (SELECT count(*) FROM pp WHERE dx_gtt_tardio),
      'ig_retorno1',  (SELECT round(avg(ig_dx_retorno1)::numeric, 1)
                       FROM cenarios_por_paciente WHERE ig_dx_retorno1 IS NOT NULL),
      'ig_gtt_janela',(SELECT round(avg(ig_dx_gtt_janela)::numeric, 1)
                       FROM cenarios_por_paciente WHERE ig_dx_gtt_janela IS NOT NULL),
      'ig_gtt_tardio',(SELECT round(avg(ig_dx_gtt_tardio)::numeric, 1)
                       FROM cenarios_por_paciente WHERE ig_dx_gtt_tardio IS NOT NULL)
    ),
    'historico_dmg', jsonb_build_object(
      'pacientes_com_historico', (SELECT count(*) FROM pp WHERE dmg_gestacao_anterior),
      'dmg_entre_com_historico', (SELECT count(*) FROM pp WHERE dmg_gestacao_anterior AND tem_dmg)
    ),
    'tratamento', jsonb_build_object(
      'so_dieta',          v_total_dieta,
      'insulina_inicial_ok', v_total_insulina_ok,
      'cenario7',          v_total_cenario7
    ),
    'funil', jsonb_build_array(
      jsonb_build_object('etapa','Total gestantes',     'valor', v_total_gestantes),
      jsonb_build_object('etapa','DMG confirmado',      'valor', v_total_dmg),
      jsonb_build_object('etapa','Só dieta',            'valor', v_total_dieta),
      jsonb_build_object('etapa','Insulina iniciada',   'valor',
        (SELECT count(*) FROM pp WHERE iniciou_insulina)),
      jsonb_build_object('etapa','Insulina suficiente', 'valor', v_total_insulina_ok),
      jsonb_build_object('etapa','Associar endócrino',  'valor', v_total_cenario7)
    ),
    'desfechos', (SELECT to_jsonb(d) FROM desfechos d),
    'regional', jsonb_build_object(
      'por_estado', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'estado', coalesce(estado,'—'),
          'gestantes', total,
          'dmg', dmg,
          'taxa_dmg', CASE WHEN total=0 THEN 0 ELSE round(dmg::numeric/total*100,1) END
        ) ORDER BY total DESC), '[]'::jsonb)
        FROM (
          SELECT pp.estado, count(*) AS total, count(*) FILTER (WHERE pp.tem_dmg) AS dmg
          FROM pp GROUP BY pp.estado
        ) t
      ),
      'por_cidade', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'cidade', coalesce(cidade,'—'),
          'estado', coalesce(estado,'—'),
          'gestantes', total,
          'dmg', dmg,
          'taxa_dmg', CASE WHEN total=0 THEN 0 ELSE round(dmg::numeric/total*100,1) END
        ) ORDER BY total DESC), '[]'::jsonb)
        FROM (
          SELECT pp.cidade, pp.estado, count(*) AS total, count(*) FILTER (WHERE pp.tem_dmg) AS dmg
          FROM pp GROUP BY pp.cidade, pp.estado ORDER BY count(*) DESC LIMIT 20
        ) t
      ),
      'por_unidade', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'unidade', coalesce(u.nome,'—'),
          'estado', coalesce(u.estado,'—'),
          'cidade', coalesce(u.cidade,'—'),
          'gestantes', t.total,
          'dmg', t.dmg,
          'taxa_dmg', CASE WHEN t.total=0 THEN 0 ELSE round(t.dmg::numeric/t.total*100,1) END
        ) ORDER BY t.total DESC), '[]'::jsonb)
        FROM (
          SELECT pp.unidade_id, count(*) AS total, count(*) FILTER (WHERE pp.tem_dmg) AS dmg
          FROM pp WHERE pp.unidade_id IS NOT NULL GROUP BY pp.unidade_id
        ) t
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
      )
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.metricas_diagnosticos_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metricas_diagnosticos_admin() TO authenticated;