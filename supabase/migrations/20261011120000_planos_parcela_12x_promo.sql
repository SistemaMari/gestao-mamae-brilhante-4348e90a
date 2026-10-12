-- ============================================================
-- Parcela em 12× da PROMOÇÃO separada da parcela do PREÇO CHEIO (out/2026).
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
-- Idempotente.
--
-- A tela de planos mostra:
--   promoção ligada    → parcela_12x_cartao_promo
--   promoção desligada → parcela_12x_cartao (preço cheio)
-- Assim, no fim da promoção basta editar o valor nos links do Asaas e
-- desligar o botão em /admin/planos.
-- ============================================================

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS parcela_12x_cartao_promo numeric(10,2) NULL;

-- Parcelas dos links promocionais de lançamento (as mesmas de antes).
-- Só preenche se ainda estiver vazio — não sobrescreve o que for editado no admin.
UPDATE public.planos SET parcela_12x_cartao_promo = 41.18  WHERE slug = 'inicial'       AND parcela_12x_cartao_promo IS NULL;
UPDATE public.planos SET parcela_12x_cartao_promo = 72.42  WHERE slug = 'intermediaria' AND parcela_12x_cartao_promo IS NULL;
UPDATE public.planos SET parcela_12x_cartao_promo = 155.75 WHERE slug = 'profissional'  AND parcela_12x_cartao_promo IS NULL;

-- Conferência: a coluna parcela_12x_cartao deve estar com o preço cheio
-- (82.36 / 144.84 / 311.50) e a nova com a promoção (41.18 / 72.42 / 155.75).
SELECT slug, parcela_12x_cartao AS preco_cheio, parcela_12x_cartao_promo AS promocao
FROM public.planos
ORDER BY ordem;
