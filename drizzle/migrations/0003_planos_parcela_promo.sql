ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS parcela_12x_cartao_promo numeric(10,2) NULL;
UPDATE public.planos SET parcela_12x_cartao_promo = 41.18 WHERE slug = 'inicial' AND parcela_12x_cartao_promo IS NULL;
UPDATE public.planos SET parcela_12x_cartao_promo = 72.42 WHERE slug = 'intermediaria' AND parcela_12x_cartao_promo IS NULL;
UPDATE public.planos SET parcela_12x_cartao_promo = 155.75 WHERE slug = 'profissional' AND parcela_12x_cartao_promo IS NULL;