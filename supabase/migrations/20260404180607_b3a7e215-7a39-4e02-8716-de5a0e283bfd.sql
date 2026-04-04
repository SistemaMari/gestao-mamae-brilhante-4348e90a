
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id),
  nome TEXT NOT NULL,
  numero_identificacao TEXT,
  dum DATE,
  usg_data DATE,
  usg_ig_semanas INTEGER,
  usg_ig_dias INTEGER,
  status_ficha TEXT NOT NULL DEFAULT 'aguardando_gj',
  dmg_gestacao_anterior BOOLEAN DEFAULT false,
  data_ultima_consulta DATE,
  tipo_retorno TEXT,
  data_proximo_retorno DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- Profissional sees own patients (consultório) or unit patients (institucional)
CREATE POLICY "Profissional ve proprias pacientes ou da unidade"
ON public.pacientes FOR SELECT TO authenticated
USING (
  profissional_id IN (
    SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid()
  )
  OR
  unidade_id IN (
    SELECT p.unidade_id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL
  )
);

-- Profissional can insert patients
CREATE POLICY "Profissional pode criar paciente"
ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (
    SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid()
  )
);

-- Profissional can update own patients or unit patients
CREATE POLICY "Profissional pode atualizar paciente"
ON public.pacientes FOR UPDATE TO authenticated
USING (
  profissional_id IN (
    SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid()
  )
  OR
  unidade_id IN (
    SELECT p.unidade_id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL
  )
);

-- Auto-update updated_at
CREATE TRIGGER update_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
