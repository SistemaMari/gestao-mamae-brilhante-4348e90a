
-- 1) Restringe colunas billing/PII visíveis a gestores e gestor_geral.
--    Removemos as policies que expõem a tabela inteira e oferecemos
--    leitura via VIEW segura `profissionais_equipe`.

DROP POLICY IF EXISTS "Gestores veem profissionais da própria unidade" ON public.profissionais;
DROP POLICY IF EXISTS "Gestor geral vê profissionais das unidades vinculadas" ON public.profissionais;

CREATE OR REPLACE VIEW public.profissionais_equipe
WITH (security_invoker = off) AS
SELECT
  id,
  user_id,
  nome,
  crm,
  especialidade,
  unidade_id,
  acesso_revogado,
  perfil_institucional,
  perfil_clinico,
  identificador_padrao,
  created_at
FROM public.profissionais
WHERE
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (unidade_id IS NOT NULL AND public.gestor_da_unidade(auth.uid(), unidade_id))
  OR (
    unidade_id IS NOT NULL
    AND public.is_gestor_geral(auth.uid())
    AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
  );

GRANT SELECT ON public.profissionais_equipe TO authenticated;

-- 2) decisoes_ficha_a: adiciona visibilidade para gestor_geral via unidade da paciente.
CREATE POLICY "Gestor geral ve decisoes_ficha_a das unidades vinculadas"
ON public.decisoes_ficha_a
FOR SELECT
TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = decisoes_ficha_a.paciente_id
      AND p.unidade_id IS NOT NULL
      AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

-- 3) valores_perfil: idem (gestor_geral via perfis_glicemicos → pacientes).
CREATE POLICY "Gestor geral ve valores_perfil das unidades vinculadas"
ON public.valores_perfil
FOR SELECT
TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.perfis_glicemicos pg
    JOIN public.pacientes p ON p.id = pg.paciente_id
    WHERE pg.id = valores_perfil.perfil_id
      AND p.unidade_id IS NOT NULL
      AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);

-- 4) partos: estende DELETE para colegas ativos da mesma unidade (espelha UPDATE/INSERT
--    de exames_usg e demais tabelas de paciente compartilhada).
DROP POLICY IF EXISTS "Profissional pode deletar seus partos" ON public.partos;
CREATE POLICY "Profissional pode deletar partos da unidade"
ON public.partos
FOR DELETE
TO authenticated
USING (
  profissional_id IN (
    SELECT p.id FROM public.profissionais p
    WHERE p.user_id = auth.uid() AND p.acesso_revogado = false
  )
  OR paciente_id IN (
    SELECT pac.id
    FROM public.pacientes pac
    JOIN public.profissionais prof ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  )
);
