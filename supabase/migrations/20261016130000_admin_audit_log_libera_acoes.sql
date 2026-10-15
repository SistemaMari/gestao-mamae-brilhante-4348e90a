-- admin_audit_log nasceu (20260504132240) com CHECK acao IN ('criar_admin','remover_admin').
-- Depois, gerenciar-institucional passou a gravar ~22 outras ações (criar_unidade,
-- convidar_profissional_unidade, cadastrar_gestor_unidade, trocar_gestor_unidade...)
-- e o banco recusava todas — em silêncio, porque a função não confere o erro do insert.
-- Troca a lista fechada por "não vazia": a lista de ações vive no código das funções.
-- Registros antigos não voltam (nunca foram gravados).

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_acao_check;

ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_acao_check CHECK (length(btrim(acao)) > 0);
