-- ============================================================
-- Tela "Tutorial" (vídeos por perfil) — tabela + bucket + RLS
-- ------------------------------------------------------------
-- ⚠️ Esta migration NÃO roda automaticamente no Publish do Lovable.
--    Rodar este SQL À MÃO no Supabase (SQL Editor). O arquivo aqui
--    serve como histórico versionado.
-- ============================================================

-- 1. Tabela ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutoriais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil         text NOT NULL CHECK (perfil IN (
                   'consultorio', 'institucional', 'gestor', 'gestor_geral', 'admin'
                 )),
  titulo         text NOT NULL,
  descricao      text,
  video_path     text,          -- caminho do vídeo no bucket 'tutoriais' (null = placeholder)
  thumbnail_path text,          -- caminho da thumbnail no bucket (null = usa poster/placeholder)
  ordem          integer NOT NULL DEFAULT 0,
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutoriais_perfil_ordem
  ON public.tutoriais (perfil, ordem)
  WHERE ativo = true;

-- updated_at automático (trigger dedicado, sem depender de função global)
CREATE OR REPLACE FUNCTION public.tutoriais_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutoriais_updated_at ON public.tutoriais;
CREATE TRIGGER trg_tutoriais_updated_at
  BEFORE UPDATE ON public.tutoriais
  FOR EACH ROW EXECUTE FUNCTION public.tutoriais_set_updated_at();

-- 2. RLS da tabela -------------------------------------------
ALTER TABLE public.tutoriais ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado vê tutoriais ativos.
-- Admin enxerga também os inativos (para gerenciar).
DROP POLICY IF EXISTS "Autenticados veem tutoriais ativos" ON public.tutoriais;
CREATE POLICY "Autenticados veem tutoriais ativos"
ON public.tutoriais FOR SELECT TO authenticated
USING (
  ativo = true
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Somente admin gerencia (insert/update/delete).
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

-- 3. Bucket de storage ---------------------------------------
-- Bucket PRIVADO (o workspace bloqueia buckets públicos). O front serve
-- vídeo/thumbnail via signed URL (TutorialPage.tsx usa createSignedUrl).
-- ⚠️ O bucket é criado pela ferramenta de storage do Lovable (INSERT direto em
--    storage.buckets é bloqueado) — este INSERT fica só como referência.
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('tutoriais', 'tutoriais', false)
-- ON CONFLICT (id) DO NOTHING;

-- Leitura só por autenticado (permite gerar signed URL; anônimo não).
DROP POLICY IF EXISTS "Public read tutoriais bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read tutoriais bucket" ON storage.objects;
CREATE POLICY "Authenticated read tutoriais bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutoriais');

-- Upload/alteração/remoção só por admin.
DROP POLICY IF EXISTS "Admin upload tutoriais" ON storage.objects;
CREATE POLICY "Admin upload tutoriais"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tutoriais'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admin update tutoriais" ON storage.objects;
CREATE POLICY "Admin update tutoriais"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tutoriais'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admin delete tutoriais" ON storage.objects;
CREATE POLICY "Admin delete tutoriais"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tutoriais'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
