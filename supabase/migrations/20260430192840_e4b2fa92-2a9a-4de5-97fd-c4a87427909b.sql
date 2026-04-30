-- 1. Remover registro duplicado em profissionais para o admin strategyaisolucoes
DELETE FROM public.profissionais
WHERE user_id = '5a881ae0-1ea6-4365-8a8f-d5e94f613b64';

-- 2. Conceder EXECUTE nas RPCs de plano ao role authenticated
GRANT EXECUTE ON FUNCTION public.pode_criar_ficha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_gerar_laudo(uuid) TO authenticated;