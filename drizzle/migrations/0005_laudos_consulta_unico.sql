DO $check$
DECLARE
  v_dup int;
  v_exemplos text;
BEGIN
  SELECT count(*), string_agg(consulta_id::text, ', ')
    INTO v_dup, v_exemplos
  FROM (
    SELECT consulta_id
    FROM public.laudos
    WHERE consulta_id IS NOT NULL
    GROUP BY consulta_id
    HAVING count(*) > 1
    LIMIT 20
  ) d;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Há % consulta(s) com mais de um laudo (ex.: %). Resolver antes de criar o índice.', v_dup, v_exemplos;
  END IF;
END
$check$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_laudos_consulta_unico ON public.laudos (consulta_id);