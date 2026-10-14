-- ============================================================
-- Decisão de produto (15/out/2026): a taxa de diagnóstico dos painéis do
-- gestor de unidade e do gestor geral conta DMG E OVERT juntos — toda
-- gestante com diabetes confirmado na gestação (cenários 1, 6, 6B e 8).
-- Antes o overt (8) ficava fora e aparecia à parte.
--
-- Como a 20261013120000: lê a definição VIGENTE de cada função do esquema
-- public que tem a lista de DMG e acrescenta '8'/'cenario_8' à lista — mais
-- nada muda. Pega todas (painéis, gargalos, tendência, perfil, destaques e o
-- auxiliar _rastreio_dmg_gg), de modo que "DMG sem retorno", tendência e
-- IG ao diagnóstico seguem a mesma regra. Idempotente: a lista já com '8'
-- não casa de novo. O admin (metricas_diagnosticos_admin) não é alterado.
-- O total de overt continua sendo devolvido (agora como parte da taxa).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261014210000.
-- ============================================================

DO $fix$
DECLARE
  r record;
  v_def text;
  v_novo text;
  v_alteradas int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname <> 'metricas_diagnosticos_admin'
      AND p.prosrc LIKE '%''1'',''6'',''6B'',''cenario_1'',''cenario_6'',''cenario_6b''%'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_novo := replace(
      v_def,
      $lista$('1','6','6B','cenario_1','cenario_6','cenario_6b')$lista$,
      $lista$('1','6','6B','8','cenario_1','cenario_6','cenario_6b','cenario_8')$lista$
    );
    IF v_novo IS DISTINCT FROM v_def THEN
      EXECUTE v_novo;
      v_alteradas := v_alteradas + 1;
      RAISE NOTICE 'taxa inclui overt: %', r.proname;
    END IF;
  END LOOP;
  RAISE NOTICE 'funções alteradas: %', v_alteradas;
END
$fix$;