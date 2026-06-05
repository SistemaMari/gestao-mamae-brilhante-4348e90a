
ALTER TABLE public.perfis_glicemicos
  ADD COLUMN IF NOT EXISTS conduta_e text CHECK (conduta_e IN ('manter_e','insulina')),
  ADD COLUMN IF NOT EXISTS dose_insulina_manha numeric(6,1),
  ADD COLUMN IF NOT EXISTS dose_insulina_noite numeric(6,1),
  ADD COLUMN IF NOT EXISTS proxima_ficha_recomendada text CHECK (proxima_ficha_recomendada IN ('ficha_a','ficha_b','ficha_c','ficha_d','ficha_e'));
