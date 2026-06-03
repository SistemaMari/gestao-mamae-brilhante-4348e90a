
-- 1. Fix gestor_da_unidade to exclude revoked access
CREATE OR REPLACE FUNCTION public.gestor_da_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.user_id = _user_id
      AND p.unidade_id = _unidade_id
      AND p.perfil_institucional = 'gestor'
      AND p.acesso_revogado = false
  )
$$;

-- 2. Remove overly-broad storage policy for relatorios bucket
DROP POLICY IF EXISTS "Gestor geral pode ler todos os relatorios" ON storage.objects;

-- 3. Fix gestor_ve_registros_unidade to exclude revoked
DROP POLICY IF EXISTS gestor_ve_registros_unidade ON public.registros_atendimento;
CREATE POLICY gestor_ve_registros_unidade
ON public.registros_atendimento
FOR SELECT
TO authenticated
USING (
  unidade_id IS NOT NULL
  AND unidade_id IN (
    SELECT profissionais.unidade_id FROM profissionais
    WHERE profissionais.user_id = auth.uid()
      AND profissionais.perfil_institucional = 'gestor'
      AND profissionais.acesso_revogado = false
  )
);

-- 4. Restrict partos SELECT to authenticated role
DROP POLICY IF EXISTS "Profissional pode ver seus partos" ON public.partos;
CREATE POLICY "Profissional pode ver seus partos"
ON public.partos
FOR SELECT
TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
  OR is_admin(auth.uid())
  OR (is_gestor_geral(auth.uid()) AND EXISTS (
    SELECT 1 FROM pacientes pac2
    WHERE pac2.id = partos.paciente_id
      AND pac2.unidade_id IS NOT NULL
      AND gestor_geral_tem_unidade(auth.uid(), pac2.unidade_id)
  ))
);

-- 5. Extend perfis_glicemicos SELECT to include unit colleagues
DROP POLICY IF EXISTS "Profissional pode ver seus perfis" ON public.perfis_glicemicos;
CREATE POLICY "Profissional pode ver seus perfis"
ON public.perfis_glicemicos
FOR SELECT
TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
);
