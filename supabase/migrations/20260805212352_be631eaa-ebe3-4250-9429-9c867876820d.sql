ALTER TABLE public.perfis_glicemicos
  DROP CONSTRAINT IF EXISTS perfis_glicemicos_paciente_id_fkey,
  ADD  CONSTRAINT perfis_glicemicos_paciente_id_fkey
       FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

ALTER TABLE public.perfis_glicemicos
  DROP CONSTRAINT IF EXISTS perfis_glicemicos_consulta_id_fkey,
  ADD  CONSTRAINT perfis_glicemicos_consulta_id_fkey
       FOREIGN KEY (consulta_id) REFERENCES public.consultas(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Excluir gestante por perfil autorizado" ON public.pacientes;

CREATE POLICY "Excluir gestante por perfil autorizado"
ON public.pacientes FOR DELETE TO authenticated
USING (
  (
    unidade_id IS NULL
    AND profissional_id IN (
      SELECT p.id FROM public.profissionais p
      WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE AND p.unidade_id IS NULL
    )
  )
  OR (
    unidade_id IS NOT NULL
    AND (
      public.gestor_da_unidade(auth.uid(), unidade_id)
      OR (public.is_gestor_geral(auth.uid()) AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id))
    )
  )
);