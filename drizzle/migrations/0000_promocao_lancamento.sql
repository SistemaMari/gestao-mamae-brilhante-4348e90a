CREATE TABLE IF NOT EXISTS public.promocao_lancamento (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativa boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);
GRANT SELECT ON public.promocao_lancamento TO anon;
GRANT SELECT, UPDATE ON public.promocao_lancamento TO authenticated;
GRANT ALL ON public.promocao_lancamento TO service_role;
ALTER TABLE public.promocao_lancamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem a promocao de lancamento" ON public.promocao_lancamento;
CREATE POLICY "Todos leem a promocao de lancamento" ON public.promocao_lancamento FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins ligam e desligam a promocao" ON public.promocao_lancamento;
CREATE POLICY "Admins ligam e desligam a promocao" ON public.promocao_lancamento FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.promocao_lancamento (id, ativa) VALUES (1, false) ON CONFLICT (id) DO NOTHING;