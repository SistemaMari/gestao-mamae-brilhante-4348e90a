
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL CHECK (acao IN ('criar_admin','remover_admin')),
  executado_por uuid NOT NULL,
  executado_por_email text NOT NULL,
  alvo_admin_id uuid,
  alvo_email text NOT NULL,
  alvo_nome text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leem audit log" ON public.admin_audit_log;
CREATE POLICY "Admins leem audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
-- Sem policies de INSERT/UPDATE/DELETE: somente service_role da Edge Function escreve.
