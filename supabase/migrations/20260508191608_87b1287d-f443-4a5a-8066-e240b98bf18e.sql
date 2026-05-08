
-- =============================================================
-- Uniformiza definições entre Aba 1 (visao_geral), Aba 2 (consolidador
-- operação/perfil) e Aba 3 (ranking). Após esta migração:
--   pacientes_ativos = COUNT pacientes is_rascunho=false E DUM IS NOT NULL
--                      E DUM ≥ CURRENT_DATE - 280d (snapshot atual)
--   laudos_emitidos / taxa_dmg_positivo_pct = laudos no período (janela)
--   tempo_medio_fechamento_dias = AVG(partos.data_parto - pacientes.dum)
--                                 com partos no período (janela), mesma
--                                 definição usada em get_consolidador_perfil_clinico.
--                                 Retorna NULL quando sem partos elegíveis.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_ranking_unidades_gestor_geral(
  p_data_inicio date,
  p_data_fim date,
  p_unidades uuid[] DEFAULT NULL
) RETURNS TABLE (
  unidade_id uuid,
  unidade_nome text,
  pacientes_ativos int,
  laudos_emitidos int,
  taxa_dmg_positivo_pct numeric,
  tempo_medio_fechamento_dias numeric,
  status_operacional text,
  ultima_atividade timestamptz,
  dias_sem_atividade int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  fech AS (
    SELECT pa.unidade_id,
           avg(pa.data_parto - p.dum)::numeric AS media_dias
    FROM public.partos pa
    JOIN public.pacientes p ON p.id = pa.paciente_id
    WHERE pa.unidade_id = ANY(v_unidades)
      AND pa.is_rascunho = false
      AND pa.data_parto BETWEEN p_data_inicio AND p_data_fim
      AND p.dum IS NOT NULL
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
      WHEN ut.ultima IS NULL THEN 0   -- nao_iniciada primeiro
      WHEN ut.ultima < now() - interval '60 days' THEN 1   -- inativa
      WHEN ut.ultima < now() - interval '30 days' THEN 2   -- atencao
      ELSE 3                                                -- ativa
    END ASC,
    coalesce(l.total, 0) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ranking_unidades_gestor_geral(date,date,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_unidades_gestor_geral(date,date,uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_ranking_unidades_gestor_geral(date,date,uuid[]) IS
'Ranking de unidades. Usa as MESMAS definições de get_visao_geral_gestor_geral:
pacientes_ativos = snapshot DUM ≤ 280d; laudos_emitidos / taxa_dmg_positivo_pct
respeitam a janela; tempo_medio_fechamento_dias usa partos.data_parto - pacientes.dum
(NULL quando não há partos elegíveis no período).';
