-- ============================================================
-- Registro de laudos (feature B): cota só para consultório + 1 laudo por consulta
-- ------------------------------------------------------------
-- 1) pode_gerar_laudo passa a ISENTAR institucional (profissional vinculado a
--    uma unidade). Só consultório (sem unidade_id) tem limite de laudos por plano.
--    Antes a função aplicava o limite a QUALQUER profissional (bug: institucional
--    seria bloqueado no laudos_limite padrão).
-- 2) Índice único em laudos(consulta_id): garante 1 laudo por consulta
--    (idempotência — a gerar-laudo faz upsert por consulta).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_gerar_laudo(p_profissional_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usados  integer;
  v_limite  integer;
  v_unidade uuid;
BEGIN
  SELECT laudos_usados, laudos_limite, unidade_id
    INTO v_usados, v_limite, v_unidade
  FROM profissionais
  WHERE id = p_profissional_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'laudos_limite', 0);
  END IF;

  -- Institucional (vinculado a uma unidade) = ILIMITADO. Não conta cota.
  IF v_unidade IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'laudos_limite', -1, 'ilimitado', true);
  END IF;

  -- Consultório = aplica o limite do plano.
  IF v_usados >= v_limite THEN
    RETURN jsonb_build_object('allowed', false, 'laudos_limite', v_limite);
  END IF;

  UPDATE profissionais SET laudos_usados = laudos_usados + 1 WHERE id = p_profissional_id;
  RETURN jsonb_build_object('allowed', true, 'laudos_limite', v_limite);
END;
$$;

-- 1 laudo por consulta (a tabela está vazia hoje → criação segura).
CREATE UNIQUE INDEX IF NOT EXISTS idx_laudos_consulta_unico ON public.laudos (consulta_id);
