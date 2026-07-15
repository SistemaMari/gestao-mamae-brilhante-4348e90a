-- ============================================================
-- Feature "Dashboard analítico (métricas)" passa a ser controlada
-- por flag no plano (planos.metricas_habilitado), em vez de fixa
-- no slug 'profissional'. No lançamento, libera para todos os planos.
-- ============================================================

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS metricas_habilitado boolean NOT NULL DEFAULT true;

-- Lançamento: libera métricas para todos os planos ativos.
UPDATE public.planos SET metricas_habilitado = true;
