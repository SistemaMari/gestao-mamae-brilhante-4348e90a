DROP FUNCTION IF EXISTS public.admin_get_contatos_usuarios(uuid[]);

CREATE OR REPLACE FUNCTION public.admin_get_contatos_usuarios(_user_ids uuid[])
RETURNS TABLE(user_id uuid, nome text, email text, telefone text, tipo_perfil text, unidade_nome text, email_gestor_unidade text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    u.email::text,
    p.telefone,
    p.perfil_institucional::text AS tipo_perfil,
    un.nome AS unidade_nome,
    (
      SELECT ug.email::text
      FROM public.profissionais pg
      LEFT JOIN auth.users ug ON ug.id = pg.user_id
      WHERE pg.unidade_id = p.unidade_id
        AND pg.perfil_institucional = 'gestor'
        AND pg.deleted_at IS NULL
      ORDER BY pg.created_at ASC
      LIMIT 1
    ) AS email_gestor_unidade
  FROM public.profissionais p
  LEFT JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.unidades un ON un.id = p.unidade_id
  WHERE p.user_id = ANY(_user_ids);
END;
$function$;