-- ============================================================
-- Resumo semanal por e-mail (toda segunda de manhã, horário de Brasília).
--
--  • Gestor de unidade: "Resumo da semana — <unidade>" com as pendências de
--    HOJE (os 3 gargalos do painel: sem glicemia de jejum na 1ª consulta,
--    atrasadas para o GTT, diagnosticadas sem retorno — números da própria
--    get_painel_gargalos) + laudos emitidos e gestantes novas na semana
--    anterior (segunda 00h a domingo 23h59, horário de Brasília).
--  • Gestor geral: um e-mail só, com uma linha por unidade das redes dele
--    (redes encerradas ficam de fora) e o total.
--
-- O que esta migration cria:
--  1. profissionais.receber_resumo_semanal e gestores_gerais.receber_resumo_semanal
--     (DEFAULT true) — o interruptor da tela de Configurações.
--  2. obter_receber_resumo_semanal() / definir_receber_resumo_semanal(bool):
--     a própria pessoa lê/muda SÓ esse interruptor (SECURITY DEFINER).
--  3. resumo_semanal_envios: registro de envio (1 por pessoa/papel/semana) —
--     impede mandar 2x na mesma semana. Só a service role mexe.
--  4. resumo_semanal_destinatarios(semana, ...): quem recebe e os números,
--     só para a service role (edge function enviar-resumo-semanal).
--     Os gargalos vêm de get_painel_gargalos (NÃO é copiada aqui: a função é
--     chamada "como" o próprio gestor, então a regra e a checagem de acesso
--     são exatamente as do painel — inclusive mudanças futuras nela).
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--
-- ⚠️ AGENDAMENTO: passo manual à parte, DEPOIS de implantar a edge function
--    enviar-resumo-semanal e testar com {"dry_run": true}. Ver
--    scripts/agendar-resumo-semanal.sql (rodar à mão no SQL Editor do Supabase).
-- ============================================================

-- 1) Interruptor ------------------------------------------------------------------
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS receber_resumo_semanal boolean NOT NULL DEFAULT true;
ALTER TABLE public.gestores_gerais
  ADD COLUMN IF NOT EXISTS receber_resumo_semanal boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profissionais.receber_resumo_semanal IS
  'Gestor de unidade recebe o resumo semanal por e-mail (segunda de manhã). Muda só via definir_receber_resumo_semanal.';
COMMENT ON COLUMN public.gestores_gerais.receber_resumo_semanal IS
  'Gestor geral recebe o resumo semanal da rede por e-mail (segunda de manhã). Muda só via definir_receber_resumo_semanal.';

-- 2) Ler / mudar o próprio interruptor -------------------------------------------
-- NULL = a pessoa não é gestor de unidade nem gestor geral (não recebe resumo).
CREATE OR REPLACE FUNCTION public.obter_receber_resumo_semanal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT gg.receber_resumo_semanal FROM public.gestores_gerais gg
      WHERE gg.user_id = auth.uid() LIMIT 1),
    (SELECT p.receber_resumo_semanal FROM public.profissionais p
      WHERE p.user_id = auth.uid() AND p.perfil_institucional = 'gestor'
        AND p.unidade_id IS NOT NULL LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.definir_receber_resumo_semanal(p_receber boolean)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof int;
  v_gg int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão necessária' USING ERRCODE = '42501';
  END IF;
  IF p_receber IS NULL THEN
    RAISE EXCEPTION 'Valor obrigatório' USING ERRCODE = '22004';
  END IF;

  -- Só a coluna do interruptor, só a linha da própria pessoa.
  UPDATE public.profissionais
     SET receber_resumo_semanal = p_receber
   WHERE user_id = v_uid
     AND perfil_institucional = 'gestor'
     AND unidade_id IS NOT NULL;
  GET DIAGNOSTICS v_prof = ROW_COUNT;

  UPDATE public.gestores_gerais
     SET receber_resumo_semanal = p_receber
   WHERE user_id = v_uid;
  GET DIAGNOSTICS v_gg = ROW_COUNT;

  IF v_prof + v_gg = 0 THEN
    RAISE EXCEPTION 'Resumo semanal é só para gestores' USING ERRCODE = '42501';
  END IF;
  RETURN p_receber;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.obter_receber_resumo_semanal() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.definir_receber_resumo_semanal(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_receber_resumo_semanal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_receber_resumo_semanal(boolean) TO authenticated;

-- 3) Registro de envio (idempotência) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.resumo_semanal_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  papel text NOT NULL CHECK (papel IN ('gestor', 'gestor_geral')),
  -- Segunda-feira da semana do envio (data de Brasília).
  semana date NOT NULL,
  email text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resumo_semanal_envios_unico UNIQUE (user_id, papel, semana)
);
-- Sem policies: só a service role (edge function) lê e grava.
ALTER TABLE public.resumo_semanal_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.resumo_semanal_envios FROM PUBLIC, anon, authenticated;

-- 4) Números de uma unidade, vistos pelo destinatário ------------------------------
-- Chama get_painel_gargalos com auth.uid() = p_user (o próprio gestor), para a
-- regra e a checagem de acesso serem as do painel. Uso interno.
CREATE OR REPLACE FUNCTION public._resumo_semanal_unidade(
  p_user uuid,
  p_unidade_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_garg jsonb;
  v_laudos int;
  v_novas int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);

  v_garg := public.get_painel_gargalos(p_unidade_id);

  SELECT count(*) INTO v_laudos
  FROM public.laudos l
  JOIN public.pacientes p ON p.id = l.paciente_id
  WHERE p.unidade_id = p_unidade_id
    AND l.created_at >= p_inicio
    AND l.created_at < p_fim;

  SELECT count(*) INTO v_novas
  FROM public.pacientes p
  WHERE p.unidade_id = p_unidade_id
    AND p.is_rascunho = false
    AND p.created_at >= p_inicio
    AND p.created_at < p_fim;

  RETURN jsonb_build_object(
    'sem_gj_primeira_consulta', coalesce((v_garg -> 'sem_gj_primeira_consulta' ->> 'count')::int, 0),
    'atrasadas_gtt', coalesce((v_garg -> 'atrasadas_gtt' ->> 'count')::int, 0),
    'confirmadas_sem_retorno', coalesce((v_garg -> 'confirmadas_sem_retorno' ->> 'count')::int, 0),
    'laudos_semana', coalesce(v_laudos, 0),
    'novas_gestantes_semana', coalesce(v_novas, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public._resumo_semanal_unidade(uuid, uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- 5) Quem recebe e o quê --------------------------------------------------------
-- p_semana = segunda-feira da semana do envio (data de Brasília). A "semana
-- anterior" vai de (p_semana - 7) 00:00 até p_semana 00:00, em Brasília.
-- Ficam de fora: acesso revogado, conta apagada, interruptor desligado,
-- unidade inativa, rede encerrada, e-mails do domínio de demonstração e a
-- rede com o CNPJ de demonstração.
CREATE OR REPLACE FUNCTION public.resumo_semanal_destinatarios(
  p_semana date,
  p_dominio_excluido text DEFAULT 'demo.mari.health',
  p_cnpj_excluido text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio timestamptz := (p_semana - 7)::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := p_semana::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_sufixo text := '%@' || lower(coalesce(nullif(p_dominio_excluido, ''), 'demo.mari.health'));
  v_gestores jsonb := '[]'::jsonb;
  v_ggs jsonb := '[]'::jsonb;
  v_unidades jsonb;
  v_num jsonb;
  r record;
  u record;
BEGIN
  -- Só a service role (sem usuário logado). O GRANT abaixo já restringe; isto
  -- é uma segunda trava caso alguém conceda o EXECUTE por engano.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_semana IS NULL THEN
    RAISE EXCEPTION 'Semana obrigatória' USING ERRCODE = '22004';
  END IF;

  -- Gestores de unidade
  FOR r IN
    SELECT p.user_id, p.nome, lower(au.email) AS email, u2.id AS unidade_id, u2.nome AS unidade_nome
    FROM public.profissionais p
    JOIN auth.users au ON au.id = p.user_id
    JOIN public.unidades u2 ON u2.id = p.unidade_id
    JOIN public.contratantes c ON c.id = u2.contratante_id
    WHERE p.perfil_institucional = 'gestor'
      AND p.acesso_revogado = false
      AND p.deleted_at IS NULL
      AND p.receber_resumo_semanal = true
      AND u2.ativa = true
      AND c.status <> 'encerrado'
      AND (p_cnpj_excluido IS NULL OR c.cnpj IS DISTINCT FROM p_cnpj_excluido)
      AND au.email IS NOT NULL
      AND lower(au.email) NOT LIKE v_sufixo
    ORDER BY u2.nome, p.nome
  LOOP
    BEGIN
      v_num := public._resumo_semanal_unidade(r.user_id, r.unidade_id, v_inicio, v_fim);
    EXCEPTION WHEN insufficient_privilege THEN
      CONTINUE; -- o painel também não mostraria
    END;
    v_gestores := v_gestores || jsonb_build_array(jsonb_build_object(
      'user_id', r.user_id,
      'nome', r.nome,
      'email', r.email,
      'ja_enviado', EXISTS (
        SELECT 1 FROM public.resumo_semanal_envios e
        WHERE e.user_id = r.user_id AND e.papel = 'gestor' AND e.semana = p_semana),
      'unidade', jsonb_build_object('unidade_id', r.unidade_id, 'nome', r.unidade_nome) || v_num
    ));
  END LOOP;

  -- Gestores gerais (unidades das redes NÃO encerradas — _unidades_gg)
  FOR r IN
    SELECT gg.user_id, gg.nome, lower(au.email) AS email
    FROM public.gestores_gerais gg
    JOIN auth.users au ON au.id = gg.user_id
    WHERE gg.acesso_revogado = false
      AND gg.receber_resumo_semanal = true
      AND au.email IS NOT NULL
      AND lower(au.email) NOT LIKE v_sufixo
    ORDER BY gg.nome
  LOOP
    v_unidades := '[]'::jsonb;
    FOR u IN
      SELECT u2.id, u2.nome, c.nome AS rede
      FROM public.unidades u2
      JOIN public.contratantes c ON c.id = u2.contratante_id
      WHERE u2.id = ANY (public._unidades_gg(r.user_id, NULL))
        AND u2.ativa = true
        AND c.status <> 'encerrado'
        AND (p_cnpj_excluido IS NULL OR c.cnpj IS DISTINCT FROM p_cnpj_excluido)
      ORDER BY c.nome, u2.nome
    LOOP
      BEGIN
        v_num := public._resumo_semanal_unidade(r.user_id, u.id, v_inicio, v_fim);
      EXCEPTION WHEN insufficient_privilege THEN
        CONTINUE;
      END;
      v_unidades := v_unidades || jsonb_build_array(
        jsonb_build_object('unidade_id', u.id, 'nome', u.nome, 'rede', u.rede) || v_num);
    END LOOP;

    IF jsonb_array_length(v_unidades) > 0 THEN
      v_ggs := v_ggs || jsonb_build_array(jsonb_build_object(
        'user_id', r.user_id,
        'nome', r.nome,
        'email', r.email,
        'ja_enviado', EXISTS (
          SELECT 1 FROM public.resumo_semanal_envios e
          WHERE e.user_id = r.user_id AND e.papel = 'gestor_geral' AND e.semana = p_semana),
        'unidades', v_unidades
      ));
    END IF;
  END LOOP;

  -- Devolve a identidade original da chamada.
  PERFORM set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);

  RETURN jsonb_build_object(
    'semana', p_semana,
    'inicio', v_inicio,
    'fim', v_fim,
    'gestores', v_gestores,
    'gestores_gerais', v_ggs
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resumo_semanal_destinatarios(date, text, text)
  FROM PUBLIC, anon, authenticated;
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.resumo_semanal_destinatarios(date, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public._resumo_semanal_unidade(uuid, uuid, timestamptz, timestamptz) TO service_role;
    GRANT SELECT, INSERT, DELETE ON public.resumo_semanal_envios TO service_role;
  END IF;
END
$grant$;