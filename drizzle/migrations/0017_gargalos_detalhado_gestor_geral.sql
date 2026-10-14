-- ============================================================
-- Gargalos da rede (gestor geral) com drill-down: lista das gestantes por trás
-- de cada número do bloco "Gargalos" na aba Consolidador.
--
-- Nova função get_consolidador_gargalos_detalhado_gestor_geral(p_unidades, p_limit)
-- → { sem_gj_primeira_consulta: [...], atrasadas_gtt: [...], confirmadas_sem_retorno: [...] }
-- Cada item: paciente_id, nome, unidade_id, unidade_nome, ig_atual_dias,
-- ultima_consulta, profissional_nome.
--
-- Regras IGUAIS às da contagem (get_consolidador_gargalos_gestor_geral, versão
-- de 20261014150000 + lista de DMG com overt de 20261015090000):
--  • base: gestantes não-rascunho das unidades permitidas, com DUM efetiva nos
--    últimos 280 dias e EM ACOMPANHAMENTO (paciente_em_acompanhamento).
--  • sem GJ: tem atendimento registrado e nenhum exame de GJ/plasmática.
--  • GTT em atraso: DUM há 196+ dias (28 sem), ainda aguardando GJ/GTT e sem GTT.
--  • diagnosticadas sem retorno: laudo de diabetes confirmado (1/6/6B E overt 8)
--    e último atendimento há mais de 14 dias (ou nenhum).
-- Autorização: só gestor geral (ou admin) e só nas unidades de _unidades_gg
-- (que já exclui rede encerrada) — mesmo padrão das RPCs do painel da rede.
-- Só lê; não altera nenhuma função existente.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015090000 e 20261015120000.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_consolidador_gargalos_detalhado_gestor_geral(
  p_unidades uuid[] DEFAULT NULL::uuid[],
  p_limit integer DEFAULT 500
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unidades uuid[];
  v_limit integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
BEGIN
  IF NOT (public.is_gestor_geral(auth.uid()) OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  v_unidades := public._unidades_gg(auth.uid(), p_unidades);
  IF coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'sem_gj_primeira_consulta', '[]'::jsonb,
      'atrasadas_gtt', '[]'::jsonb,
      'confirmadas_sem_retorno', '[]'::jsonb
    );
  END IF;

  -- A) Sem glicemia de jejum após a 1ª consulta
  WITH base AS (
    SELECT p.id, p.nome, p.unidade_id, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(v_unidades)
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
      b.unidade_id,
      u.nome AS unidade_nome,
      (CURRENT_DATE - public.dum_efetiva(b.id))::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.unidades u ON u.id = b.unidade_id
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC, e.nome), '[]'::jsonb)
  INTO v_a
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC, nome LIMIT v_limit) e;

  -- B) GTT em atraso (28+ semanas, ainda no rastreamento, sem GTT)
  WITH base AS (
    SELECT p.id, p.nome, p.unidade_id, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(v_unidades)
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
      b.unidade_id,
      u.nome AS unidade_nome,
      (CURRENT_DATE - public.dum_efetiva(b.id))::int AS ig_atual_dias,
      (SELECT max(ra.created_at)::date FROM public.registros_atendimento ra WHERE ra.paciente_id = b.id) AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN public.unidades u ON u.id = b.unidade_id
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ig_atual_dias DESC, e.nome), '[]'::jsonb)
  INTO v_b
  FROM (SELECT * FROM enriched ORDER BY ig_atual_dias DESC, nome LIMIT v_limit) e;

  -- C) Diabetes confirmado (DMG ou overt) sem retorno há mais de 14 dias
  WITH base AS (
    SELECT p.id, p.nome, p.unidade_id, p.profissional_id
    FROM public.pacientes p
    WHERE p.unidade_id = ANY(v_unidades)
      AND p.is_rascunho = false
      AND public.dum_efetiva(p.id) IS NOT NULL
      AND public.dum_efetiva(p.id) >= (CURRENT_DATE - INTERVAL '280 days')
      AND public.paciente_em_acompanhamento(p.status_ficha, p.motivo_encerramento::text)
      AND EXISTS (
        SELECT 1 FROM public.laudos l
        WHERE l.paciente_id = p.id
          AND l.cenario_clinico IN ('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')
      )
  ),
  ult AS (
    SELECT ra.paciente_id, max(ra.created_at) AS ultima
    FROM public.registros_atendimento ra
    WHERE ra.paciente_id IN (SELECT id FROM base)
    GROUP BY ra.paciente_id
  ),
  enriched AS (
    SELECT
      b.id AS paciente_id,
      b.nome,
      b.unidade_id,
      un.nome AS unidade_nome,
      (CURRENT_DATE - public.dum_efetiva(b.id))::int AS ig_atual_dias,
      u.ultima::date AS ultima_consulta,
      pr.nome AS profissional_nome
    FROM base b
    LEFT JOIN ult u ON u.paciente_id = b.id
    LEFT JOIN public.unidades un ON un.id = b.unidade_id
    LEFT JOIN public.profissionais pr ON pr.id = b.profissional_id
    WHERE u.ultima IS NULL OR u.ultima <= (NOW() - INTERVAL '14 days')
  )
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ultima_consulta NULLS FIRST, e.nome), '[]'::jsonb)
  INTO v_c
  FROM (SELECT * FROM enriched ORDER BY ultima_consulta NULLS FIRST, nome LIMIT v_limit) e;

  RETURN jsonb_build_object(
    'sem_gj_primeira_consulta', v_a,
    'atrasadas_gtt', v_b,
    'confirmadas_sem_retorno', v_c
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_consolidador_gargalos_detalhado_gestor_geral(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_consolidador_gargalos_detalhado_gestor_geral(uuid[], integer) TO authenticated;