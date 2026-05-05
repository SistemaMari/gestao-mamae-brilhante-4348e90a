
-- 1. Novos campos em profissionais
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS perfil_clinico TEXT
    CHECK (perfil_clinico IN ('medico','enfermeiro','tecnico_enfermagem','outro')),
  ADD COLUMN IF NOT EXISTS acesso_revogado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acesso_revogado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acesso_revogado_por UUID REFERENCES public.profissionais(id),
  ADD COLUMN IF NOT EXISTS motivo_revogacao TEXT;

CREATE INDEX IF NOT EXISTS idx_profissionais_acesso_revogado
  ON public.profissionais(acesso_revogado) WHERE acesso_revogado = TRUE;

-- 2. RLS: gate de acesso_revogado nas 8 tabelas clínicas

-- 2.1 pacientes
DROP POLICY IF EXISTS "Profissional ve proprias pacientes ou da unidade" ON public.pacientes;
DROP POLICY IF EXISTS "Profissional pode atualizar paciente" ON public.pacientes;
DROP POLICY IF EXISTS "Profissional pode criar paciente" ON public.pacientes;

CREATE POLICY "Profissional ve proprias pacientes ou da unidade"
ON public.pacientes FOR SELECT TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (unidade_id IN (SELECT p.unidade_id FROM profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL AND p.acesso_revogado = FALSE))
);

CREATE POLICY "Profissional pode atualizar paciente"
ON public.pacientes FOR UPDATE TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (unidade_id IN (SELECT p.unidade_id FROM profissionais p WHERE p.user_id = auth.uid() AND p.unidade_id IS NOT NULL AND p.acesso_revogado = FALSE))
);

CREATE POLICY "Profissional pode criar paciente"
ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.2 consultas
DROP POLICY IF EXISTS "Profissional pode ver suas consultas" ON public.consultas;
DROP POLICY IF EXISTS "Profissional pode atualizar suas consultas" ON public.consultas;
DROP POLICY IF EXISTS "Profissional pode criar consultas" ON public.consultas;

CREATE POLICY "Profissional pode ver suas consultas"
ON public.consultas FOR SELECT TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = FALSE
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
);

CREATE POLICY "Profissional pode atualizar suas consultas"
ON public.consultas FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode criar consultas"
ON public.consultas FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.3 exames_glicemia
DROP POLICY IF EXISTS "Profissionais can view own exames" ON public.exames_glicemia;
DROP POLICY IF EXISTS "Profissionais can insert own exames" ON public.exames_glicemia;
DROP POLICY IF EXISTS "Profissionais can update own exames" ON public.exames_glicemia;
DROP POLICY IF EXISTS "Profissionais can delete own exames" ON public.exames_glicemia;

CREATE POLICY "Profissionais can view own exames"
ON public.exames_glicemia FOR SELECT TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = FALSE
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
);

CREATE POLICY "Profissionais can insert own exames"
ON public.exames_glicemia FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissionais can update own exames"
ON public.exames_glicemia FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissionais can delete own exames"
ON public.exames_glicemia FOR DELETE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.4 perfis_glicemicos
DROP POLICY IF EXISTS "Profissional pode ver seus perfis" ON public.perfis_glicemicos;
DROP POLICY IF EXISTS "Profissional pode criar perfis" ON public.perfis_glicemicos;
DROP POLICY IF EXISTS "Profissional pode atualizar seus perfis" ON public.perfis_glicemicos;

CREATE POLICY "Profissional pode ver seus perfis"
ON public.perfis_glicemicos FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode criar perfis"
ON public.perfis_glicemicos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode atualizar seus perfis"
ON public.perfis_glicemicos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.5 valores_perfil
DROP POLICY IF EXISTS "Profissional pode ver valores via perfil" ON public.valores_perfil;
DROP POLICY IF EXISTS "Profissional pode criar valores" ON public.valores_perfil;
DROP POLICY IF EXISTS "Profissional pode atualizar valores" ON public.valores_perfil;

CREATE POLICY "Profissional pode ver valores via perfil"
ON public.valores_perfil FOR SELECT TO authenticated
USING (
  perfil_id IN (
    SELECT pg.id FROM perfis_glicemicos pg
    WHERE pg.profissional_id IN (
      SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE
    )
  )
);

CREATE POLICY "Profissional pode criar valores"
ON public.valores_perfil FOR INSERT TO authenticated
WITH CHECK (
  perfil_id IN (
    SELECT pg.id FROM perfis_glicemicos pg
    WHERE pg.profissional_id IN (
      SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE
    )
  )
);

CREATE POLICY "Profissional pode atualizar valores"
ON public.valores_perfil FOR UPDATE TO authenticated
USING (
  perfil_id IN (
    SELECT pg.id FROM perfis_glicemicos pg
    WHERE pg.profissional_id IN (
      SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE
    )
  )
);

-- 2.6 laudos
DROP POLICY IF EXISTS "Profissional pode ver seus laudos" ON public.laudos;
DROP POLICY IF EXISTS "Profissional pode criar laudos" ON public.laudos;
DROP POLICY IF EXISTS "Profissional pode atualizar seus laudos" ON public.laudos;

CREATE POLICY "Profissional pode ver seus laudos"
ON public.laudos FOR SELECT TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = FALSE
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
);

CREATE POLICY "Profissional pode criar laudos"
ON public.laudos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode atualizar seus laudos"
ON public.laudos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.7 partos
DROP POLICY IF EXISTS "Profissional pode ver seus partos" ON public.partos;
DROP POLICY IF EXISTS "Profissional pode criar partos" ON public.partos;
DROP POLICY IF EXISTS "Profissional pode atualizar seus partos" ON public.partos;
DROP POLICY IF EXISTS "Profissional pode deletar seus partos" ON public.partos;

CREATE POLICY "Profissional pode ver seus partos"
ON public.partos FOR SELECT TO authenticated
USING (
  (profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = FALSE
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  ))
  OR is_admin(auth.uid())
  OR is_gestor_geral(auth.uid())
);

CREATE POLICY "Profissional pode criar partos"
ON public.partos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode atualizar seus partos"
ON public.partos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "Profissional pode deletar seus partos"
ON public.partos FOR DELETE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 2.8 registros_atendimento
DROP POLICY IF EXISTS "profissional_pode_inserir" ON public.registros_atendimento;
DROP POLICY IF EXISTS "prof_ve_seus_registros" ON public.registros_atendimento;

CREATE POLICY "profissional_pode_inserir"
ON public.registros_atendimento FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

CREATE POLICY "prof_ve_seus_registros"
ON public.registros_atendimento FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = FALSE)
);

-- 3. Guarda em carimbar_atendimento
CREATE OR REPLACE FUNCTION public.carimbar_atendimento(p_paciente_id uuid, p_tipo_operacao text, p_recurso_id uuid DEFAULT NULL::uuid, p_recurso_tipo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prof RECORD;
  v_registro_id UUID;
BEGIN
  SELECT id, nome, crm, especialidade, unidade_id, acesso_revogado
  INTO v_prof
  FROM public.profissionais
  WHERE user_id = auth.uid();

  IF v_prof.id IS NULL OR v_prof.unidade_id IS NULL OR v_prof.acesso_revogado = TRUE THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.registros_atendimento (
    paciente_id, profissional_id, unidade_id, tipo_operacao,
    recurso_id, recurso_tipo,
    profissional_nome, profissional_crm, profissional_especialidade
  ) VALUES (
    p_paciente_id, v_prof.id, v_prof.unidade_id, p_tipo_operacao,
    p_recurso_id, p_recurso_tipo,
    v_prof.nome, v_prof.crm, v_prof.especialidade
  ) RETURNING id INTO v_registro_id;

  RETURN v_registro_id;
END;
$function$;
