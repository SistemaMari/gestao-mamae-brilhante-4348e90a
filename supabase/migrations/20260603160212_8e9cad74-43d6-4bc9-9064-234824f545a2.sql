
-- 1. Storage policies for relatorios bucket: enforce acesso_revogado = false
DROP POLICY IF EXISTS "Gestor pode fazer upload na sua unidade" ON storage.objects;
DROP POLICY IF EXISTS "Gestor pode ler arquivos da sua unidade" ON storage.objects;

CREATE POLICY "Gestor pode fazer upload na sua unidade"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'relatorios'
  AND EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.user_id = auth.uid()
      AND p.perfil_institucional = 'gestor'
      AND p.acesso_revogado = false
      AND p.unidade_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Gestor pode ler arquivos da sua unidade"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'relatorios'
  AND EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.user_id = auth.uid()
      AND p.perfil_institucional = 'gestor'
      AND p.acesso_revogado = false
      AND p.unidade_id::text = (storage.foldername(name))[1]
  )
);

-- 2. profissionais self-insert: prevent privilege escalation via trigger
CREATE OR REPLACE FUNCTION public.profissionais_enforce_safe_insert_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_plano_id uuid;
  v_is_admin boolean;
BEGIN
  -- Admins (or service_role) bypass the lockdown
  v_is_admin := public.is_admin(auth.uid());
  IF v_is_admin OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Force safe defaults for any non-admin self-insert
  SELECT id INTO v_default_plano_id
  FROM public.planos
  WHERE slug = 'inicial'
  ORDER BY ordem ASC NULLS LAST
  LIMIT 1;

  IF v_default_plano_id IS NULL THEN
    SELECT id INTO v_default_plano_id
    FROM public.planos
    WHERE ativo = true
    ORDER BY ordem ASC NULLS LAST
    LIMIT 1;
  END IF;

  NEW.plano_id := v_default_plano_id;
  NEW.plano_status := 'ativo';
  NEW.laudos_limite := 10;
  NEW.laudos_usados := 0;
  NEW.acesso_revogado := false;
  NEW.acesso_revogado_por := NULL;
  NEW.acesso_revogado_em := NULL;
  NEW.motivo_revogacao := NULL;
  NEW.asaas_customer_id := NULL;
  NEW.asaas_subscription_id := NULL;
  NEW.stripe_customer_id := NULL;
  NEW.stripe_subscription_id := NULL;
  NEW.plano_expira_em := NULL;
  NEW.proxima_renovacao := NULL;
  NEW.data_inicio_assinatura := NULL;
  NEW.periodo_renovacao := NULL;
  NEW.perfil_institucional := NULL;
  NEW.unidade_id := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profissionais_safe_insert ON public.profissionais;
CREATE TRIGGER trg_profissionais_safe_insert
BEFORE INSERT ON public.profissionais
FOR EACH ROW
EXECUTE FUNCTION public.profissionais_enforce_safe_insert_defaults();

-- 3. consultas: add gestor_geral SELECT policy
CREATE POLICY "Gestor geral ve consultas das unidades vinculadas"
ON public.consultas
FOR SELECT
TO authenticated
USING (
  is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = consultas.paciente_id
      AND p.unidade_id IS NOT NULL
      AND gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

-- 4. valores_perfil: add unit-scoped SELECT policy
CREATE POLICY "Profissional ve valores_perfil de paciente da unidade"
ON public.valores_perfil
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.perfis_glicemicos pg
    JOIN public.pacientes pac ON pac.id = pg.paciente_id
    JOIN public.profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pg.id = valores_perfil.perfil_id
      AND pac.unidade_id IS NOT NULL
      AND pac.unidade_id = prof.unidade_id
  )
);
