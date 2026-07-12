ALTER TABLE public.laudo_textos
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'pt-BR';

DROP INDEX IF EXISTS idx_laudo_textos_unico_publicado;
CREATE UNIQUE INDEX idx_laudo_textos_unico_publicado
  ON public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, idioma)
  WHERE status = 'publicado';

DROP INDEX IF EXISTS idx_laudo_textos_chave;
CREATE INDEX idx_laudo_textos_chave
  ON public.laudo_textos (tipo_consulta, desfecho_clinico, status, idioma);