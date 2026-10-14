-- ============================================================
-- Fecha a brecha que sobrou da hierarquia (20261015120000): nas tabelas
-- clínicas (consultas, exames, perfis glicêmicos, laudos, decisões da Ficha A,
-- partos), a regra "registros que EU criei" valia em qualquer unidade. Uma
-- profissional transferida/removida ainda abria, por link direto, as fichas que
-- ela mesma preencheu na unidade antiga. E o cadastro (INSERT) só conferia o
-- autor, não a gestante.
--
-- Agora todas seguem UMA regra, a mesma da tabela pacientes:
--   pode_acessar_paciente(gestante) = profissional ativa (não revogada) E
--     • gestante de unidade → a profissional é da MESMA unidade; ou
--     • gestante de consultório → é a dona dela e também está no consultório.
--   Ver: quem pode acessar a gestante. Criar/editar/apagar: o autor do registro,
--   desde que ainda possa acessar a gestante (mesma regra de antes + unidade).
-- Políticas de gestor geral e admin não mudam. exames_usg/exames_fetais já
-- passavam pela tabela pacientes (e herdaram a correção) — ficam como estão.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
--    Rodar DEPOIS de 20261015120000.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_acessar_paciente(_paciente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.id = _paciente_id
      AND (
        (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
        OR (pac.unidade_id IS NULL AND prof.unidade_id IS NULL AND pac.profissional_id = prof.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pode_acessar_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_acessar_paciente(uuid) TO authenticated;

-- consultas -------------------------------------------------------------
DROP POLICY IF EXISTS "Profissional pode ver suas consultas" ON public.consultas;
CREATE POLICY "Profissional pode ver suas consultas"
ON public.consultas FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode criar consultas" ON public.consultas;
CREATE POLICY "Profissional pode criar consultas"
ON public.consultas FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode atualizar suas consultas" ON public.consultas;
CREATE POLICY "Profissional pode atualizar suas consultas"
ON public.consultas FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);

-- exames_glicemia -------------------------------------------------------
DROP POLICY IF EXISTS "Profissionais can view own exames" ON public.exames_glicemia;
CREATE POLICY "Profissionais can view own exames"
ON public.exames_glicemia FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissionais can insert own exames" ON public.exames_glicemia;
CREATE POLICY "Profissionais can insert own exames"
ON public.exames_glicemia FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissionais can update own exames" ON public.exames_glicemia;
CREATE POLICY "Profissionais can update own exames"
ON public.exames_glicemia FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissionais can delete own exames" ON public.exames_glicemia;
CREATE POLICY "Profissionais can delete own exames"
ON public.exames_glicemia FOR DELETE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);

-- laudos ----------------------------------------------------------------
DROP POLICY IF EXISTS "Profissional pode ver seus laudos" ON public.laudos;
CREATE POLICY "Profissional pode ver seus laudos"
ON public.laudos FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode criar laudos" ON public.laudos;
CREATE POLICY "Profissional pode criar laudos"
ON public.laudos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode atualizar seus laudos" ON public.laudos;
CREATE POLICY "Profissional pode atualizar seus laudos"
ON public.laudos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);

-- perfis_glicemicos -----------------------------------------------------
DROP POLICY IF EXISTS "Profissional pode ver seus perfis" ON public.perfis_glicemicos;
CREATE POLICY "Profissional pode ver seus perfis"
ON public.perfis_glicemicos FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode criar perfis" ON public.perfis_glicemicos;
CREATE POLICY "Profissional pode criar perfis"
ON public.perfis_glicemicos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode atualizar seus perfis" ON public.perfis_glicemicos;
CREATE POLICY "Profissional pode atualizar seus perfis"
ON public.perfis_glicemicos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);

-- valores_perfil (pela gestante do perfil) ------------------------------
DROP POLICY IF EXISTS "Profissional pode ver valores via perfil" ON public.valores_perfil;
CREATE POLICY "Profissional pode ver valores via perfil"
ON public.valores_perfil FOR SELECT TO authenticated
USING (
  perfil_id IN (
    SELECT pg.id FROM public.perfis_glicemicos pg
    WHERE public.pode_acessar_paciente(pg.paciente_id)
  )
);
DROP POLICY IF EXISTS "Profissional pode criar valores" ON public.valores_perfil;
CREATE POLICY "Profissional pode criar valores"
ON public.valores_perfil FOR INSERT TO authenticated
WITH CHECK (
  perfil_id IN (
    SELECT pg.id FROM public.perfis_glicemicos pg
    WHERE pg.profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
      AND public.pode_acessar_paciente(pg.paciente_id)
  )
);
DROP POLICY IF EXISTS "Profissional pode atualizar valores" ON public.valores_perfil;
CREATE POLICY "Profissional pode atualizar valores"
ON public.valores_perfil FOR UPDATE TO authenticated
USING (
  perfil_id IN (
    SELECT pg.id FROM public.perfis_glicemicos pg
    WHERE pg.profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
      AND public.pode_acessar_paciente(pg.paciente_id)
  )
);

-- decisoes_ficha_a ------------------------------------------------------
DROP POLICY IF EXISTS "Profissional ve suas decisoes ficha_a" ON public.decisoes_ficha_a;
CREATE POLICY "Profissional ve suas decisoes ficha_a"
ON public.decisoes_ficha_a FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional cria suas decisoes ficha_a" ON public.decisoes_ficha_a;
CREATE POLICY "Profissional cria suas decisoes ficha_a"
ON public.decisoes_ficha_a FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional atualiza suas decisoes ficha_a" ON public.decisoes_ficha_a;
CREATE POLICY "Profissional atualiza suas decisoes ficha_a"
ON public.decisoes_ficha_a FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);

-- partos (tabela sem uso hoje; mantém admin e gestor geral) -------------
DROP POLICY IF EXISTS "Profissional pode ver seus partos" ON public.partos;
CREATE POLICY "Profissional pode ver seus partos"
ON public.partos FOR SELECT TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
  OR is_admin(auth.uid())
  OR (is_gestor_geral(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.pacientes pac2
    WHERE pac2.id = partos.paciente_id
      AND pac2.unidade_id IS NOT NULL
      AND gestor_geral_tem_unidade(auth.uid(), pac2.unidade_id)
  ))
);
DROP POLICY IF EXISTS "Profissional pode criar partos" ON public.partos;
CREATE POLICY "Profissional pode criar partos"
ON public.partos FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode atualizar seus partos" ON public.partos;
CREATE POLICY "Profissional pode atualizar seus partos"
ON public.partos FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM public.profissionais p WHERE p.user_id = auth.uid() AND p.acesso_revogado = false)
  AND public.pode_acessar_paciente(paciente_id)
);
DROP POLICY IF EXISTS "Profissional pode deletar partos da unidade" ON public.partos;
CREATE POLICY "Profissional pode deletar partos da unidade"
ON public.partos FOR DELETE TO authenticated
USING (
  public.pode_acessar_paciente(paciente_id)
);