-- ============================================================
-- Planos (out/2026): limites 10/50/150 + promoção de lançamento.
--
-- 🚨 RODAR À MÃO NO SUPABASE (Publish do Lovable não aplica migration).
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================

-- 1) Novos limites de gestantes. Vale na hora para quem já assina
--    (o limite é lido ao vivo do plano).
UPDATE public.planos SET pacientes_max = 50  WHERE slug = 'intermediaria';
UPDATE public.planos SET pacientes_max = 150 WHERE slug = 'profissional';

-- 2) Liga/desliga da promoção de lançamento (50%). Uma linha só (id = 1).
--    Ligada: telas mostram o preço com desconto e o app cobra 50% nas 12
--    parcelas do 1º ano. Desligar é manual, em /admin/planos.
CREATE TABLE IF NOT EXISTS public.promocao_lancamento (
  id         smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativa      boolean     NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid        NULL REFERENCES auth.users(id)
);

ALTER TABLE public.promocao_lancamento ENABLE ROW LEVEL SECURITY;

-- Leitura pública: a tela de planos e o pagamento são abertos a quem ainda
-- não tem conta (nova compradora).
DROP POLICY IF EXISTS "Todos leem a promocao de lancamento" ON public.promocao_lancamento;
CREATE POLICY "Todos leem a promocao de lancamento"
  ON public.promocao_lancamento FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins ligam e desligam a promocao" ON public.promocao_lancamento;
CREATE POLICY "Admins ligam e desligam a promocao"
  ON public.promocao_lancamento FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Começa DESLIGADA: ligar em /admin/planos no dia do lançamento (13/10).
INSERT INTO public.promocao_lancamento (id, ativa)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- Conferência (opcional):
-- SELECT slug, pacientes_max, preco_mensal FROM public.planos ORDER BY ordem;
-- SELECT * FROM public.promocao_lancamento;
