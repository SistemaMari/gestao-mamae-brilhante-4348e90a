-- ============================================================
-- Relatório mensal em PDF (gerar-relatorios-mensais / seed-rede-demo), 14/out/2026:
-- o PDF passa a trazer os mesmos indicadores da linha de cuidado do painel
-- (perda de seguimento, adesão ao perfil, tempos, desfechos), a comparação
-- com o mês anterior, os últimos 6 meses e as metas da rede.
--
-- _relatorio_mensal_dados(unidade, início, fim) devolve, para UMA unidade:
--   rede_nome  — nome da rede (contratante) da unidade
--   atual      — _linha_cuidado_calc do mês
--   anterior   — _linha_cuidado_calc do mês-calendário anterior
--   tendencia  — 6 meses até o mês do relatório: [{mes, rastreadas, diagnosticadas, taxa}]
--   metas      — metas da rede da unidade {indicador: valor} (ou {} se não houver)
-- Mesma lógica clínica dos painéis (reaproveita _linha_cuidado_calc; nada é copiado).
-- Só a service role (as funções de cron) chama. O PDF continua saindo sem
-- estas seções se a função não existir (migration ainda não aplicada).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015140500 e 20261015180000.
-- ============================================================

CREATE OR REPLACE FUNCTION public._relatorio_mensal_dados(p_unidade_id uuid, p_inicio date, p_fim date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rede_id uuid;
  v_rede_nome text;
  v_mes_ini date := date_trunc('month', p_inicio)::date;
  v_tendencia jsonb := '[]'::jsonb;
  v_bloco jsonb;
  v_m date;
BEGIN
  IF p_unidade_id IS NULL OR p_inicio IS NULL OR p_fim IS NULL OR p_inicio > p_fim THEN
    RAISE EXCEPTION 'Parâmetros inválidos' USING ERRCODE = '22023';
  END IF;

  SELECT u.contratante_id, c.nome INTO v_rede_id, v_rede_nome
  FROM public.unidades u
  LEFT JOIN public.contratantes c ON c.id = u.contratante_id
  WHERE u.id = p_unidade_id;

  FOR i IN REVERSE 5..0 LOOP
    v_m := (v_mes_ini - make_interval(months => i))::date;
    v_bloco := public._linha_cuidado_calc(ARRAY[p_unidade_id], v_m, (v_m + interval '1 month' - interval '1 day')::date);
    v_tendencia := v_tendencia || jsonb_build_array(jsonb_build_object(
      'mes', to_char(v_m, 'YYYY-MM'),
      'rastreadas', coalesce((v_bloco -> 'funil' ->> 'rastreadas')::int, 0),
      'diagnosticadas', coalesce((v_bloco -> 'funil' ->> 'diagnosticadas')::int, 0),
      'taxa', (v_bloco -> 'funil' ->> 'taxa_diagnostico_pct')::numeric
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'rede_nome', v_rede_nome,
    'atual', public._linha_cuidado_calc(ARRAY[p_unidade_id], p_inicio, p_fim),
    'anterior', public._linha_cuidado_calc(
      ARRAY[p_unidade_id],
      (v_mes_ini - interval '1 month')::date,
      (v_mes_ini - interval '1 day')::date
    ),
    'tendencia', v_tendencia,
    'metas', coalesce((
      SELECT jsonb_object_agg(m.indicador, m.valor)
      FROM public.metas_rede m
      WHERE m.contratante_id = v_rede_id
    ), '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._relatorio_mensal_dados(uuid, date, date) FROM PUBLIC, anon, authenticated;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public._relatorio_mensal_dados(uuid, date, date) TO service_role;
  END IF;
END
$grant$;