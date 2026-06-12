
-- Restrict column-level access to sensitive fields on profissionais and convites.
-- Edge functions use service_role and remain unaffected.

-- 1) convites.token: only service_role may read. The plaintext token is sent via email
--    and validated server-side; clients listing convites never need it.
REVOKE SELECT (token) ON public.convites FROM authenticated;
REVOKE SELECT (token) ON public.convites FROM anon;

-- 2) profissionais payment-processor identifiers: restrict from client roles.
--    Admin UI reads these via the gerenciar-profissionais-consultorio edge function (service_role).
REVOKE SELECT (asaas_customer_id, asaas_subscription_id, stripe_customer_id, stripe_subscription_id)
  ON public.profissionais FROM authenticated;
REVOKE SELECT (asaas_customer_id, asaas_subscription_id, stripe_customer_id, stripe_subscription_id)
  ON public.profissionais FROM anon;

-- Ensure service_role retains full access (idempotent).
GRANT ALL ON public.convites TO service_role;
GRANT ALL ON public.profissionais TO service_role;
