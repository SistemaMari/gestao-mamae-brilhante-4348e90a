CREATE TABLE IF NOT EXISTS public.exames_fetais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  morfologico text CHECK (morfologico IN ('normal','alterado')),
  pfe_us text CHECK (pfe_us IN ('sim','nao')),
  ca text CHECK (ca IN ('sim','nao')),
  la text CHECK (la IN ('sim','nao')),
  crescimento text CHECK (crescimento IN ('adequado','restrito','excessivo')),
  cmf text CHECK (cmf IN ('normal','diminuido')),
  ctg text CHECK (ctg IN ('tranquilizador','nao_tranquilizador')),
  pbf text CHECK (pbf IN ('sim','nao')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exames_fetais TO authenticated;
GRANT ALL ON public.exames_fetais TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS exames_fetais_consulta_uq
  ON public.exames_fetais(consulta_id);
CREATE INDEX IF NOT EXISTS exames_fetais_paciente_idx
  ON public.exames_fetais(paciente_id);

ALTER TABLE public.exames_fetais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional ve exames fetais de pacientes vinculadas"
ON public.exames_fetais FOR SELECT TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional cria exames fetais de paciente vinculada"
ON public.exames_fetais FOR INSERT TO authenticated
WITH CHECK (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional atualiza exames fetais de paciente vinculada"
ON public.exames_fetais FOR UPDATE TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional deleta exames fetais de paciente vinculada"
ON public.exames_fetais FOR DELETE TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Gestor geral ve exames fetais das unidades vinculadas"
ON public.exames_fetais FOR SELECT TO authenticated
USING (
  is_gestor_geral(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = exames_fetais.paciente_id
      AND p.unidade_id IS NOT NULL
      AND gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

CREATE TRIGGER exames_fetais_set_updated_at
BEFORE UPDATE ON public.exames_fetais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();