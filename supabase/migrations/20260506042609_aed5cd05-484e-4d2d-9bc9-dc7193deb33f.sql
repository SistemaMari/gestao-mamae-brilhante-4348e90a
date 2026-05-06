CREATE TABLE public.log_mudanca_plano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id),
  plano_anterior_id uuid REFERENCES public.planos(id),
  plano_novo_id uuid REFERENCES public.planos(id),
  motivo text NOT NULL,
  alterado_por uuid NOT NULL,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.log_mudanca_plano ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log mudanca plano"
  ON public.log_mudanca_plano FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins inserem log mudanca plano"
  ON public.log_mudanca_plano FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_log_mudanca_plano_prof ON public.log_mudanca_plano(profissional_id, alterado_em DESC);