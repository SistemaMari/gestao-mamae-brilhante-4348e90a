
-- 1. Colunas novas em profissionais
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS data_aniversario date,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. feedbacks_usuario
CREATE TABLE IF NOT EXISTS public.feedbacks_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('sugestao','elogio','erro','duvida')),
  mensagem text NOT NULL CHECK (char_length(mensagem) BETWEEN 1 AND 1000),
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedbacks_usuario TO authenticated;
GRANT ALL ON public.feedbacks_usuario TO service_role;
ALTER TABLE public.feedbacks_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feedback insert" ON public.feedbacks_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own feedback select" ON public.feedbacks_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 3. depoimentos_usuario
CREATE TABLE IF NOT EXISTS public.depoimentos_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  texto text CHECK (texto IS NULL OR char_length(texto) <= 1000),
  aprovado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.depoimentos_usuario TO authenticated;
GRANT ALL ON public.depoimentos_usuario TO service_role;
ALTER TABLE public.depoimentos_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own depoimento insert" ON public.depoimentos_usuario
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own depoimento select" ON public.depoimentos_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 4. Storage policies for avatares-profissionais (private bucket)
-- Path convention: {user_id}/avatar.<ext>
CREATE POLICY "avatar own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatares-profissionais' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatar own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares-profissionais' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatar own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares-profissionais' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatar own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatares-profissionais' AND (auth.uid())::text = (storage.foldername(name))[1]);
