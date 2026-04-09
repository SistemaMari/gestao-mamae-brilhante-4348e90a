
-- Tabela para armazenar laudos gerados pela IA
CREATE TABLE public.laudos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  consulta_id UUID NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  cenario_clinico TEXT,
  conteudo_laudo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.laudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver seus laudos"
ON public.laudos FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid())
  OR paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid()
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  )
);

CREATE POLICY "Profissional pode criar laudos"
ON public.laudos FOR INSERT TO authenticated
WITH CHECK (profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode atualizar seus laudos"
ON public.laudos FOR UPDATE TO authenticated
USING (profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid()));

CREATE TRIGGER update_laudos_updated_at
BEFORE UPDATE ON public.laudos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
