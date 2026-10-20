-- Corrige o vencimento do PLANO ANUAL (compra pelo link do Asaas).
--
-- Problema: a rotina diária resetar_laudos_aniversario() zera a cota de laudos
-- todo mês no "aniversário" da compra — certo — mas também gravava
-- proxima_renovacao = hoje + 1 mês para TODO mundo. Na compra anual,
-- proxima_renovacao é o FIM DO ANO PAGO (o webhook grava início + 12 meses);
-- a rotina sobrescrevia isso e o plano anual passava a "vencer" todo mês
-- (aviso de renovação para a médica, tela Renovações e e-mail de fim de ciclo).
--
-- Correção: compra anual (sem assinatura mensal e com asaas_compra_id) mantém
-- proxima_renovacao; os demais casos (mensalidade antiga, contas criadas pelo
-- admin) seguem como antes.

CREATE OR REPLACE FUNCTION public.resetar_laudos_aniversario()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH atualizados AS (
    UPDATE public.profissionais
    SET laudos_usados = 0,
        periodo_renovacao = now(),
        proxima_renovacao = CASE
          WHEN asaas_subscription_id IS NULL AND asaas_compra_id IS NOT NULL
            THEN proxima_renovacao                 -- anual: fim do ano pago
          ELSE (now() + interval '1 month')        -- mensal / sem compra
        END,
        updated_at = now()
    WHERE plano_status = 'ativo'
      AND data_inicio_assinatura IS NOT NULL
      AND EXTRACT(DAY FROM data_inicio_assinatura) = EXTRACT(DAY FROM now())
      AND (
        periodo_renovacao IS NULL
        OR periodo_renovacao < (now() - interval '20 days')
      )
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM atualizados;

  RETURN jsonb_build_object(
    'executado_em', now(),
    'profissionais_resetados', v_count
  );
END;
$$;

-- Repara quem já teve o fim do ano sobrescrito: na compra anual o fim é, no
-- mínimo, a data da compra + 12 meses (renovação antecipada só aumenta). Zera o
-- marcador do e-mail de fim de ciclo para quem pode ter recebido o aviso por
-- engano — o aviso certo sai de novo 60 dias antes do fim real.
UPDATE public.profissionais
SET proxima_renovacao = data_inicio_assinatura + interval '12 months',
    aviso_fim_ciclo_enviado_em = NULL,
    updated_at = now()
WHERE unidade_id IS NULL
  AND asaas_subscription_id IS NULL
  AND asaas_compra_id IS NOT NULL
  AND data_inicio_assinatura IS NOT NULL
  AND (
    proxima_renovacao IS NULL
    OR proxima_renovacao < data_inicio_assinatura + interval '12 months'
  );
