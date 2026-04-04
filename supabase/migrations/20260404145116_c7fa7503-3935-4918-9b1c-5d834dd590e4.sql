
-- Tabela de admins (equipe Dra. Mari)
CREATE TABLE public.admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver seus dados" ON public.admins FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Tabela de gestores gerais
CREATE TABLE public.gestores_gerais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.gestores_gerais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestores gerais podem ver seus dados" ON public.gestores_gerais FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Tabela de unidades
CREATE TABLE public.unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Unidades visíveis por autenticados" ON public.unidades FOR SELECT TO authenticated USING (true);

-- Tabela de profissionais (médicos)
CREATE TABLE public.profissionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT NOT NULL,
  crm TEXT,
  especialidade TEXT,
  unidade_id UUID REFERENCES public.unidades(id),
  perfil_institucional TEXT CHECK (perfil_institucional IN ('profissional', 'gestor')),
  plano TEXT NOT NULL DEFAULT 'free' CHECK (plano IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profissionais podem ver seus dados" ON public.profissionais FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profissionais_updated_at
  BEFORE UPDATE ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
