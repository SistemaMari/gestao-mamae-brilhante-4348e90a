-- ============================================================================
-- Unificação da precedência de âncora de IG
-- Precedência canônica (idêntica nas 3 fontes do sistema):
--   1. referencia_usg_id (USG escolhida) > 2. 1ª USG (ordem=1, se referencia_ig='usg')
--   > 3. DUM > 4. sem âncora
-- Altera SÓ calcular_ig (+ passo 2: fallback p/ 1ª USG) e dum_efetiva (+ passo 1:
-- passa a respeitar a USG escolhida). NÃO toca nas 12 funções de painel nem na
-- fichaUtils (frontend, já é a referência). Idempotente (CREATE OR REPLACE),
-- sem DROP, assinaturas preservadas.
-- ============================================================================

-- 1) calcular_ig — set-returning, plpgsql, STABLE, SECURITY INVOKER (inalterado)
CREATE OR REPLACE FUNCTION public.calcular_ig(
  p_paciente_id uuid,
  p_data_alvo  date
) RETURNS TABLE (semanas int, dias int, origem text, base_data date)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ref       text;
  v_usg_id    uuid;
  v_dum       date;
  v_usg_data  date;
  v_usg_sem   int;
  v_usg_dias  int;
  v_usg_ord   int;
  v_base      date;
  v_total     int;
BEGIN
  SELECT referencia_ig, referencia_usg_id, dum
    INTO v_ref, v_usg_id, v_dum
  FROM pacientes WHERE id = p_paciente_id;

  IF v_ref = 'usg' THEN
    -- Precedência 1 — âncora escolhida manualmente (referencia_usg_id)
    IF v_usg_id IS NOT NULL THEN
      SELECT data_exame, ig_semanas, ig_dias, ordem
        INTO v_usg_data, v_usg_sem, v_usg_dias, v_usg_ord
      FROM exames_usg WHERE id = v_usg_id;
      IF v_usg_data IS NOT NULL THEN
        v_base  := v_usg_data - ((v_usg_sem * 7) + COALESCE(v_usg_dias, 0));
        v_total := (p_data_alvo - v_base);
        IF v_total < 0 THEN RETURN; END IF;
        RETURN QUERY SELECT v_total / 7, v_total % 7, ('USG #' || v_usg_ord)::text, v_base;
        RETURN;
      END IF;
    END IF;

    -- Precedência 2 (NOVO) — sem id válido → 1ª USG (ordem = 1)
    SELECT data_exame, ig_semanas, ig_dias, ordem
      INTO v_usg_data, v_usg_sem, v_usg_dias, v_usg_ord
    FROM exames_usg
    WHERE paciente_id = p_paciente_id AND ordem = 1
    LIMIT 1;
    IF v_usg_data IS NOT NULL THEN
      v_base  := v_usg_data - ((v_usg_sem * 7) + COALESCE(v_usg_dias, 0));
      v_total := (p_data_alvo - v_base);
      IF v_total < 0 THEN RETURN; END IF;
      RETURN QUERY SELECT v_total / 7, v_total % 7, ('USG #' || v_usg_ord)::text, v_base;
      RETURN;
    END IF;
  END IF;

  -- Precedência 3 — DUM
  IF v_dum IS NOT NULL THEN
    v_total := (p_data_alvo - v_dum);
    IF v_total < 0 THEN RETURN; END IF;
    RETURN QUERY SELECT v_total / 7, v_total % 7, 'DUM'::text, v_dum;
    RETURN;
  END IF;

  -- Precedência 4 — sem âncora: 0 linhas
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.calcular_ig(uuid, date) IS
  'Fonte única de IG. Precedência: USG escolhida (referencia_usg_id) > 1ª USG (ordem=1, se referencia_ig=usg) > DUM > sem âncora. Retorna semanas/dias/origem/base_data.';

-- 2) dum_efetiva — escalar, sql, STABLE, SECURITY DEFINER (inalterado)
CREATE OR REPLACE FUNCTION public.dum_efetiva(p_paciente_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.referencia_ig = 'usg' THEN
      COALESCE(
        -- Precedência 1 (NOVO) — âncora escolhida (referencia_usg_id)
        (SELECT u.data_exame - (u.ig_semanas * 7 + u.ig_dias)
           FROM public.exames_usg u
          WHERE u.id = p.referencia_usg_id),
        -- Precedência 2 — 1ª USG (ordem = 1)
        (SELECT u.data_exame - (u.ig_semanas * 7 + u.ig_dias)
           FROM public.exames_usg u
          WHERE u.paciente_id = p.id AND u.ordem = 1
          LIMIT 1),
        -- Precedência 3 — DUM
        p.dum
      )
    ELSE p.dum
  END
  FROM public.pacientes p
  WHERE p.id = p_paciente_id
$$;

-- Re-afirma a segurança do 20260518150140 (idempotente; o CREATE OR REPLACE já preserva o ACL).
REVOKE EXECUTE ON FUNCTION public.dum_efetiva(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dum_efetiva(uuid) TO authenticated, service_role;
