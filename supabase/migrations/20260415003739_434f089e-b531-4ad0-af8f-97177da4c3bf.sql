
-- Table: perfis_glicemicos
CREATE TABLE public.perfis_glicemicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consulta_id UUID NOT NULL REFERENCES public.consultas(id),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id),
  tipo_perfil TEXT NOT NULL DEFAULT '4_pontos',
  peso_paciente_kg NUMERIC(5,1) NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  percentual_meta NUMERIC(5,1) NOT NULL DEFAULT 0,
  decisao TEXT NULL,
  dose_insulina_calculada NUMERIC(6,1) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis_glicemicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver seus perfis" ON public.perfis_glicemicos
  FOR SELECT TO authenticated
  USING (profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode criar perfis" ON public.perfis_glicemicos
  FOR INSERT TO authenticated
  WITH CHECK (profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid()));

CREATE POLICY "Profissional pode atualizar seus perfis" ON public.perfis_glicemicos
  FOR UPDATE TO authenticated
  USING (profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid()));

-- Table: valores_perfil
CREATE TABLE public.valores_perfil (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  perfil_id UUID NOT NULL REFERENCES public.perfis_glicemicos(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  ponto TEXT NOT NULL,
  valor_mgdl INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valores_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode ver valores via perfil" ON public.valores_perfil
  FOR SELECT TO authenticated
  USING (perfil_id IN (SELECT id FROM perfis_glicemicos WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid())));

CREATE POLICY "Profissional pode criar valores" ON public.valores_perfil
  FOR INSERT TO authenticated
  WITH CHECK (perfil_id IN (SELECT id FROM perfis_glicemicos WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid())));

CREATE POLICY "Profissional pode atualizar valores" ON public.valores_perfil
  FOR UPDATE TO authenticated
  USING (perfil_id IN (SELECT id FROM perfis_glicemicos WHERE profissional_id IN (SELECT id FROM profissionais WHERE user_id = auth.uid())));
