-- ============================================================
-- METAS DA REDE: o gestor geral define metas para a(s) rede(s) dele e os
-- painéis mostram quem atingiu.
--
--  • Tabela metas_rede (uma linha por rede × indicador). Meta é OPCIONAL:
--    sem linha = indicador sem selo.
--  • Indicadores com meta (os números vêm de _linha_cuidado_calc, a mesma
--    conta da seção "Linha de cuidado"):
--      diag_antes_28s_pct   % diagnosticadas antes de 28 semanas   (MÍNIMO, %)
--      perda_seguimento_pct % que deixaram de voltar               (MÁXIMO, %)
--      perfil_completo_pct  % com perfil glicêmico completo        (MÍNIMO, %)
--      ultimo_na_meta_pct   % com o último perfil na meta          (MÍNIMO, %)
--      gj_gtt_mediana_dias  mediana de dias glicemia de jejum→GTT  (MÁXIMO, dias)
--    Mínimo/máximo e a regra de "poucos dados" ficam na tela (src/lib/metas.ts).
--  • Leitura (RLS): admin, gestor geral da rede (rede não encerrada) e
--    gestores/profissionais das unidades da rede.
--  • Escrita SÓ pelas RPCs definir_meta_rede / remover_meta_rede
--    (SECURITY DEFINER): gestor geral vinculado à rede em
--    gestores_gerais_contratantes, com acesso ativo e rede não encerrada — ou admin.
--  • RPC nova get_linha_cuidado_por_unidade_gestor_geral: os mesmos
--    indicadores, uma linha por unidade (tabela "Metas por unidade").
--    Mesma autorização de get_linha_cuidado_gestor_geral.
--
-- Não altera nenhuma função existente.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015140500 (usa _linha_cuidado_calc). Idempotente.
-- ============================================================

-- 1) Tabela ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas_rede (
  contratante_id uuid NOT NULL REFERENCES public.contratantes(id) ON DELETE CASCADE,
  indicador text NOT NULL,
  valor numeric NOT NULL CHECK (valor >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (contratante_id, indicador)
);

-- Lista de indicadores num CHECK com nome fixo (recriado para a lista valer
-- mesmo se a tabela já existir de uma versão anterior).
ALTER TABLE public.metas_rede DROP CONSTRAINT IF EXISTS metas_rede_indicador_check;
ALTER TABLE public.metas_rede ADD CONSTRAINT metas_rede_indicador_check CHECK (indicador IN (
  'diag_antes_28s_pct',
  'perda_seguimento_pct',
  'perfil_completo_pct',
  'ultimo_na_meta_pct',
  'gj_gtt_mediana_dias'
));

-- 2) Quem pode LER as metas de uma rede ------------------------------------------
CREATE OR REPLACE FUNCTION public._pode_ver_metas_rede(_user uuid, _contratante uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user)
    -- gestor geral vinculado à rede (rede não encerrada)
    OR EXISTS (
      SELECT 1
      FROM public.gestores_gerais_contratantes ggc
      JOIN public.gestores_gerais gg ON gg.id = ggc.gestor_geral_id
      JOIN public.contratantes c ON c.id = ggc.contratante_id
      WHERE gg.user_id = _user
        AND gg.acesso_revogado = false
        AND ggc.contratante_id = _contratante
        AND c.status <> 'encerrado'
    )
    -- gestor geral com acesso a alguma unidade da rede (já exclui rede encerrada)
    -- ou gestor/profissional ativo de uma unidade da rede
    OR EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.contratante_id = _contratante
        AND (public.gestor_geral_tem_unidade(_user, u.id) OR public.belongs_to_unidade(_user, u.id))
    );
$$;

REVOKE ALL ON FUNCTION public._pode_ver_metas_rede(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._pode_ver_metas_rede(uuid, uuid) TO authenticated;

-- 3) RLS: só leitura; nenhuma policy de escrita (escrita só pelas RPCs) ----------
ALTER TABLE public.metas_rede ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ler metas da propria rede" ON public.metas_rede;
CREATE POLICY "Ler metas da propria rede"
ON public.metas_rede FOR SELECT TO authenticated
USING (public._pode_ver_metas_rede(auth.uid(), contratante_id));

REVOKE ALL ON public.metas_rede FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.metas_rede FROM authenticated;
GRANT SELECT ON public.metas_rede TO authenticated;

-- 4) Quem pode ESCREVER: gestor geral vinculado à rede (ativa) ou admin ------------
CREATE OR REPLACE FUNCTION public._pode_editar_metas_rede(_user uuid, _contratante uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(_user)
    OR EXISTS (
      SELECT 1
      FROM public.gestores_gerais_contratantes ggc
      JOIN public.gestores_gerais gg ON gg.id = ggc.gestor_geral_id
      JOIN public.contratantes c ON c.id = ggc.contratante_id
      WHERE gg.user_id = _user
        AND gg.acesso_revogado = false
        AND ggc.contratante_id = _contratante
        AND c.status <> 'encerrado'
    );
$$;

REVOKE ALL ON FUNCTION public._pode_editar_metas_rede(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 5) Definir (cria ou atualiza) uma meta ------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_meta_rede(
  p_contratante_id uuid,
  p_indicador text,
  p_valor numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.metas_rede;
BEGIN
  IF p_contratante_id IS NULL OR NOT public._pode_editar_metas_rede(auth.uid(), p_contratante_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_indicador IS NULL OR p_indicador NOT IN (
    'diag_antes_28s_pct', 'perda_seguimento_pct', 'perfil_completo_pct',
    'ultimo_na_meta_pct', 'gj_gtt_mediana_dias'
  ) THEN
    RAISE EXCEPTION 'Indicador inválido: %', p_indicador USING ERRCODE = '22023';
  END IF;
  -- % entre 0 e 100; dias entre 0 e 365.
  IF p_valor IS NULL OR p_valor < 0
     OR (p_indicador LIKE '%\_pct' AND p_valor > 100)
     OR (p_indicador LIKE '%\_dias' AND p_valor > 365) THEN
    RAISE EXCEPTION 'Valor de meta inválido: %', p_valor USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.metas_rede (contratante_id, indicador, valor, atualizado_em, atualizado_por)
  VALUES (p_contratante_id, p_indicador, round(p_valor, 1), now(), auth.uid())
  ON CONFLICT (contratante_id, indicador) DO UPDATE
    SET valor = EXCLUDED.valor,
        atualizado_em = EXCLUDED.atualizado_em,
        atualizado_por = EXCLUDED.atualizado_por
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$function$;

-- 6) Remover uma meta (indicador volta a ficar sem selo) ---------------------------
CREATE OR REPLACE FUNCTION public.remover_meta_rede(
  p_contratante_id uuid,
  p_indicador text
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n int;
BEGIN
  IF p_contratante_id IS NULL OR NOT public._pode_editar_metas_rede(auth.uid(), p_contratante_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.metas_rede
  WHERE contratante_id = p_contratante_id AND indicador = p_indicador;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.definir_meta_rede(uuid, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remover_meta_rede(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meta_rede(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_meta_rede(uuid, text) TO authenticated;

-- 7) Indicadores da linha de cuidado por unidade (gestor geral) --------------------
-- [{ unidade_id, unidade_nome, contratante_id, atual: <_linha_cuidado_calc> }]
-- Só o período escolhido (sem o período anterior).
CREATE OR REPLACE FUNCTION public.get_linha_cuidado_por_unidade_gestor_geral(
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

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'unidade_id', u.id,
             'unidade_nome', u.nome,
             'contratante_id', u.contratante_id,
             'atual', public._linha_cuidado_calc(ARRAY[u.id], p_data_inicio, p_data_fim)
           ) ORDER BY u.nome)
    FROM public.unidades u
    WHERE u.id = ANY(v_unidades)
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_linha_cuidado_por_unidade_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linha_cuidado_por_unidade_gestor_geral(date, date, uuid[]) TO authenticated;
