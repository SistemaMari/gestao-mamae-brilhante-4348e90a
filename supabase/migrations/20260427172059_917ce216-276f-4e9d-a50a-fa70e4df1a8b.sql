-- Garante REPLICA IDENTITY FULL para que UPDATE/DELETE enviem o registro completo
ALTER TABLE public.pacientes REPLICA IDENTITY FULL;
ALTER TABLE public.laudos REPLICA IDENTITY FULL;
ALTER TABLE public.consultas REPLICA IDENTITY FULL;
ALTER TABLE public.exames_glicemia REPLICA IDENTITY FULL;
ALTER TABLE public.perfis_glicemicos REPLICA IDENTITY FULL;
ALTER TABLE public.valores_perfil REPLICA IDENTITY FULL;

-- Adiciona tabelas à publicação realtime (idempotente: ignora erro se já estiverem)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pacientes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.laudos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.exames_glicemia; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.perfis_glicemicos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.valores_perfil; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;