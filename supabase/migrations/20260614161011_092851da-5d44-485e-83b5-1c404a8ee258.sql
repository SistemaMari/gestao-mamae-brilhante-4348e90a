DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'registros_atendimento'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.registros_atendimento';
  END IF;
END $$;

ALTER TABLE public.registros_atendimento REPLICA IDENTITY DEFAULT;