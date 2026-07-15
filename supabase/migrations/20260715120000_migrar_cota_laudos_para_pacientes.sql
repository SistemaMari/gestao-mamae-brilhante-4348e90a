-- ============================================================
-- Migração de modelo de cobrança: cota por LAUDOS → cota por PACIENTES.
-- Decisão de negócio: mesmos números de hoje (10/35/100), agora aplicados
-- ao limite de pacientes cadastrados. Laudos passam a ser ilimitados.
-- ============================================================

-- 1) Define o novo limite de pacientes por plano (mesmos números do antigo
--    limite de laudos/mês).
UPDATE public.planos SET pacientes_max = 10  WHERE slug = 'inicial';
UPDATE public.planos SET pacientes_max = 35  WHERE slug = 'intermediaria';
UPDATE public.planos SET pacientes_max = 100 WHERE slug = 'profissional';

-- 2) pode_criar_ficha passa a aplicar o limite de pacientes do plano.
--    Institucional (vinculado a unidade) continua isento, mesma regra já
--    usada em pode_gerar_laudo. Plano sem pacientes_max definido = ilimitado.
--    Conta só fichas não-rascunho (mesmo critério usado no dashboard).
CREATE OR REPLACE FUNCTION public.pode_criar_ficha(p_profissional_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade uuid;
  v_max     integer;
  v_total   integer;
BEGIN
  SELECT p.unidade_id, pl.pacientes_max
    INTO v_unidade, v_max
  FROM profissionais p
  LEFT JOIN planos pl ON pl.id = p.plano_id
  WHERE p.id = p_profissional_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_unidade IS NOT NULL THEN
    RETURN true;
  END IF;

  IF v_max IS NULL THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO v_total
  FROM pacientes
  WHERE profissional_id = p_profissional_id AND is_rascunho = false;

  RETURN v_total < v_max;
END;
$$;

-- 3) pode_gerar_laudo: cota de laudos removida (agora ilimitado para todos).
--    Mantém a assinatura/formato de retorno (allowed, laudos_limite) para não
--    quebrar o caller (gerar-laudo), e mantém o incremento de laudos_usados
--    apenas para fins estatísticos/históricos — não bloqueia mais ninguém.
CREATE OR REPLACE FUNCTION public.pode_gerar_laudo(p_profissional_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profissionais
  SET laudos_usados = laudos_usados + 1
  WHERE id = p_profissional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'laudos_limite', 0);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'laudos_limite', -1, 'ilimitado', true);
END;
$$;

COMMENT ON FUNCTION public.pode_criar_ficha(uuid) IS
  'Aplica o limite de pacientes do plano (planos.pacientes_max). Institucional é isento. Substitui a antiga cota por laudos/mês.';
COMMENT ON FUNCTION public.pode_gerar_laudo(uuid) IS
  'Laudos são ilimitados desde a migração para cota por pacientes (2026-07). Mantido apenas para registrar laudos_usados e por compatibilidade de assinatura.';
