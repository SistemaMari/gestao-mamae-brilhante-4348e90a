-- 37A-B: Realtime em registros_atendimento
ALTER TABLE public.registros_atendimento REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'registros_atendimento'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.registros_atendimento';
  END IF;
END $$;