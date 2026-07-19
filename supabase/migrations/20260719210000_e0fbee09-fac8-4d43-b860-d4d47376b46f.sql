ALTER TABLE public.dicas_dashboard
  ADD COLUMN IF NOT EXISTS texto_en text,
  ADD COLUMN IF NOT EXISTS texto_es text;