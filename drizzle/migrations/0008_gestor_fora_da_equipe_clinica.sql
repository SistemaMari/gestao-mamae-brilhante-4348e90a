-- ============================================================
-- Gestor de unidade não atende gestantes: sai das contagens de equipe
-- clínica no banco (o front já filtra nas telas de Equipe).
--  • get_painel_operacao.distribuicao_profissionais — card "Profissionais com
--    gestante ativa · de N na unidade" (N incluía o gestor) e a base da
--    sobrecarga/desempenho.
--  • get_alertas_gestor_geral — alerta "sem profissionais": uma unidade só
--    com o gestor não disparava o alerta.
-- Edita a definição VIGENTE de cada função (pg_get_functiondef), trocando só
-- a condição da contagem. Idempotente. Rodar DEPOIS de 20261014150000.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

DO $fix$
DECLARE
  v_oid oid;
  v_def text;
  v_novo text;
BEGIN
  -- 1) distribuição por profissional do painel da unidade
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_painel_operacao';
  v_def := pg_get_functiondef(v_oid);
  IF v_def !~ 'perfil_institucional, ''''\) <> ''gestor''' THEN
    v_novo := regexp_replace(
      v_def,
      $re$(WHERE pr\.unidade_id = p_unidade_id\s+AND pr\.acesso_revogado = false)(\s+GROUP BY pr\.id, pr\.nome)$re$,
      $rep$\1
      AND coalesce(pr.perfil_institucional, '') <> 'gestor'\2$rep$
    );
    IF v_novo = v_def THEN
      RAISE WARNING 'get_painel_operacao: trecho da distribuição não encontrado — nada alterado';
    ELSE
      EXECUTE v_novo;
      RAISE NOTICE 'get_painel_operacao: gestor fora da distribuição';
    END IF;
  END IF;

  -- 2) alerta "sem profissionais" do gestor geral
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_alertas_gestor_geral';
  IF v_oid IS NOT NULL THEN
    v_def := pg_get_functiondef(v_oid);
    IF v_def !~ 'perfil_institucional, ''''\) <> ''gestor''' THEN
      v_novo := regexp_replace(
        v_def,
        $re$(where p\.unidade_id = u\.id and p\.acesso_revogado = false)(\) as prof_ativos)$re$,
        $rep$\1 and coalesce(p.perfil_institucional, '') <> 'gestor'\2$rep$
      );
      IF v_novo = v_def THEN
        RAISE WARNING 'get_alertas_gestor_geral: trecho de prof_ativos não encontrado — nada alterado';
      ELSE
        EXECUTE v_novo;
        RAISE NOTICE 'get_alertas_gestor_geral: gestor fora de prof_ativos';
      END IF;
    END IF;
  END IF;
END
$fix$;
