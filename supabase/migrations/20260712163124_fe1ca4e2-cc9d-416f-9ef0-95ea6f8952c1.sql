
-- 1) depoimentos pendem moderação por padrão
ALTER TABLE public.depoimentos_usuario ALTER COLUMN aprovado DROP NOT NULL;
ALTER TABLE public.depoimentos_usuario ALTER COLUMN aprovado DROP DEFAULT;
UPDATE public.depoimentos_usuario SET aprovado = NULL
  WHERE aprovado = false AND id IN (
    SELECT id FROM public.depoimentos_usuario WHERE aprovado = false
  );

-- 2) RPC para admins buscarem contatos (email + telefone + nome) de vários usuários
CREATE OR REPLACE FUNCTION public.admin_get_contatos_usuarios(_user_ids uuid[])
RETURNS TABLE(user_id uuid, nome text, email text, telefone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.nome, u.email::text, p.telefone
  FROM public.profissionais p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = ANY(_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_contatos_usuarios(uuid[]) TO authenticated;
