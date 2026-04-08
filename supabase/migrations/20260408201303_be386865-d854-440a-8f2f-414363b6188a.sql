ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS pais text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS tipo_identificacao text;