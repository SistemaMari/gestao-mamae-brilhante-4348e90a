
-- Recria as políticas adicionando AND gg.acesso_revogado = false

-- 1) consolidacoes SELECT
DROP POLICY IF EXISTS "Gestor geral ve seus consolidados" ON public.consolidacoes;
CREATE POLICY "Gestor geral ve seus consolidados"
ON public.consolidacoes
FOR SELECT
USING (
  (gestor_geral_id IN (
    SELECT id FROM public.gestores_gerais
    WHERE user_id = auth.uid() AND acesso_revogado = false
  ))
  OR is_admin(auth.uid())
);

-- 2) contratantes SELECT
DROP POLICY IF EXISTS "Gestor geral ve seus contratantes" ON public.contratantes;
CREATE POLICY "Gestor geral ve seus contratantes"
ON public.contratantes
FOR SELECT
USING (
  id IN (
    SELECT ggc.contratante_id
    FROM public.gestores_gerais_contratantes ggc
    JOIN public.gestores_gerais gg ON gg.id = ggc.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
);

-- 3) gestores_gerais_contratantes SELECT
DROP POLICY IF EXISTS "Gestor geral ve seus vinculos ggc" ON public.gestores_gerais_contratantes;
CREATE POLICY "Gestor geral ve seus vinculos ggc"
ON public.gestores_gerais_contratantes
FOR SELECT
USING (
  gestor_geral_id IN (
    SELECT id FROM public.gestores_gerais
    WHERE user_id = auth.uid() AND acesso_revogado = false
  )
);

-- 4) gestores_gerais_unidades SELECT
DROP POLICY IF EXISTS "Gestor geral ve seus vinculos" ON public.gestores_gerais_unidades;
CREATE POLICY "Gestor geral ve seus vinculos"
ON public.gestores_gerais_unidades
FOR SELECT
USING (
  gestor_geral_id IN (
    SELECT id FROM public.gestores_gerais
    WHERE user_id = auth.uid() AND acesso_revogado = false
  )
);

-- 5) registros_atendimento SELECT (gestor_geral_ve_registros)
DROP POLICY IF EXISTS "gestor_geral_ve_registros" ON public.registros_atendimento;
CREATE POLICY "gestor_geral_ve_registros"
ON public.registros_atendimento
FOR SELECT
USING (
  unidade_id IS NOT NULL
  AND unidade_id IN (
    SELECT ggu.unidade_id
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
);

-- 6) log_transferencia_unidade SELECT
DROP POLICY IF EXISTS "Gestor geral ve log dos seus contratantes" ON public.log_transferencia_unidade;
CREATE POLICY "Gestor geral ve log dos seus contratantes"
ON public.log_transferencia_unidade
FOR SELECT
USING (
  contratante_destino_id IN (
    SELECT ggc.contratante_id
    FROM public.gestores_gerais_contratantes ggc
    JOIN public.gestores_gerais gg ON gg.id = ggc.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
  OR contratante_origem_id IN (
    SELECT ggc.contratante_id
    FROM public.gestores_gerais_contratantes ggc
    JOIN public.gestores_gerais gg ON gg.id = ggc.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
);

-- 7) storage.objects — bucket consolidados (SELECT x2 + INSERT)
DROP POLICY IF EXISTS "Consolidados: dono ou admin podem ver" ON storage.objects;
CREATE POLICY "Consolidados: dono ou admin podem ver"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.acesso_revogado = false
        AND gg.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Gestor geral le seus consolidados" ON storage.objects;
CREATE POLICY "Gestor geral le seus consolidados"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.gestores_gerais
      WHERE user_id = auth.uid() AND acesso_revogado = false
    )
  )
);

DROP POLICY IF EXISTS "Consolidados: dono ou admin podem enviar" ON storage.objects;
CREATE POLICY "Consolidados: dono ou admin podem enviar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.acesso_revogado = false
        AND gg.id::text = (storage.foldername(objects.name))[1]
    )
  )
);
