-- ============================================================
-- Indicadores da LINHA DE CUIDADO (painel da unidade + consolidado da rede).
--
-- Uma função interna faz todas as contas para um conjunto de unidades e um
-- período; as duas RPCs públicas só checam a autorização (igual às RPCs de
-- painel existentes) e chamam a interna DUAS vezes: período escolhido e
-- período anterior do mesmo tamanho (imediatamente antes), para a tela
-- mostrar a variação.
--
-- Definições (gestantes da unidade, sem rascunho):
--  • Rastreadas  = com Retorno 1 (glicemia de jejum) ou GTT com data no
--                  período — mesma base da taxa de diagnóstico do gestor geral.
--  • Diagnosticadas = dessas, com diabetes confirmado nessas consultas:
--                  DMG (cenários 1, 6, 6B) ou overt (8) — mesma regra da taxa.
--  • Em acompanhamento hoje / encerradas por motivo = situação ATUAL das
--    diagnosticadas (insulinização, parto, aborto, não retornou, outro).
--    Legados: status 'encerrada_insulinizacao'/'encaminhada_endocrino' →
--    insulinização; 'resultado_parto' → parto; outro status terminal → outro.
--  • Perda de seguimento = encerradas por 'nao_retornou' ÷ diagnosticadas.
--  • Adesão ao perfil glicêmico (das diagnosticadas): ≥ 1 perfil COMPLETO
--    (mínimo de dias com medição — mesma regra das fichas A/C e E) e último
--    perfil NA META (percentual_meta ≥ limiar — mesmo critério do relatório
--    mensal), este sobre as que entregaram algum perfil.
--    ⚠️ CRITÉRIO PROVISÓRIO, a validar pelas médicas. Os limiares ficam SÓ
--    aqui (constantes c_*) e voltam no JSON ('criterios') para a tela exibir.
--  • Tempos (medianas, em dias): GJ → GTT (rastreadas que fizeram os dois);
--    diagnóstico → início do 1º perfil; diagnóstico → encerramento por
--    insulinização. Diagnóstico = 1ª consulta com DMG/overt da gestante.
--  • % diagnosticadas antes de 28 semanas (IG pela dum_efetiva).
--  • Perfil das gestantes ATENDIDAS no período (qualquer consulta no
--    período): faixas de idade na 1ª consulta do período (<20, 20–34,
--    35–39, 40+, sem data de nascimento) e DMG em gestação anterior.
--
-- Lista de DMG com OVERT ('8'/'cenario_8'), como no banco desde 20261015090000.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015140000. Idempotente.
-- ============================================================

CREATE OR REPLACE FUNCTION public._linha_cuidado_calc(p_unidades uuid[], p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  -- ⚠️ Critérios PROVISÓRIOS (a validar pelas médicas) — fonte única.
  c_perfil_min_dias CONSTANT int := 7;      -- perfil completo: ≥ 7 dias com medição (fichas A/C e E)
  c_meta_pct        CONSTANT numeric := 70; -- perfil na meta: ≥ 70% das medições na meta (relatório mensal)
  c_ig_limite_dias  CONSTANT int := 196;    -- 28 semanas
  v jsonb;
BEGIN
  WITH rastreio AS (
    SELECT c.paciente_id,
           bool_or(c.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')) AS tem_dmg
    FROM public.consultas c
    JOIN public.pacientes p ON p.id = c.paciente_id
    WHERE p.unidade_id = ANY(p_unidades)
      AND p.is_rascunho = false
      AND c.is_rascunho = false
      AND c.tipo IN ('retorno_1', 'gtt')
      AND c.data BETWEEN p_inicio AND p_fim
    GROUP BY c.paciente_id
  ),
  diag AS (
    SELECT r.paciente_id,
           p.data_encerramento,
           public.dum_efetiva(r.paciente_id) AS dum,
           (SELECT min(c.data) FROM public.consultas c
             WHERE c.paciente_id = r.paciente_id
               AND c.is_rascunho = false
               AND c.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')
           ) AS data_diag,
           CASE
             WHEN p.motivo_encerramento IS NOT NULL THEN p.motivo_encerramento::text
             WHEN p.status_ficha IN ('encerrada_insulinizacao', 'encaminhada_endocrino') THEN 'insulinizacao'
             WHEN p.status_ficha = 'resultado_parto' THEN 'parto'
             WHEN NOT public.paciente_em_acompanhamento(p.status_ficha, NULL) THEN 'outro'
             ELSE NULL
           END AS motivo
    FROM rastreio r
    JOIN public.pacientes p ON p.id = r.paciente_id
    WHERE r.tem_dmg
  ),
  perfis AS (
    SELECT pg.paciente_id, pg.data_inicio, pg.data_fim, pg.created_at, pg.percentual_meta,
           (SELECT count(DISTINCT vp.dia) FROM public.valores_perfil vp
             WHERE vp.perfil_id = pg.id AND vp.valor_mgdl > 0) AS dias
    FROM public.perfis_glicemicos pg
    JOIN public.consultas c ON c.id = pg.consulta_id AND c.is_rascunho = false
    WHERE pg.paciente_id IN (SELECT paciente_id FROM diag)
  ),
  diag_x AS (
    SELECT d.*,
           EXISTS (SELECT 1 FROM perfis x WHERE x.paciente_id = d.paciente_id) AS tem_perfil,
           EXISTS (SELECT 1 FROM perfis x WHERE x.paciente_id = d.paciente_id
                    AND x.dias >= c_perfil_min_dias) AS tem_completo,
           (SELECT x.percentual_meta FROM perfis x WHERE x.paciente_id = d.paciente_id
             ORDER BY x.data_fim DESC, x.created_at DESC LIMIT 1) AS ultimo_pct,
           (SELECT min(x.data_inicio) FROM perfis x WHERE x.paciente_id = d.paciente_id
             AND x.data_inicio >= d.data_diag) AS primeiro_perfil
    FROM diag d
  ),
  gj_gtt AS (
    SELECT r.paciente_id,
           (SELECT min(c.data) FROM public.consultas c
             WHERE c.paciente_id = r.paciente_id AND c.is_rascunho = false AND c.tipo = 'retorno_1') AS d_gj,
           (SELECT min(c.data) FROM public.consultas c
             WHERE c.paciente_id = r.paciente_id AND c.is_rascunho = false AND c.tipo = 'gtt') AS d_gtt
    FROM rastreio r
  ),
  atendidas AS (
    SELECT c.paciente_id, min(c.data) AS primeira
    FROM public.consultas c
    JOIN public.pacientes p ON p.id = c.paciente_id
    WHERE p.unidade_id = ANY(p_unidades)
      AND p.is_rascunho = false
      AND c.is_rascunho = false
      AND c.data BETWEEN p_inicio AND p_fim
    GROUP BY c.paciente_id
  ),
  atendidas_x AS (
    SELECT a.paciente_id, p.dmg_gestacao_anterior,
           CASE WHEN p.data_nascimento IS NULL THEN NULL
                ELSE extract(year FROM age(a.primeira, p.data_nascimento))::int END AS idade
    FROM atendidas a
    JOIN public.pacientes p ON p.id = a.paciente_id
  ),
  n AS (
    SELECT
      (SELECT count(*) FROM rastreio)::int AS rastreadas,
      (SELECT count(*) FROM diag_x)::int AS diagnosticadas,
      (SELECT count(*) FROM diag_x WHERE motivo IS NULL)::int AS em_acompanhamento,
      (SELECT count(*) FROM diag_x WHERE motivo = 'insulinizacao')::int AS enc_insulinizacao,
      (SELECT count(*) FROM diag_x WHERE motivo = 'parto')::int AS enc_parto,
      (SELECT count(*) FROM diag_x WHERE motivo = 'aborto')::int AS enc_aborto,
      (SELECT count(*) FROM diag_x WHERE motivo = 'nao_retornou')::int AS enc_nao_retornou,
      (SELECT count(*) FROM diag_x WHERE motivo NOT IN ('insulinizacao','parto','aborto','nao_retornou'))::int AS enc_outro,
      (SELECT count(*) FROM diag_x WHERE tem_perfil)::int AS com_perfil,
      (SELECT count(*) FROM diag_x WHERE tem_completo)::int AS com_completo,
      (SELECT count(*) FROM diag_x WHERE tem_perfil AND ultimo_pct >= c_meta_pct)::int AS ultimo_na_meta,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (d_gtt - d_gj))
         FROM gj_gtt WHERE d_gj IS NOT NULL AND d_gtt IS NOT NULL AND d_gtt >= d_gj) AS med_gj_gtt,
      (SELECT count(*) FROM gj_gtt WHERE d_gj IS NOT NULL AND d_gtt IS NOT NULL AND d_gtt >= d_gj)::int AS n_gj_gtt,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (primeiro_perfil - data_diag))
         FROM diag_x WHERE primeiro_perfil IS NOT NULL) AS med_diag_perfil,
      (SELECT count(*) FROM diag_x WHERE primeiro_perfil IS NOT NULL)::int AS n_diag_perfil,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (data_encerramento - data_diag))
         FROM diag_x WHERE motivo = 'insulinizacao' AND data_encerramento IS NOT NULL
          AND data_encerramento >= data_diag) AS med_diag_insulina,
      (SELECT count(*) FROM diag_x WHERE motivo = 'insulinizacao' AND data_encerramento IS NOT NULL
          AND data_encerramento >= data_diag)::int AS n_diag_insulina,
      (SELECT count(*) FROM diag_x WHERE dum IS NOT NULL AND data_diag IS NOT NULL)::int AS diag_com_ig,
      (SELECT count(*) FROM diag_x WHERE dum IS NOT NULL AND data_diag IS NOT NULL
          AND (data_diag - dum) < c_ig_limite_dias)::int AS diag_antes_28s,
      (SELECT count(*) FROM atendidas_x)::int AS atendidas,
      (SELECT count(*) FROM atendidas_x WHERE idade < 20)::int AS f_menos_20,
      (SELECT count(*) FROM atendidas_x WHERE idade BETWEEN 20 AND 34)::int AS f_20_34,
      (SELECT count(*) FROM atendidas_x WHERE idade BETWEEN 35 AND 39)::int AS f_35_39,
      (SELECT count(*) FROM atendidas_x WHERE idade >= 40)::int AS f_40_mais,
      (SELECT count(*) FROM atendidas_x WHERE idade IS NULL)::int AS f_sem_info,
      (SELECT count(*) FROM atendidas_x WHERE dmg_gestacao_anterior = true)::int AS dmg_anterior
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'criterios', jsonb_build_object(
      'perfil_min_dias', c_perfil_min_dias,
      'meta_pct', c_meta_pct,
      'ig_limite_semanas', c_ig_limite_dias / 7,
      'provisorio', true
    ),
    'funil', jsonb_build_object(
      'rastreadas', n.rastreadas,
      'diagnosticadas', n.diagnosticadas,
      'em_acompanhamento', n.em_acompanhamento,
      'encerradas', jsonb_build_object(
        'insulinizacao', n.enc_insulinizacao,
        'parto', n.enc_parto,
        'aborto', n.enc_aborto,
        'nao_retornou', n.enc_nao_retornou,
        'outro', n.enc_outro
      ),
      'encerradas_total', n.enc_insulinizacao + n.enc_parto + n.enc_aborto + n.enc_nao_retornou + n.enc_outro,
      'taxa_diagnostico_pct', CASE WHEN n.rastreadas = 0 THEN NULL
                                   ELSE round(n.diagnosticadas::numeric / n.rastreadas * 100, 1) END,
      'perda_seguimento_pct', CASE WHEN n.diagnosticadas = 0 THEN NULL
                                   ELSE round(n.enc_nao_retornou::numeric / n.diagnosticadas * 100, 1) END
    ),
    'adesao', jsonb_build_object(
      'diagnosticadas', n.diagnosticadas,
      'com_perfil', n.com_perfil,
      'com_perfil_completo', n.com_completo,
      'perfil_completo_pct', CASE WHEN n.diagnosticadas = 0 THEN NULL
                                  ELSE round(n.com_completo::numeric / n.diagnosticadas * 100, 1) END,
      'ultimo_na_meta', n.ultimo_na_meta,
      'ultimo_na_meta_pct', CASE WHEN n.com_perfil = 0 THEN NULL
                                 ELSE round(n.ultimo_na_meta::numeric / n.com_perfil * 100, 1) END
    ),
    'tempos', jsonb_build_object(
      'gj_gtt_mediana_dias', round(n.med_gj_gtt::numeric, 1),
      'gj_gtt_n', n.n_gj_gtt,
      'diag_perfil_mediana_dias', round(n.med_diag_perfil::numeric, 1),
      'diag_perfil_n', n.n_diag_perfil,
      'diag_insulina_mediana_dias', round(n.med_diag_insulina::numeric, 1),
      'diag_insulina_n', n.n_diag_insulina,
      'diag_com_ig', n.diag_com_ig,
      'diag_antes_28s', n.diag_antes_28s,
      'diag_antes_28s_pct', CASE WHEN n.diag_com_ig = 0 THEN NULL
                                 ELSE round(n.diag_antes_28s::numeric / n.diag_com_ig * 100, 1) END
    ),
    'perfil_gestantes', jsonb_build_object(
      'atendidas', n.atendidas,
      'faixas_idade', jsonb_build_object(
        'menos_20', n.f_menos_20,
        'de_20_34', n.f_20_34,
        'de_35_39', n.f_35_39,
        'mais_40', n.f_40_mais,
        'sem_info', n.f_sem_info
      ),
      'dmg_anterior', n.dmg_anterior,
      'dmg_anterior_pct', CASE WHEN n.atendidas = 0 THEN NULL
                               ELSE round(n.dmg_anterior::numeric / n.atendidas * 100, 1) END
    )
  ) INTO v
  FROM n;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public._linha_cuidado_calc(uuid[], date, date) FROM PUBLIC, anon, authenticated;

-- Período anterior do mesmo tamanho, imediatamente antes de p_inicio.
CREATE OR REPLACE FUNCTION public._linha_cuidado_com_anterior(p_unidades uuid[], p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'atual', public._linha_cuidado_calc(p_unidades, p_inicio, p_fim),
    'anterior', public._linha_cuidado_calc(
      p_unidades,
      p_inicio - (p_fim - p_inicio + 1),
      p_inicio - 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public._linha_cuidado_com_anterior(uuid[], date, date) FROM PUBLIC, anon, authenticated;

-- Painel da unidade. Sem período: últimos 30 dias (mesmo padrão da tela).
CREATE OR REPLACE FUNCTION public.get_painel_linha_cuidado(
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
  v_fim date := coalesce(p_data_fim, CURRENT_DATE);
  v_inicio date := coalesce(p_data_inicio, coalesce(p_data_fim, CURRENT_DATE) - 30);
BEGIN
  IF NOT public._pode_ver_unidade(auth.uid(), p_unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado à unidade %', p_unidade_id USING ERRCODE = '42501';
  END IF;
  IF v_inicio > v_fim THEN
    RAISE EXCEPTION 'Período inválido: início depois do fim' USING ERRCODE = '22023';
  END IF;

  RETURN public._linha_cuidado_com_anterior(ARRAY[p_unidade_id], v_inicio, v_fim);
END;
$function$;

-- Consolidado da rede (gestor geral). Mesmo padrão das RPCs *_gestor_geral.
CREATE OR REPLACE FUNCTION public.get_linha_cuidado_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL::uuid[]
)
 RETURNS jsonb
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
  IF p_data_inicio IS NULL OR p_data_fim IS NULL OR p_data_inicio > p_data_fim THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023';
  END IF;

  v_unidades := coalesce(public._unidades_gg(auth.uid(), p_unidades), ARRAY[]::uuid[]);

  RETURN public._linha_cuidado_com_anterior(v_unidades, p_data_inicio, p_data_fim);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_painel_linha_cuidado(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_linha_cuidado_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_painel_linha_cuidado(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_linha_cuidado_gestor_geral(date, date, uuid[]) TO authenticated;