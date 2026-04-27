-- ============================================================
-- Atualiza gestor_da_unidade para usar has_role
-- ============================================================
CREATE OR REPLACE FUNCTION public.gestor_da_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'gestor'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.profissionais
      WHERE user_id = _user_id AND unidade_id = _unidade_id
    );
$$;

-- ============================================================
-- CONVITES
-- ============================================================
DROP POLICY IF EXISTS "Gestores podem ver convites da sua unidade" ON public.convites;

CREATE POLICY "Convites: gestor da unidade ou admin podem ver"
ON public.convites FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.gestor_da_unidade(auth.uid(), unidade_id)
);

CREATE POLICY "Convites: gestor da unidade pode criar"
ON public.convites FOR INSERT
TO authenticated
WITH CHECK (
  public.gestor_da_unidade(auth.uid(), unidade_id)
);

CREATE POLICY "Convites: gestor da unidade ou admin podem atualizar"
ON public.convites FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.gestor_da_unidade(auth.uid(), unidade_id)
);

CREATE POLICY "Convites: gestor da unidade ou admin podem remover"
ON public.convites FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.gestor_da_unidade(auth.uid(), unidade_id)
);

-- ============================================================
-- RELATORIOS_UNIDADE
-- ============================================================
DROP POLICY IF EXISTS "Admin pode ver todos os relatorios" ON public.relatorios_unidade;
DROP POLICY IF EXISTS "Gestor da unidade pode ver relatorios da unidade" ON public.relatorios_unidade;
DROP POLICY IF EXISTS "Gestor geral ve relatorios de unidades vinculadas" ON public.relatorios_unidade;
DROP POLICY IF EXISTS "Gestor ou sistema pode inserir relatorios" ON public.relatorios_unidade;

CREATE POLICY "Relatorios unidade: visiveis para admin/gestor/gestor geral"
ON public.relatorios_unidade FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.gestor_da_unidade(auth.uid(), unidade_id)
  OR (
    public.has_role(auth.uid(), 'gestor_geral'::public.app_role)
    AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
  )
);

CREATE POLICY "Relatorios unidade: gestor cria manual, admin cria automatico"
ON public.relatorios_unidade FOR INSERT
TO authenticated
WITH CHECK (
  (origem = 'manual' AND public.gestor_da_unidade(auth.uid(), unidade_id))
  OR (origem = 'automatico' AND public.has_role(auth.uid(), 'admin'::public.app_role))
);