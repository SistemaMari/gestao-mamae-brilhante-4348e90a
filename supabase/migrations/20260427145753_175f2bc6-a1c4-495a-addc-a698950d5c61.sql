-- 1. Tabela de vínculos gestor_geral <-> unidades
CREATE TABLE IF NOT EXISTS public.gestores_gerais_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_geral_id UUID NOT NULL REFERENCES public.gestores_gerais(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gestor_geral_id, unidade_id)
);

CREATE INDEX IF NOT EXISTS idx_ggu_gestor ON public.gestores_gerais_unidades(gestor_geral_id);
CREATE INDEX IF NOT EXISTS idx_ggu_unidade ON public.gestores_gerais_unidades(unidade_id);

ALTER TABLE public.gestores_gerais_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam vinculos"
  ON public.gestores_gerais_unidades FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Gestor geral ve seus vinculos"
  ON public.gestores_gerais_unidades FOR SELECT
  TO authenticated
  USING (
    gestor_geral_id IN (
      SELECT id FROM public.gestores_gerais WHERE user_id = auth.uid()
    )
  );

-- 2. Helper: verifica se gestor geral tem acesso a uma unidade
CREATE OR REPLACE FUNCTION public.gestor_geral_tem_unidade(_user_id UUID, _unidade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = _user_id AND ggu.unidade_id = _unidade_id
  );
$$;

-- 3. Substitui policy de gestor geral em relatorios_unidade
DROP POLICY IF EXISTS "Gestor geral pode ver todos os relatorios" ON public.relatorios_unidade;

CREATE POLICY "Gestor geral ve relatorios de unidades vinculadas"
  ON public.relatorios_unidade FOR SELECT
  TO authenticated
  USING (
    public.is_gestor_geral(auth.uid())
    AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
  );

-- 4. Ajusta policy de unidades para gestor geral ver só vinculadas
DROP POLICY IF EXISTS "Unidades visíveis por membros e admins" ON public.unidades;

CREATE POLICY "Unidades visiveis"
  ON public.unidades FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.belongs_to_unidade(auth.uid(), id)
    OR (public.is_gestor_geral(auth.uid()) AND public.gestor_geral_tem_unidade(auth.uid(), id))
  );

-- 5. Tabela consolidacoes
CREATE TABLE IF NOT EXISTS public.consolidacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gestor_geral_id UUID NOT NULL REFERENCES public.gestores_gerais(id) ON DELETE CASCADE,
  relatorio_ids UUID[] NOT NULL,
  unidades_incluidas INTEGER NOT NULL DEFAULT 0,
  periodo_inicio DATE,
  periodo_fim DATE,
  pdf_path TEXT,
  csv_path TEXT,
  notas JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consolidacoes_gestor ON public.consolidacoes(gestor_geral_id);
CREATE INDEX IF NOT EXISTS idx_consolidacoes_created ON public.consolidacoes(created_at DESC);

ALTER TABLE public.consolidacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor geral ve seus consolidados"
  ON public.consolidacoes FOR SELECT
  TO authenticated
  USING (
    gestor_geral_id IN (SELECT id FROM public.gestores_gerais WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Gestor geral cria consolidados"
  ON public.consolidacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    gestor_geral_id IN (SELECT id FROM public.gestores_gerais WHERE user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- 6. Bucket 'consolidados' (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('consolidados', 'consolidados', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage para consolidados
CREATE POLICY "Gestor geral le seus consolidados"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consolidados'
    AND (
      public.is_admin(auth.uid())
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.gestores_gerais WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role gerencia consolidados"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'consolidados')
  WITH CHECK (bucket_id = 'consolidados');