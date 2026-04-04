
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS idioma text DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS identificador_padrao text DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS telefone text;
