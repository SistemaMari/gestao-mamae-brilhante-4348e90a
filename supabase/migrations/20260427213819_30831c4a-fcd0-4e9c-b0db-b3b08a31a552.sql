ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS is_rascunho boolean NOT NULL DEFAULT false;
ALTER TABLE public.consultas ADD COLUMN IF NOT EXISTS is_rascunho boolean NOT NULL DEFAULT false;
ALTER TABLE public.partos ADD COLUMN IF NOT EXISTS is_rascunho boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pacientes_rascunho ON public.pacientes(profissional_id, is_rascunho) WHERE is_rascunho = true;
CREATE INDEX IF NOT EXISTS idx_consultas_rascunho ON public.consultas(profissional_id, is_rascunho) WHERE is_rascunho = true;
CREATE INDEX IF NOT EXISTS idx_partos_rascunho ON public.partos(profissional_id, is_rascunho) WHERE is_rascunho = true;