-- Helper: verifica se o usuário é gestor da unidade indicada
CREATE OR REPLACE FUNCTION public.gestor_da_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profissionais
    WHERE user_id = _user_id
      AND unidade_id = _unidade_id
      AND perfil_institucional = 'gestor'
  );
$$;

-- ============================================================
-- BUCKET: relatorios — pasta = unidade_id
-- ============================================================

CREATE POLICY "Relatorios: gestor/gestor_geral/admin podem ver"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND (
    public.is_admin(auth.uid())
    OR public.gestor_da_unidade(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (
      public.is_gestor_geral(auth.uid())
      AND public.gestor_geral_tem_unidade(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  )
);

CREATE POLICY "Relatorios: gestor da unidade ou admin podem enviar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'relatorios'
  AND (
    public.is_admin(auth.uid())
    OR public.gestor_da_unidade(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Relatorios: admin pode atualizar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'relatorios' AND public.is_admin(auth.uid()));

CREATE POLICY "Relatorios: admin pode remover"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'relatorios' AND public.is_admin(auth.uid()));

-- ============================================================
-- BUCKET: consolidados — pasta = gestor_geral_id
-- ============================================================

CREATE POLICY "Consolidados: dono ou admin podem ver"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consolidados'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Consolidados: dono ou admin podem enviar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'consolidados'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "Consolidados: admin pode atualizar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'consolidados' AND public.is_admin(auth.uid()));

CREATE POLICY "Consolidados: admin pode remover"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'consolidados' AND public.is_admin(auth.uid()));