REVOKE EXECUTE ON FUNCTION public.carimbar_atendimento(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carimbar_atendimento(UUID, TEXT, UUID, TEXT) TO authenticated;