-- ============================================================
-- Fix: o gerar-laudo grava com upsert(onConflict: 'consulta_id'), que exige
-- um índice único em laudos(consulta_id). Esse índice estava na migration
-- 20260710140000, mas NÃO existe no banco ao vivo — todo laudo falha com
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" (visto na carga da Rede Demonstração, 58/58 falhas).
-- Como o registrarLaudo do app falha em silêncio, as fichas finalizadas
-- também não persistem laudo.
--
-- Seguro: se já houver consulta com mais de um laudo, PARA com erro e lista
-- os casos (nada é apagado automaticamente — decidir caso a caso).
-- Idempotente (IF NOT EXISTS).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

DO $check$
DECLARE
  v_dup int;
  v_exemplos text;
BEGIN
  SELECT count(*), string_agg(consulta_id::text, ', ')
    INTO v_dup, v_exemplos
  FROM (
    SELECT consulta_id
    FROM public.laudos
    WHERE consulta_id IS NOT NULL
    GROUP BY consulta_id
    HAVING count(*) > 1
    LIMIT 20
  ) d;

  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Há % consulta(s) com mais de um laudo (ex.: %). Resolver antes de criar o índice.', v_dup, v_exemplos;
  END IF;
END
$check$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_laudos_consulta_unico ON public.laudos (consulta_id);
