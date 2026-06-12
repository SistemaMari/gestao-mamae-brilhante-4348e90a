
-- Fix 1: registros_atendimento — policy quebrada (comparava profissionais.id com auth.uid())
DROP POLICY IF EXISTS prof_ve_registros_unidade_ou_seus ON public.registros_atendimento;

CREATE POLICY prof_ve_registros_unidade_ou_seus
ON public.registros_atendimento
FOR SELECT
TO authenticated
USING (
  profissional_id IN (
    SELECT p.id FROM public.profissionais p
    WHERE p.user_id = auth.uid() AND p.acesso_revogado = false
  )
  OR EXISTS (
    SELECT 1
    FROM public.profissionais me
    JOIN public.profissionais autor ON autor.id = registros_atendimento.profissional_id
    WHERE me.user_id = auth.uid()
      AND me.acesso_revogado = false
      AND me.unidade_id IS NOT NULL
      AND autor.unidade_id IS NOT NULL
      AND me.unidade_id = autor.unidade_id
  )
);

-- Fix 2: perfis_glicemicos — adicionar SELECT para gestor geral das unidades vinculadas
CREATE POLICY "Gestor geral ve perfis das unidades vinculadas"
ON public.perfis_glicemicos
FOR SELECT
TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = perfis_glicemicos.paciente_id
      AND p.unidade_id IS NOT NULL
      AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);
