UPDATE public.pacientes p
SET status_ficha = latest.status_gerado
FROM (
  SELECT DISTINCT ON (c.paciente_id) c.paciente_id, c.status_gerado
  FROM public.consultas c
  WHERE c.status_gerado IS NOT NULL
  ORDER BY c.paciente_id, c.numero_sequencial DESC
) latest
WHERE p.id = latest.paciente_id
  AND p.motivo_encerramento IS NULL
  AND p.status_ficha = 'aguardando_gj'
  AND p.status_ficha IS DISTINCT FROM latest.status_gerado;