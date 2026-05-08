
REVOKE EXECUTE ON FUNCTION public.get_visao_geral_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consolidador_operacao_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consolidador_perfil_clinico_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consolidador_gargalos_gestor_geral(date, date, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_consolidador_tendencia_gestor_geral(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._unidades_gg(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._pode_ver_unidade(uuid, uuid) FROM PUBLIC, anon;
