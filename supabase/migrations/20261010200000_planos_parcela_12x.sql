-- ============================================================
-- Valor da parcela em 12× no cartão (com juros) de cada plano, para a aba de
-- planos do app mostrar "12× R$ X ou R$ Y à vista", igual à página de vendas.
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
-- Idempotente.
--
-- O valor vem do próprio link do Asaas (opção 12× no checkout). Quando trocar
-- um link em /admin/planos (ex.: fim da promoção), atualize também a parcela.
-- ============================================================

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS parcela_12x_cartao numeric(10,2) NULL;

-- Links promocionais de lançamento (out/2026)
UPDATE public.planos SET parcela_12x_cartao = 41.18  WHERE slug = 'inicial';
UPDATE public.planos SET parcela_12x_cartao = 72.42  WHERE slug = 'intermediaria';
UPDATE public.planos SET parcela_12x_cartao = 155.75 WHERE slug = 'profissional';

-- Conferência (opcional):
-- SELECT slug, link_pagamento_asaas, parcela_12x_cartao FROM public.planos ORDER BY ordem;
