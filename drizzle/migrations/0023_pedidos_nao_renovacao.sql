-- Pedidos de "não quero renovar" do plano de consultório.
--
-- A MARI é anuidade e não renova sozinha. O pedido NÃO interrompe o ano já
-- contratado: o acesso e as parcelas seguem até ciclo_fim. Serve para (1) não
-- insistir no aviso de renovação, (2) a equipe saber quem sai e em que mês de
-- uso pediu e (3) reembolsar quem pediu dentro dos 7 dias da compra.
--
-- Gravação só pela edge function nao-renovar-plano (service role). A
-- profissional lê os próprios pedidos; o admin lê todos.
-- Idempotente: pode rodar mais de uma vez.

CREATE TABLE IF NOT EXISTS public.pedidos_nao_renovacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  -- Retrato no momento do pedido (a conta pode mudar ou ser excluída depois).
  nome text,
  email text,
  plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  plano_nome text,
  ciclo_inicio timestamptz,
  ciclo_fim timestamptz,
  mes_de_uso integer CHECK (mes_de_uso BETWEEN 1 AND 12),
  dentro_garantia boolean NOT NULL DEFAULT false,
  motivo text,
  comentario text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  -- Pedido encerrado: 'renovou' (comprou de novo) ou 'desistiu' (mudou de ideia).
  desfeito_em timestamptz,
  desfeito_motivo text CHECK (desfeito_motivo IN ('renovou', 'desistiu'))
);

CREATE INDEX IF NOT EXISTS pedidos_nao_renovacao_profissional_idx
  ON public.pedidos_nao_renovacao (profissional_id, criado_em DESC);

-- No máximo um pedido em aberto por conta.
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_nao_renovacao_um_aberto
  ON public.pedidos_nao_renovacao (profissional_id)
  WHERE desfeito_em IS NULL;

ALTER TABLE public.pedidos_nao_renovacao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos_nao_renovacao' AND policyname='Profissional vê os próprios pedidos de não renovação'
  ) THEN
    CREATE POLICY "Profissional vê os próprios pedidos de não renovação"
      ON public.pedidos_nao_renovacao FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pedidos_nao_renovacao' AND policyname='Admins veem todos os pedidos de não renovação'
  ) THEN
    CREATE POLICY "Admins veem todos os pedidos de não renovação"
      ON public.pedidos_nao_renovacao FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;