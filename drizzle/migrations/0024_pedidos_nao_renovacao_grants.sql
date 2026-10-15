-- GRANTs da tabela pedidos_nao_renovacao (a migration original não os trouxe;
-- sem eles o Data API recusa a leitura mesmo com as políticas de RLS ativas).

GRANT SELECT ON public.pedidos_nao_renovacao TO authenticated;
GRANT ALL ON public.pedidos_nao_renovacao TO service_role;