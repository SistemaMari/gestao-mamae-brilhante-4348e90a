-- ============================================================
-- Garantias da hierarquia rede → gestor geral → unidade → gestor →
-- profissionais → gestantes (decisões de 15/out/2026):
--
--  1. Profissional transferida/removida NÃO vê mais as gestantes de outra
--     unidade: a regra "gestantes que eu cadastrei" passa a valer só para a
--     MESMA unidade (no consultório, sem unidade). As gestantes ficam na
--     unidade de origem, com a equipe de lá.
--  2. Gestante só muda de unidade DENTRO DA MESMA REDE; não atravessa
--     consultório ↔ unidade; ao ser criada, entra na unidade da profissional.
--  3. Rede ENCERRADA pelo admin: o gestor geral deixa de ver as unidades e
--     dados dela (volta se o admin reativar).
--  4. No máximo UM gestor ativo por unidade (ficar sem gestor continua
--     permitido, para o período entre a saída de um e a entrada de outro).
--  5. Apagar uma conta nunca apaga as gestantes dela (FK RESTRICT): se a
--     profissional tiver gestantes, a exclusão é recusada.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Antes, rodar scripts/auditoria-hierarquia-rede.sql: os casos 2 (unidade
--    com 2 gestores) e 7 (gestante fora da unidade da profissional) precisam
--    estar zerados — senão o índice do item 4 é PULADO (com aviso) e os
--    dados antigos continuam como estão.
-- ============================================================

-- 1) pacientes: "minhas gestantes" só na mesma unidade -------------------------
DROP POLICY IF EXISTS "Profissional ve proprias pacientes ou da unidade" ON public.pacientes;
DROP POLICY IF EXISTS "Profissional pode atualizar paciente" ON public.pacientes;

CREATE POLICY "Profissional ve proprias pacientes ou da unidade"
ON public.pacientes FOR SELECT TO authenticated
USING (
  (profissional_id IN (
    SELECT p.id FROM profissionais p
    WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE
      AND p.unidade_id IS NOT DISTINCT FROM pacientes.unidade_id
  ))
  OR (unidade_id IN (SELECT p.unidade_id FROM profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL AND p.acesso_revogado = FALSE))
);

CREATE POLICY "Profissional pode atualizar paciente"
ON public.pacientes FOR UPDATE TO authenticated
USING (
  (profissional_id IN (
    SELECT p.id FROM profissionais p
    WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE
      AND p.unidade_id IS NOT DISTINCT FROM pacientes.unidade_id
  ))
  OR (unidade_id IN (SELECT p.unidade_id FROM profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL AND p.acesso_revogado = FALSE))
);

-- 2) pacientes: unidade coerente com a profissional e com a rede ----------------
CREATE OR REPLACE FUNCTION public._pacientes_unidade_coerente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unidade_prof uuid;
  v_rede_old uuid;
  v_rede_new uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT unidade_id INTO v_unidade_prof FROM profissionais WHERE id = NEW.profissional_id;
    -- Sem unidade informada: entra na unidade da profissional.
    IF NEW.unidade_id IS NULL THEN
      NEW.unidade_id := v_unidade_prof;
    -- Com unidade: tem de ser a da profissional (consultório não cria gestante em
    -- unidade; institucional não cria em unidade alheia).
    ELSIF NEW.unidade_id IS DISTINCT FROM v_unidade_prof THEN
      RAISE EXCEPTION 'A gestante só pode ser cadastrada na unidade da profissional responsável.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: mudança de unidade só dentro da mesma rede.
  IF NEW.unidade_id IS DISTINCT FROM OLD.unidade_id THEN
    IF OLD.unidade_id IS NULL OR NEW.unidade_id IS NULL THEN
      RAISE EXCEPTION 'Gestante de consultório não pode passar para uma unidade (nem o contrário).'
        USING ERRCODE = '23514';
    END IF;
    SELECT contratante_id INTO v_rede_old FROM unidades WHERE id = OLD.unidade_id;
    SELECT contratante_id INTO v_rede_new FROM unidades WHERE id = NEW.unidade_id;
    IF v_rede_old IS DISTINCT FROM v_rede_new THEN
      RAISE EXCEPTION 'A gestante só pode mudar para uma unidade da mesma rede.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pacientes_unidade_coerente ON public.pacientes;
CREATE TRIGGER trg_pacientes_unidade_coerente
BEFORE INSERT OR UPDATE OF unidade_id ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public._pacientes_unidade_coerente();

REVOKE ALL ON FUNCTION public._pacientes_unidade_coerente() FROM PUBLIC, anon, authenticated;

-- 3) Rede encerrada: gestor geral perde o acesso ----------------------------------
CREATE OR REPLACE FUNCTION public.gestor_geral_tem_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    JOIN public.unidades u ON u.id = ggu.unidade_id
    JOIN public.contratantes c ON c.id = u.contratante_id
    WHERE gg.user_id = _user_id
      AND gg.acesso_revogado = false
      AND ggu.unidade_id = _unidade_id
      AND c.status <> 'encerrado'
  );
$$;

CREATE OR REPLACE FUNCTION public._unidades_gg(_user uuid, _unidades uuid[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vinc AS (
    SELECT ggu.unidade_id
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    JOIN public.unidades u ON u.id = ggu.unidade_id
    JOIN public.contratantes c ON c.id = u.contratante_id
    WHERE gg.user_id = _user
      AND c.status <> 'encerrado'
  )
  SELECT coalesce(array_agg(unidade_id), ARRAY[]::uuid[])
  FROM vinc
  WHERE _unidades IS NULL OR unidade_id = ANY(_unidades);
$$;

-- 4) Um gestor ativo por unidade --------------------------------------------------
DO $idx$
DECLARE
  v_dup text;
BEGIN
  SELECT string_agg(u.nome, ', ') INTO v_dup
  FROM (
    SELECT unidade_id FROM public.profissionais
    WHERE perfil_institucional = 'gestor' AND acesso_revogado = false AND unidade_id IS NOT NULL
    GROUP BY unidade_id HAVING count(*) > 1
  ) d JOIN public.unidades u ON u.id = d.unidade_id;

  IF v_dup IS NOT NULL THEN
    RAISE WARNING 'Índice de 1 gestor por unidade NÃO criado: unidades com mais de um gestor ativo: %. Revogue/desvincule o excedente e rode esta parte de novo.', v_dup;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_um_gestor_ativo_por_unidade
             ON public.profissionais (unidade_id)
             WHERE perfil_institucional = ''gestor'' AND acesso_revogado = false';
  END IF;
END
$idx$;

-- 5) Apagar profissional não apaga gestantes --------------------------------------
DO $fk$
DECLARE
  v_nome text;
BEGIN
  SELECT con.conname INTO v_nome
  FROM pg_constraint con
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE con.conrelid = 'public.pacientes'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'public.profissionais'::regclass
    AND att.attname = 'profissional_id'
  LIMIT 1;

  IF v_nome IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pacientes DROP CONSTRAINT %I', v_nome);
  END IF;
  ALTER TABLE public.pacientes
    ADD CONSTRAINT pacientes_profissional_id_fkey
    FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE RESTRICT;
END
$fk$;
