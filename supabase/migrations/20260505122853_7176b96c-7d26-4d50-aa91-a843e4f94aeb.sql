ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS data_inicio_assinatura timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_renovacao timestamptz;

CREATE INDEX IF NOT EXISTS idx_profissionais_asaas_customer ON public.profissionais(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_asaas_subscription ON public.profissionais(asaas_subscription_id);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem eventos asaas"
  ON public.asaas_webhook_events FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));