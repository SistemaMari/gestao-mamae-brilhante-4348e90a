ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS cnes text,
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cidade text;