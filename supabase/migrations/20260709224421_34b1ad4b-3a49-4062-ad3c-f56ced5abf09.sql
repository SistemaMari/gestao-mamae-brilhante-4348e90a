-- 1. TABELA
CREATE TABLE IF NOT EXISTS public.tutoriais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil         text NOT NULL CHECK (perfil IN (
                   'consultorio', 'institucional', 'gestor', 'gestor_geral', 'admin'
                 )),
  titulo         text NOT NULL,
  descricao      text,
  video_path     text,
  thumbnail_path text,
  ordem          integer NOT NULL DEFAULT 0,
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoriais TO authenticated;
GRANT ALL ON public.tutoriais TO service_role;

CREATE INDEX IF NOT EXISTS idx_tutoriais_perfil_ordem
  ON public.tutoriais (perfil, ordem)
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.tutoriais_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutoriais_updated_at ON public.tutoriais;
CREATE TRIGGER trg_tutoriais_updated_at
  BEFORE UPDATE ON public.tutoriais
  FOR EACH ROW EXECUTE FUNCTION public.tutoriais_set_updated_at();

-- 2. RLS DA TABELA
ALTER TABLE public.tutoriais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados veem tutoriais ativos" ON public.tutoriais;
CREATE POLICY "Autenticados veem tutoriais ativos"
ON public.tutoriais FOR SELECT TO authenticated
USING (ativo = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin insere tutoriais" ON public.tutoriais;
CREATE POLICY "Admin insere tutoriais"
ON public.tutoriais FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin atualiza tutoriais" ON public.tutoriais;
CREATE POLICY "Admin atualiza tutoriais"
ON public.tutoriais FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin deleta tutoriais" ON public.tutoriais;
CREATE POLICY "Admin deleta tutoriais"
ON public.tutoriais FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. POLICIES DO STORAGE (bucket 'tutoriais' privado)
DROP POLICY IF EXISTS "Public read tutoriais bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read tutoriais bucket" ON storage.objects;
CREATE POLICY "Authenticated read tutoriais bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutoriais');

DROP POLICY IF EXISTS "Admin upload tutoriais" ON storage.objects;
CREATE POLICY "Admin upload tutoriais"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutoriais' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin update tutoriais" ON storage.objects;
CREATE POLICY "Admin update tutoriais"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tutoriais' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin delete tutoriais" ON storage.objects;
CREATE POLICY "Admin delete tutoriais"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutoriais' AND public.has_role(auth.uid(), 'admin'::public.app_role));