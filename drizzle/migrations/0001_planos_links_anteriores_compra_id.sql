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

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS asaas_compra_id text NULL;