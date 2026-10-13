-- ============================================================
-- Fix: painéis do GESTOR DE UNIDADE e do GESTOR GERAL contavam DMG pelo
-- formato PREFIXADO ('cenario_1','cenario_6','cenario_6b') e insulina por
-- ('cenario_3','cenario_4','cenario_7'), mas o gerar-laudo grava o código
-- CRU ('1','6','6B','3','4','7'). Resultado: prevalência / taxa de DMG = 0
-- em todas as unidades. Mesmo bug já corrigido no admin em 20260710160000.
--
-- Estratégia: em vez de re-emitir ~11 funções inteiras (risco de divergir do
-- banco ao vivo), lê a definição ATUAL de cada função (pg_get_functiondef) e
-- troca SÓ a lista de literais, aceitando os DOIS formatos (cru + legado).
-- Nada além disso muda. Idempotente: a troca só casa quando a lista começa
-- logo após "(", então rodar 2x não duplica.
--
-- Fora do escopo: mv_metricas_unidade.laudos_dmg_positivo (nenhuma função
-- atual lê essa coluna) e metricas_diagnosticos_admin (já corrigida).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

DO $fix$
DECLARE
  v_funcoes text[] := ARRAY[
    'get_painel_perfil_clinico',
    'get_painel_gargalos',
    'get_painel_gargalos_detalhado',
    'get_painel_tendencia',
    'get_metricas_consolidadas_gestor_geral',
    'get_ranking_unidades_gestor_geral',
    'get_visao_geral_gestor_geral',
    'get_consolidador_perfil_clinico_gestor_geral',
    'get_consolidador_gargalos_gestor_geral',
    'get_consolidador_tendencia_gestor_geral',
    'get_top_destaques_gestor_geral'
  ];
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
      AND p.proname = ANY (v_funcoes)
  LOOP
    v_def := pg_get_functiondef(r.oid);

    -- DMG: ('cenario_1','cenario_6','cenario_6b') → aceita cru + legado
    v_novo := regexp_replace(
      v_def,
      $re$\(\s*'cenario_1'\s*,\s*'cenario_6'\s*,\s*'cenario_6b'\s*\)$re$,
      $rep$('1','6','6B','cenario_1','cenario_6','cenario_6b')$rep$,
      'gi'
    );

    -- Insulina: ('cenario_3','cenario_4','cenario_7') → aceita cru + legado
    v_novo := regexp_replace(
      v_novo,
      $re$\(\s*'cenario_3'\s*,\s*'cenario_4'\s*,\s*'cenario_7'\s*\)$re$,
      $rep$('3','4','7','cenario_3','cenario_4','cenario_7')$rep$,
      'gi'
    );

    IF v_novo IS DISTINCT FROM v_def THEN
      EXECUTE v_novo;
      v_alteradas := v_alteradas + 1;
      RAISE NOTICE 'corrigida: %', r.proname;
    ELSE
      RAISE NOTICE 'sem alteração (já corrigida ou sem literais): %', r.proname;
    END IF;
  END LOOP;

  RAISE NOTICE 'funções alteradas: %', v_alteradas;
END
$fix$;

-- Verificação: nenhuma das funções pode continuar com a lista SÓ no formato antigo.
DO $check$
DECLARE
  v_restantes text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_restantes
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ~* $re$\(\s*'cenario_1'\s*,$re$;

  -- WARNING (não EXCEPTION): uma função legada fora da lista não deve desfazer
  -- a correção das que estão em uso; só sinaliza para revisão.
  IF v_restantes IS NOT NULL THEN
    RAISE WARNING 'Ainda há funções contando DMG só pelo formato antigo: %', v_restantes;
  END IF;
END
$check$;