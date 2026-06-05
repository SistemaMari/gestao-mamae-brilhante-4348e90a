
CREATE TABLE public.decisoes_ficha_a (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid NOT NULL UNIQUE REFERENCES public.consultas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,

  checklist_dieta boolean,
  checklist_exercicio boolean,
  checklist_ganho_peso boolean,
  checklist_pfe_us text CHECK (checklist_pfe_us IN ('sim','nao','sem_info')),
  checklist_ca text CHECK (checklist_ca IN ('sim','nao','sem_info')),
  checklist_la text CHECK (checklist_la IN ('sim','nao','sem_info')),

  percentual_meta numeric(5,1),

  regra_aplicada text CHECK (regra_aplicada IN ('regra_manter','regra_2','regra_3','regra_4')),
  conduta_gerada text CHECK (conduta_gerada IN ('manter_mev','reforcar_mev','insulina','avaliar_memoria')),

  memoria_glicosimetro text CHECK (memoria_glicosimetro IN ('confirma','nao_confirma')),
  pactuacao_adesao text CHECK (pactuacao_adesao IN ('aceita','recusa')),

  dose_insulina_total numeric(6,1),
  dose_insulina_manha numeric(6,1),
  dose_insulina_noite numeric(6,1),

  proxima_ficha_recomendada text CHECK (proxima_ficha_recomendada IN ('ficha_a','ficha_b','ficha_c','ficha_d','ficha_e')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisoes_ficha_a_paciente ON public.decisoes_ficha_a(paciente_id);
CREATE INDEX idx_decisoes_ficha_a_profissional ON public.decisoes_ficha_a(profissional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisoes_ficha_a TO authenticated;
GRANT ALL ON public.decisoes_ficha_a TO service_role;

ALTER TABLE public.decisoes_ficha_a ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional ve suas decisoes ficha_a"
  ON public.decisoes_ficha_a FOR SELECT
  TO authenticated
  USING (
    profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
    OR paciente_id IN (
      SELECT pac.id FROM public.pacientes pac
      JOIN public.profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
      WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
    )
  );

CREATE POLICY "Profissional cria suas decisoes ficha_a"
  ON public.decisoes_ficha_a FOR INSERT
  TO authenticated
  WITH CHECK (
    profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  );

CREATE POLICY "Profissional atualiza suas decisoes ficha_a"
  ON public.decisoes_ficha_a FOR UPDATE
  TO authenticated
  USING (
    profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  );

CREATE TRIGGER trg_decisoes_ficha_a_updated_at
  BEFORE UPDATE ON public.decisoes_ficha_a
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
