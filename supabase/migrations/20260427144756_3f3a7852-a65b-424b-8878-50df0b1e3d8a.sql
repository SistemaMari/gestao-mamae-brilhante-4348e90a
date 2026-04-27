-- 1. Adiciona coluna 'ativa' em unidades
ALTER TABLE public.unidades 
  ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_unidades_ativa ON public.unidades(ativa);

-- 2. Adiciona coluna 'origem' em relatorios_unidade
ALTER TABLE public.relatorios_unidade 
  ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'manual' 
  CHECK (origem IN ('manual', 'automatico'));

CREATE INDEX IF NOT EXISTS idx_relatorios_unidade_origem 
  ON public.relatorios_unidade(origem);

-- 3. Permite gestor_id NULL (para relatórios automáticos sem gestor humano)
ALTER TABLE public.relatorios_unidade 
  ALTER COLUMN gestor_id DROP NOT NULL;

-- 4. Cria tabela execucoes_cron
CREATE TABLE IF NOT EXISTS public.execucoes_cron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_nome TEXT NOT NULL,
  periodo_inicio DATE,
  periodo_fim DATE,
  status TEXT NOT NULL DEFAULT 'em_andamento' 
    CHECK (status IN ('em_andamento', 'sucesso', 'parcial', 'falha_total')),
  total_unidades INTEGER DEFAULT 0,
  total_sucesso INTEGER DEFAULT 0,
  total_vazias INTEGER DEFAULT 0,
  total_falha INTEGER DEFAULT 0,
  detalhe_falhas JSONB,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_execucoes_cron_job_nome ON public.execucoes_cron(job_nome);
CREATE INDEX IF NOT EXISTS idx_execucoes_cron_iniciado_em ON public.execucoes_cron(iniciado_em DESC);

ALTER TABLE public.execucoes_cron ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver execucoes cron"
  ON public.execucoes_cron
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. Atualiza políticas de relatorios_unidade para suportar origem='automatico'
DROP POLICY IF EXISTS "Gestor da unidade pode inserir relatorios" ON public.relatorios_unidade;

CREATE POLICY "Gestor ou sistema pode inserir relatorios"
  ON public.relatorios_unidade
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Manual: gestor humano da unidade
    (origem = 'manual' AND EXISTS (
      SELECT 1 FROM profissionais p
      WHERE p.user_id = auth.uid()
        AND p.unidade_id = relatorios_unidade.unidade_id
        AND p.perfil_institucional = 'gestor'
    ))
    OR
    -- Automático: qualquer admin (a edge function valida via service_role)
    (origem = 'automatico' AND public.is_admin(auth.uid()))
  );