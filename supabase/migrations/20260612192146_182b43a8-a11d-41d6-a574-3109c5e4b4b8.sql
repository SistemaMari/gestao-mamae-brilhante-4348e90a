-- 37A-2: Adicionar visibilidade por unidade ao Histórico de atendimentos
-- Profissionais institucionais da mesma unidade passam a ver registros uns dos outros.
-- Consultório solo (unidade_id IS NULL) preserva visibilidade apenas do dono.

DROP POLICY IF EXISTS "prof_ve_seus_registros" ON public.registros_atendimento;

CREATE POLICY "prof_ve_registros_unidade_ou_seus"
ON public.registros_atendimento
FOR SELECT
TO authenticated
USING (
  -- Caso 1: dono do registro sempre vê (cobre consultório solo e fallback)
  profissional_id = auth.uid()
  OR
  -- Caso 2: profissional da mesma unidade vê registros de colegas (institucional)
  EXISTS (
    SELECT 1
    FROM public.profissionais me
    JOIN public.profissionais autor
      ON autor.id = registros_atendimento.profissional_id
    WHERE me.id = auth.uid()
      AND me.unidade_id IS NOT NULL
      AND autor.unidade_id IS NOT NULL
      AND me.unidade_id = autor.unidade_id
  )
);