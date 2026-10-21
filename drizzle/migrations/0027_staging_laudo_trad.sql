CREATE UNLOGGED TABLE public._staging_laudo_trad (
  tipos text[] NOT NULL,
  desfecho text NOT NULL,
  bloco text NOT NULL,
  idioma text NOT NULL,
  titulo text NOT NULL,
  texto text NOT NULL
);
GRANT SELECT, INSERT ON public._staging_laudo_trad TO PUBLIC;
GRANT ALL ON public._staging_laudo_trad TO service_role;
ALTER TABLE public._staging_laudo_trad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staging_laudo_trad_all" ON public._staging_laudo_trad FOR ALL USING (true) WITH CHECK (true);