-- ============================================================
-- Fase 2 — laudo multilíngue (1/2): coluna idioma + índices.
-- 🚨 RODAR ANTES do deploy do código E antes do INSERT das linhas EN/ES.
--    O código passa a filtrar laudo_textos por `idioma`; sem esta coluna,
--    gerar-laudo/obter-textos-laudo/editor quebram (coluna inexistente).
-- Linhas existentes viram 'pt-BR'. Aplicar à mão no Supabase (não roda no Publish).
-- ============================================================

ALTER TABLE public.laudo_textos
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'pt-BR';

-- 1 texto PUBLICADO por (tipo, desfecho, bloco, IDIOMA)
DROP INDEX IF EXISTS idx_laudo_textos_unico_publicado;
CREATE UNIQUE INDEX idx_laudo_textos_unico_publicado
  ON public.laudo_textos (tipo_consulta, desfecho_clinico, bloco, idioma)
  WHERE status = 'publicado';

-- índice de leitura passa a incluir idioma
DROP INDEX IF EXISTS idx_laudo_textos_chave;
CREATE INDEX idx_laudo_textos_chave
  ON public.laudo_textos (tipo_consulta, desfecho_clinico, status, idioma);
