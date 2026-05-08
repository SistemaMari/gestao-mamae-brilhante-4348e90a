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
        proxima_renovacao = (now() + interval '1 month'),
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

SELECT cron.schedule(
  'resetar-laudos-aniversario-diario',
  '10 0 * * *',
  $$ SELECT public.resetar_laudos_aniversario(); $$
);