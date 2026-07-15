
-- 1) Revoke MV access from API roles
REVOKE ALL ON
  public.mv_admin_resumo_global,
  public.mv_admin_profissionais_por_plano,
  public.mv_admin_evolucao_mensal_profissionais_tipo,
  public.mv_admin_evolucao_mensal_profissionais,
  public.mv_admin_evolucao_mensal_planos,
  public.mv_admin_alertas_operacionais,
  public.mv_admin_distribuicao_geografica,
  public.mv_admin_top_cidades,
  public.mv_admin_unidades_resumo,
  public.mv_metricas_unidade,
  public.mv_profissionais_ativos_30d
FROM anon, authenticated;

-- 2) Rescope public-role policies to authenticated

-- contratantes
DROP POLICY IF EXISTS "Gestor geral ve seus contratantes" ON public.contratantes;
CREATE POLICY "Gestor geral ve seus contratantes" ON public.contratantes
FOR SELECT TO authenticated
USING (id IN (
  SELECT ggc.contratante_id
  FROM gestores_gerais_contratantes ggc
  JOIN gestores_gerais gg ON gg.id = ggc.gestor_geral_id
  WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
));

-- gestores_gerais_contratantes
DROP POLICY IF EXISTS "Gestor geral ve seus vinculos ggc" ON public.gestores_gerais_contratantes;
CREATE POLICY "Gestor geral ve seus vinculos ggc" ON public.gestores_gerais_contratantes
FOR SELECT TO authenticated
USING (gestor_geral_id IN (
  SELECT id FROM gestores_gerais
  WHERE user_id = auth.uid() AND acesso_revogado = false
));

-- gestores_gerais_unidades
DROP POLICY IF EXISTS "Gestor geral ve seus vinculos" ON public.gestores_gerais_unidades;
CREATE POLICY "Gestor geral ve seus vinculos" ON public.gestores_gerais_unidades
FOR SELECT TO authenticated
USING (gestor_geral_id IN (
  SELECT id FROM gestores_gerais
  WHERE user_id = auth.uid() AND acesso_revogado = false
));

-- log_transferencia_unidade
DROP POLICY IF EXISTS "Gestor geral ve log dos seus contratantes" ON public.log_transferencia_unidade;
CREATE POLICY "Gestor geral ve log dos seus contratantes" ON public.log_transferencia_unidade
FOR SELECT TO authenticated
USING (
  contratante_destino_id IN (
    SELECT ggc.contratante_id FROM gestores_gerais_contratantes ggc
    JOIN gestores_gerais gg ON gg.id = ggc.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
  OR contratante_origem_id IN (
    SELECT ggc.contratante_id FROM gestores_gerais_contratantes ggc
    JOIN gestores_gerais gg ON gg.id = ggc.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
);

-- consolidacoes
DROP POLICY IF EXISTS "Gestor geral ve seus consolidados" ON public.consolidacoes;
CREATE POLICY "Gestor geral ve seus consolidados" ON public.consolidacoes
FOR SELECT TO authenticated
USING (
  gestor_geral_id IN (
    SELECT id FROM gestores_gerais
    WHERE user_id = auth.uid() AND acesso_revogado = false
  )
  OR is_admin(auth.uid())
);

-- registros_atendimento
DROP POLICY IF EXISTS "gestor_geral_ve_registros" ON public.registros_atendimento;
CREATE POLICY "gestor_geral_ve_registros" ON public.registros_atendimento
FOR SELECT TO authenticated
USING (
  unidade_id IS NOT NULL
  AND unidade_id IN (
    SELECT ggu.unidade_id FROM gestores_gerais_unidades ggu
    JOIN gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = auth.uid() AND gg.acesso_revogado = false
  )
);

-- 3) Storage (consolidados) policies -> authenticated
DROP POLICY IF EXISTS "Consolidados: dono ou admin podem enviar" ON storage.objects;
CREATE POLICY "Consolidados: dono ou admin podem enviar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.acesso_revogado = false
        AND gg.id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Consolidados: dono ou admin podem ver" ON storage.objects;
CREATE POLICY "Consolidados: dono ou admin podem ver" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM gestores_gerais gg
      WHERE gg.user_id = auth.uid()
        AND gg.acesso_revogado = false
        AND gg.id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Gestor geral le seus consolidados" ON storage.objects;
CREATE POLICY "Gestor geral le seus consolidados" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'consolidados'
  AND (
    is_admin(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM gestores_gerais
      WHERE user_id = auth.uid() AND acesso_revogado = false
    )
  )
);

-- 4) Controlled DELETE policy on pacientes: admins only
CREATE POLICY "Admins podem deletar pacientes" ON public.pacientes
FOR DELETE TO authenticated
USING (is_admin(auth.uid()));
