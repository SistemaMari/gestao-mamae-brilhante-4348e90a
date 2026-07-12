
CREATE TABLE public.dicas_dashboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot int NOT NULL UNIQUE CHECK (slot BETWEEN 1 AND 30),
  texto text NOT NULL DEFAULT '',
  ativa boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.dicas_dashboard TO authenticated;
GRANT ALL ON public.dicas_dashboard TO service_role;

ALTER TABLE public.dicas_dashboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated leem dicas ativas"
  ON public.dicas_dashboard FOR SELECT
  TO authenticated
  USING (ativa = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins gerenciam dicas"
  ON public.dicas_dashboard FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_dicas_dashboard_updated_at
  BEFORE UPDATE ON public.dicas_dashboard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 30 slots (1..9 populated, 10..30 empty)
INSERT INTO public.dicas_dashboard (slot, texto, ativa) VALUES
  (1,  'Diagnóstico precoce de DMG salva vidas — da mãe e do bebê.', true),
  (2,  'Não permita DMG tardio: rastreie no tempo certo.', true),
  (3,  'DMG confirmado NÃO se repete exame — a conduta é seguir o protocolo.', true),
  (4,  'Rastreio universal entre 24 e 28 semanas. Sem exceção.', true),
  (5,  'Glicemia de jejum ≥ 92 mg/dL na 1ª consulta já é DMG.', true),
  (6,  'DMG tratado é desfecho materno-fetal preservado.', true),
  (7,  'TOTG 75g é o padrão-ouro entre 24-28 semanas; jejum, 1h e 2h.', true),
  (8,  'Insulinização em DMG segue com o obstetra — o endócrino apoia, não assume o pré-natal.', true),
  (9,  'Reclassificação pós-parto (6-12 semanas) é obrigatória em toda paciente com DMG.', true),
  (10, '', false), (11, '', false), (12, '', false), (13, '', false), (14, '', false),
  (15, '', false), (16, '', false), (17, '', false), (18, '', false), (19, '', false),
  (20, '', false), (21, '', false), (22, '', false), (23, '', false), (24, '', false),
  (25, '', false), (26, '', false), (27, '', false), (28, '', false), (29, '', false),
  (30, '', false);
