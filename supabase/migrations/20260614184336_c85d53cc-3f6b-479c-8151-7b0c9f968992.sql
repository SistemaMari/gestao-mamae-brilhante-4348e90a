-- 1) Função SECURITY DEFINER: bypassa RLS de profissionais somente para
--    responder o booleano "_user pode ver registros do _prof_id".
CREATE OR REPLACE FUNCTION public.pode_ver_registro_de_profissional(
  _user uuid,
  _prof_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profissionais autor
    WHERE autor.id = _prof_id
      AND autor.acesso_revogado = false
      AND (
        -- é o próprio profissional
        autor.user_id = _user
        OR
        -- é colega ativo da mesma unidade
        (
          autor.unidade_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.profissionais me
            WHERE me.user_id = _user
              AND me.acesso_revogado = false
              AND me.unidade_id = autor.unidade_id
          )
        )
      )
  );
$$;

-- 2) Substitui a policy antiga por uma que usa a função.
DROP POLICY IF EXISTS prof_ve_registros_unidade_ou_seus
  ON public.registros_atendimento;

CREATE POLICY prof_ve_registros_unidade_ou_seus
  ON public.registros_atendimento
  FOR SELECT
  TO authenticated
  USING (
    public.pode_ver_registro_de_profissional(auth.uid(), profissional_id)
  );