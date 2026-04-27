-- Tabela de partos
CREATE TABLE public.partos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL,
  profissional_id UUID NOT NULL,
  unidade_id UUID,
  data_parto DATE NOT NULL,
  via_parto TEXT NOT NULL CHECK (via_parto IN ('vaginal', 'cesarea')),
  classificacao_rn TEXT CHECK (classificacao_rn IN ('AIG', 'GIG', 'PIG')),
  peso_rn_g INTEGER,
  ig_parto_semanas INTEGER,
  ig_parto_dias INTEGER,
  intercorrencia_materna BOOLEAN NOT NULL DEFAULT false,
  descricao_intercorrencia_materna TEXT,
  intercorrencia_neonatal BOOLEAN NOT NULL DEFAULT false,
  descricao_intercorrencia_neonatal TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partos_paciente ON public.partos(paciente_id);
CREATE INDEX idx_partos_unidade_data ON public.partos(unidade_id, data_parto);
CREATE INDEX idx_partos_profissional ON public.partos(profissional_id);

ALTER TABLE public.partos ENABLE ROW LEVEL SECURITY;

-- Profissional dono pode ver
CREATE POLICY "Profissional pode ver seus partos"
ON public.partos FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
  OR paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof ON prof.user_id = auth.uid()
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  )
  OR public.is_admin(auth.uid())
  OR public.is_gestor_geral(auth.uid())
);

CREATE POLICY "Profissional pode criar partos"
ON public.partos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
);

CREATE POLICY "Profissional pode atualizar seus partos"
ON public.partos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
);

CREATE POLICY "Profissional pode deletar seus partos"
ON public.partos FOR DELETE TO authenticated
USING (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
);

CREATE TRIGGER update_partos_updated_at
BEFORE UPDATE ON public.partos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();