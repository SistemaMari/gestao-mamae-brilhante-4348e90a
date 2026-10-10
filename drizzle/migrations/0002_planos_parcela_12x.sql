ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS parcela_12x_cartao numeric(10,2) NULL;
UPDATE public.planos SET parcela_12x_cartao = 41.18  WHERE slug = 'inicial';
UPDATE public.planos SET parcela_12x_cartao = 72.42  WHERE slug = 'intermediaria';
UPDATE public.planos SET parcela_12x_cartao = 155.75 WHERE slug = 'profissional';