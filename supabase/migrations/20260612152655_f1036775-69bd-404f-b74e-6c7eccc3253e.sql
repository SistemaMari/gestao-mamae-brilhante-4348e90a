
-- ─────────────────────────────────────────────────────────────
-- PROMPT 38A — Integridade de dados
--   (A) Agregado de controle glicêmico em perfis_glicemicos
--   (B) Estruturação dos valores do GTT 75g em exames_glicemia
-- ─────────────────────────────────────────────────────────────

-- (A) Agregado de controle no perfil
ALTER TABLE public.perfis_glicemicos
  ADD COLUMN IF NOT EXISTS total_preenchidos integer,
  ADD COLUMN IF NOT EXISTS na_meta integer;

COMMENT ON COLUMN public.perfis_glicemicos.total_preenchidos IS
  'PROMPT 38A. Total de valores não nulos/não zero da grade gravados no save. Fonte única para o card "Resultado", cabeçalho e laudo. Grade vazia => 0.';
COMMENT ON COLUMN public.perfis_glicemicos.na_meta IS
  'PROMPT 38A. Quantidade de valores dentro da meta (regra única reusada do frontend — vereditoControle/posPrandial). Grade vazia => 0.';

-- (B) Valores estruturados do GTT 75g
ALTER TABLE public.exames_glicemia
  ADD COLUMN IF NOT EXISTS gtt_jejum integer,
  ADD COLUMN IF NOT EXISTS gtt_1h integer,
  ADD COLUMN IF NOT EXISTS gtt_2h integer,
  ADD COLUMN IF NOT EXISTS gtt_recurso_limitado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exames_glicemia.gtt_jejum IS
  'PROMPT 38A. GTT 75g — glicemia de jejum (mg/dL). Preenchido quando tipo_exame=''gtt''.';
COMMENT ON COLUMN public.exames_glicemia.gtt_1h IS
  'PROMPT 38A. GTT 75g — 1ª hora pós-sobrecarga (mg/dL). NULL se recurso limitado.';
COMMENT ON COLUMN public.exames_glicemia.gtt_2h IS
  'PROMPT 38A. GTT 75g — 2ª hora pós-sobrecarga (mg/dL). NULL se recurso limitado.';
COMMENT ON COLUMN public.exames_glicemia.gtt_recurso_limitado IS
  'PROMPT 38A. true => único valor disponível foi o jejum (cenário 6B / recurso limitado).';

-- valor_mgdl precisa aceitar NULL: linhas de GTT 75g carregam os 3 valores
-- nas colunas dedicadas (mantém-se em valor_mgdl o jejum, por compatibilidade
-- com queries existentes que filtram por tipo_exame).
ALTER TABLE public.exames_glicemia
  ALTER COLUMN valor_mgdl DROP NOT NULL;

-- Garantia de coerência: GTT 75g precisa de pelo menos jejum
ALTER TABLE public.exames_glicemia
  DROP CONSTRAINT IF EXISTS exames_glicemia_gtt_jejum_obrigatorio;
ALTER TABLE public.exames_glicemia
  ADD CONSTRAINT exames_glicemia_gtt_jejum_obrigatorio
  CHECK (
    tipo_exame <> 'gtt'
    OR gtt_jejum IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────
-- Backfill não destrutivo do GTT 75g
--   Estratégia: para cada consulta tipo='gtt' que NÃO tem linha
--   correspondente em exames_glicemia, parse do texto em
--   consultas.observacoes ("GTT 75g: jejum N, 1h N, 2h N. …"
--   ou "GTT 75g: jejum N (recurso limitado). …").
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  v_jejum integer;
  v_1h integer;
  v_2h integer;
  v_recurso boolean;
  m text[];
  v_migradas integer := 0;
  v_nao_parseadas integer := 0;
BEGIN
  FOR r IN
    SELECT c.id AS consulta_id, c.paciente_id, c.profissional_id,
           c.data AS data_exame, c.ig_semanas, c.ig_dias, c.observacoes
    FROM public.consultas c
    WHERE c.tipo = 'gtt'
      AND NOT EXISTS (
        SELECT 1 FROM public.exames_glicemia eg
        WHERE eg.consulta_id = c.id AND eg.tipo_exame = 'gtt'
      )
  LOOP
    v_jejum := NULL; v_1h := NULL; v_2h := NULL; v_recurso := false;

    -- Recurso limitado: "jejum N (recurso limitado)"
    m := regexp_match(coalesce(r.observacoes, ''), 'jejum\s+(\d{2,3})\s*\(recurso limitado\)', 'i');
    IF m IS NOT NULL THEN
      v_jejum := m[1]::int;
      v_recurso := true;
    ELSE
      -- Formato completo: "jejum N, 1h N, 2h N"
      m := regexp_match(coalesce(r.observacoes, ''),
        'jejum\s+(\d{2,3})\s*,\s*1h\s+(\d{2,3})\s*,\s*2h\s+(\d{2,3})', 'i');
      IF m IS NOT NULL THEN
        v_jejum := m[1]::int;
        v_1h    := m[2]::int;
        v_2h    := m[3]::int;
      END IF;
    END IF;

    IF v_jejum IS NULL THEN
      v_nao_parseadas := v_nao_parseadas + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.exames_glicemia (
      consulta_id, paciente_id, profissional_id,
      valor_mgdl, tipo_exame, data_exame,
      ig_semanas_na_data, ig_dias_na_data,
      gtt_jejum, gtt_1h, gtt_2h, gtt_recurso_limitado
    ) VALUES (
      r.consulta_id, r.paciente_id, r.profissional_id,
      v_jejum, 'gtt', r.data_exame,
      r.ig_semanas, r.ig_dias,
      v_jejum, v_1h, v_2h, v_recurso
    );

    v_migradas := v_migradas + 1;
  END LOOP;

  RAISE NOTICE 'PROMPT 38A backfill GTT 75g — consultas migradas: %, não parseadas (revisar manualmente): %',
    v_migradas, v_nao_parseadas;
END $$;
