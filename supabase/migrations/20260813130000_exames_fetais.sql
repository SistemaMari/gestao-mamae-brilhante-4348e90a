-- V4 · Resultados de exames de ultrassom obstétrico e vigilância fetal por ficha
-- ---------------------------------------------------------------------------
-- As especialistas pediram que os resultados dos exames de crescimento/vitalidade
-- fetal possam ser REGISTRADOS na ficha (retorno) em que a gestante os traz, e que
-- o bloco "abra em todas as fichas" (preenchendo "sem dados" quando a IG ainda não
-- permite). Modelo: 1 linha por consulta (consulta_id UNIQUE), com uma coluna por
-- exame — nula = "sem dados".
--
-- Relação com `decisoes_ficha_a`: os indicadores PFE-US/CA/LA do Retorno 2 (itens
-- 4/5/6 do checklist) continuam vivendo em `decisoes_ficha_a` porque DIRIGEM a
-- decisão de insulina da Ficha A/C (regra_fetal). Aqui eles reaparecem para as
-- DEMAIS fichas (Ficha E etc.), onde não há aquele checklist — na Ficha A/C o card
-- novo os oculta para não pedir em duplicata. As implicações de conduta dos campos
-- novos (crescimento, CMF, CTG, PBF) são FOLLOW-UP (aguardando ratificação clínica).
--
-- Famílias clínicas (só documentação; conduta não implementada aqui):
--   Família 1 (metabólica → insulina): pfe_us, ca, la, crescimento (excessivo).
--   Família 2 (vitalidade/morfologia → alerta): morfologico, cmf, ctg, pbf, crescimento (restrito).
--
-- ⚠️ Migrations NÃO rodam no Publish do Lovable — aplicar este SQL à mão no Supabase.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exames_fetais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid NOT NULL REFERENCES public.consultas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  -- USG morfológico de 2º trimestre (12-14 sem)
  morfologico text CHECK (morfologico IN ('normal','alterado')),
  -- USG obstétrico (crescimento fetal): PFE < P90 / CA < P75 / LA normal (sim = normal)
  pfe_us text CHECK (pfe_us IN ('sim','nao')),
  ca text CHECK (ca IN ('sim','nao')),
  la text CHECK (la IN ('sim','nao')),
  crescimento text CHECK (crescimento IN ('adequado','restrito','excessivo')),
  -- Vigilância fetal
  cmf text CHECK (cmf IN ('normal','diminuido')),                    -- contagem de movimento fetal
  ctg text CHECK (ctg IN ('tranquilizador','nao_tranquilizador')),   -- cardiotocografia anteparto
  pbf text CHECK (pbf IN ('sim','nao')),                             -- perfil biofísico fetal (8/10)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exames_fetais_consulta_uq
  ON public.exames_fetais(consulta_id);
CREATE INDEX IF NOT EXISTS exames_fetais_paciente_idx
  ON public.exames_fetais(paciente_id);

ALTER TABLE public.exames_fetais ENABLE ROW LEVEL SECURITY;

-- Profissional (dono da paciente OU colega da mesma unidade) — SELECT/INSERT/UPDATE/DELETE.
-- Espelha exatamente as policies de exames_usg (Prompt 29A).
CREATE POLICY "Profissional ve exames fetais de pacientes vinculadas"
ON public.exames_fetais FOR SELECT TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional cria exames fetais de paciente vinculada"
ON public.exames_fetais FOR INSERT TO authenticated
WITH CHECK (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional atualiza exames fetais de paciente vinculada"
ON public.exames_fetais FOR UPDATE TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Profissional deleta exames fetais de paciente vinculada"
ON public.exames_fetais FOR DELETE TO authenticated
USING (
  paciente_id IN (
    SELECT pac.id FROM public.pacientes pac
    JOIN public.profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.profissional_id = prof.id
       OR (pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id)
  )
);

CREATE POLICY "Gestor geral ve exames fetais das unidades vinculadas"
ON public.exames_fetais FOR SELECT TO authenticated
USING (
  is_gestor_geral(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = exames_fetais.paciente_id
      AND p.unidade_id IS NOT NULL
      AND gestor_geral_tem_unidade(auth.uid(), p.unidade_id)
  )
);
