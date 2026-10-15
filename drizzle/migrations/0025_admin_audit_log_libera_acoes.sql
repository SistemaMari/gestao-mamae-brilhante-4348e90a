ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_acao_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_acao_check CHECK (length(btrim(acao)) > 0);