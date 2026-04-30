-- 1. Tabela planos
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  preco_mensal numeric(10,2) NOT NULL,
  laudos_por_mes integer NOT NULL,
  pacientes_max integer,
  suporte text NOT NULL,
  cursos_inclusos text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER planos_set_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.planos (slug, nome, preco_mensal, laudos_por_mes, pacientes_max, suporte, cursos_inclusos, ordem) VALUES
  ('inicial',       'Inicial',       79.00,  10,  NULL, 'email',       ARRAY['hiperglicemia'], 1),
  ('intermediaria', 'Intermediária', 139.00, 35,  NULL, 'email',       ARRAY['hiperglicemia','insulinoterapia'], 2),
  ('profissional',  'Profissional',  299.00, 100, NULL, 'prioritario', ARRAY['hiperglicemia','insulinoterapia','novos-paradigmas-dmg'], 3);

CREATE POLICY "Planos visiveis para autenticados" ON public.planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins inserem planos" ON public.planos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins atualizam planos" ON public.planos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins removem planos" ON public.planos
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 2. plano_id em profissionais
ALTER TABLE public.profissionais ADD COLUMN plano_id uuid REFERENCES public.planos(id);

UPDATE public.profissionais
SET plano_id = (SELECT id FROM public.planos WHERE slug = 'inicial');

ALTER TABLE public.profissionais ALTER COLUMN plano_id SET NOT NULL;

-- 3. Sincronizar laudos
UPDATE public.profissionais p
SET laudos_limite = pl.laudos_por_mes,
    laudos_usados = 0
FROM public.planos pl
WHERE p.plano_id = pl.id;

-- 4. pode_criar_ficha simplificada (sem limite Free)
CREATE OR REPLACE FUNCTION public.pode_criar_ficha(p_profissional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profissionais WHERE id = p_profissional_id);
$$;

-- 5. tipos_unidade
CREATE TABLE public.tipos_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_unidade ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tipos_unidade (slug, nome) VALUES
  ('ubs','UBS'),
  ('usf','USF'),
  ('hospital','Hospital'),
  ('hospital-universitario','Hospital Universitário'),
  ('maternidade','Maternidade'),
  ('clinica-particular','Clínica Particular'),
  ('clinica-da-familia','Clínica da Família'),
  ('plano-de-saude','Plano de Saúde'),
  ('consultorio','Consultório'),
  ('outro','Outro');

CREATE POLICY "Tipos unidade visiveis para autenticados" ON public.tipos_unidade
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins inserem tipos unidade" ON public.tipos_unidade
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins atualizam tipos unidade" ON public.tipos_unidade
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins removem tipos unidade" ON public.tipos_unidade
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 6. tipo_id em unidades
ALTER TABLE public.unidades ADD COLUMN tipo_id uuid REFERENCES public.tipos_unidade(id);

UPDATE public.unidades SET tipo_id = (SELECT id FROM public.tipos_unidade WHERE slug='hospital')   WHERE tipo='hospital';
UPDATE public.unidades SET tipo_id = (SELECT id FROM public.tipos_unidade WHERE slug='maternidade') WHERE tipo='maternidade';