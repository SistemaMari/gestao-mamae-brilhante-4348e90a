-- ============================================================
-- Compra anual pelo link do Asaas (out/2026).
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- 1) Links antigos de cada plano. Ao trocar o link em /admin/planos, o anterior
--    entra aqui sozinho (gatilho abaixo) e continua sendo reconhecido — quem
--    pagou com Pix/boleto de um link já trocado não fica sem acesso.
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS links_pagamento_anteriores text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.planos_guardar_link_anterior()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.link_pagamento_asaas IS NOT NULL
     AND OLD.link_pagamento_asaas IS DISTINCT FROM NEW.link_pagamento_asaas
     AND NOT (OLD.link_pagamento_asaas = ANY (NEW.links_pagamento_anteriores)) THEN
    NEW.links_pagamento_anteriores := array_append(NEW.links_pagamento_anteriores, OLD.link_pagamento_asaas);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planos_guardar_link_anterior ON public.planos;
CREATE TRIGGER trg_planos_guardar_link_anterior
  BEFORE UPDATE OF link_pagamento_asaas ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.planos_guardar_link_anterior();

-- 2) Identificação da compra no Asaas (parcelamento, pagamento avulso ou
--    assinatura). Todas as parcelas da mesma compra têm o mesmo identificador:
--    a 1ª libera 12 meses de acesso, as demais não mexem em nada.
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS asaas_compra_id text NULL;

-- 3) Links de pagamento (o que a cliente abre para pagar). Os links promocionais
--    de lançamento — trocar em /admin/planos quando a promoção acabar.
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/000/c/nrfjsycnquvauzim' WHERE slug = 'inicial';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/000/c/ud5nf49v2t482560' WHERE slug = 'intermediaria';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/000/c/09aiyqhk3vvvifu6' WHERE slug = 'profissional';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/000/c/de29bc5a729wsxat' WHERE slug = 'institucional-1000';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/000/c/4s3nk0wy8gu5gpr7' WHERE slug = 'institucional-5000';

-- Conferência (opcional):
-- SELECT slug, link_pagamento_asaas, links_pagamento_anteriores FROM public.planos ORDER BY ordem;
