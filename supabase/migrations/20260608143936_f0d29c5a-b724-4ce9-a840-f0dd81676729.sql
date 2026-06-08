
-- 1) Remove view flagged as SECURITY DEFINER VIEW and replace with SECURITY DEFINER function.
DROP VIEW IF EXISTS public.profissionais_equipe;

CREATE OR REPLACE FUNCTION public.get_profissionais_equipe(p_unidade_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  nome text,
  crm text,
  especialidade text,
  unidade_id uuid,
  acesso_revogado boolean,
  perfil_institucional text,
  perfil_clinico text,
  identificador_padrao text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.user_id, p.nome, p.crm, p.especialidade, p.unidade_id,
    p.acesso_revogado, p.perfil_institucional, p.perfil_clinico,
    p.identificador_padrao, p.created_at
  FROM public.profissionais p
  WHERE (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id)
    AND (
      p.user_id = auth.uid()
      OR public.is_admin(auth.uid())
      OR (p.unidade_id IS NOT NULL AND public.gestor_da_unidade(auth.uid(), p.unidade_id))
      OR (
        p.unidade_id IS NOT NULL
        AND public.is_gestor_geral(auth.uid())
        AND public.gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_profissionais_equipe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profissionais_equipe(uuid) TO authenticated;

-- 2) Admins can read email_send_log via the app.
CREATE POLICY "Admins podem ler email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3) Admins can read suppressed_emails via the app.
CREATE POLICY "Admins podem ler suppressed_emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
