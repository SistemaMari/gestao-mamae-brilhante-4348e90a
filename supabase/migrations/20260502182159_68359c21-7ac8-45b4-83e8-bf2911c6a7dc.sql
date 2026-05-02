-- Tabela `cursos`: catálogo central dos cursos oferecidos como bônus dos planos.
-- Consumida pela tela /meus-cursos e pela futura Edge Function de e-mail de boas-vindas.

CREATE TABLE public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  link_eduzz TEXT,
  plano_minimo TEXT NOT NULL DEFAULT 'inicial',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler cursos ativos (a UI filtra por plano).
CREATE POLICY "Cursos ativos visíveis para autenticados"
ON public.cursos
FOR SELECT
TO authenticated
USING (ativo = true OR public.is_admin(auth.uid()));

-- Só admin gerencia.
CREATE POLICY "Admins inserem cursos"
ON public.cursos
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins atualizam cursos"
ON public.cursos
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins removem cursos"
ON public.cursos
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger updated_at.
CREATE TRIGGER trg_cursos_updated_at
BEFORE UPDATE ON public.cursos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial (com link_eduzz = NULL — Ana Rafaela preenche depois).
INSERT INTO public.cursos (slug, nome, descricao, plano_minimo, ordem) VALUES
  ('hiperglicemia',         'Hiperglicemia na Gestação',  'Fundamentos do manejo da hiperglicemia gestacional.',         'inicial',       1),
  ('insulinoterapia',       'Insulinoterapia em DMG',     'Quando, como e quanto iniciar insulina na gestante com DMG.', 'intermediaria', 2),
  ('novos-paradigmas-dmg',  'Novos Paradigmas em DMG',    'Atualização avançada baseada nas evidências mais recentes.',  'profissional',  3);
