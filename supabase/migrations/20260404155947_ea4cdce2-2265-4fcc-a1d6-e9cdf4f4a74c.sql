
-- Adicionar colunas de plano na tabela profissionais
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS plano_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS laudos_limite integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS laudos_usados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodo_renovacao timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Adicionar policy de UPDATE para profissionais (para o próprio usuário)
CREATE POLICY "Profissionais podem atualizar seus dados"
ON public.profissionais
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Função: pode_criar_ficha(profissional_uuid)
-- Plano free: máx 3 pacientes. Pagos: ilimitado.
CREATE OR REPLACE FUNCTION public.pode_criar_ficha(p_profissional_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano text;
  v_total_fichas integer;
BEGIN
  SELECT plano INTO v_plano FROM profissionais WHERE id = p_profissional_id;
  IF v_plano IS NULL THEN
    RETURN false;
  END IF;
  IF v_plano != 'free' THEN
    RETURN true;
  END IF;
  -- Contar fichas do profissional (tabela pacientes será criada futuramente)
  -- Por enquanto conta 0 se a tabela não existir
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.pacientes WHERE profissional_id = $1' INTO v_total_fichas USING p_profissional_id;
  EXCEPTION WHEN undefined_table THEN
    v_total_fichas := 0;
  END;
  RETURN v_total_fichas < 3;
END;
$$;

-- Função: pode_gerar_laudo(profissional_uuid)
-- Verifica limite e incrementa atomicamente
CREATE OR REPLACE FUNCTION public.pode_gerar_laudo(p_profissional_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usados integer;
  v_limite integer;
BEGIN
  SELECT laudos_usados, laudos_limite INTO v_usados, v_limite
  FROM profissionais
  WHERE id = p_profissional_id
  FOR UPDATE;

  IF v_usados IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'laudos_limite', 0);
  END IF;

  IF v_usados >= v_limite THEN
    RETURN jsonb_build_object('allowed', false, 'laudos_limite', v_limite);
  END IF;

  UPDATE profissionais SET laudos_usados = laudos_usados + 1 WHERE id = p_profissional_id;
  RETURN jsonb_build_object('allowed', true, 'laudos_limite', v_limite);
END;
$$;
