
CREATE TABLE public.registros_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id),
  unidade_id UUID REFERENCES public.unidades(id),
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN (
    'abrir_ficha','preencher_ficha_ac','preencher_ficha_bd','preencher_gtt',
    'consulta_inicial','retorno','perfil_glicemico','gerar_laudo',
    'registrar_parto','encerramento','editar_dados_paciente'
  )),
  recurso_id UUID,
  recurso_tipo TEXT,
  profissional_nome TEXT NOT NULL,
  profissional_crm TEXT,
  profissional_especialidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registros_paciente ON public.registros_atendimento(paciente_id, created_at DESC);
CREATE INDEX idx_registros_profissional ON public.registros_atendimento(profissional_id, created_at DESC);
CREATE INDEX idx_registros_unidade ON public.registros_atendimento(unidade_id, created_at DESC) WHERE unidade_id IS NOT NULL;
CREATE INDEX idx_registros_tipo ON public.registros_atendimento(tipo_operacao, created_at DESC);

ALTER TABLE public.registros_atendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_ve_seus_registros" ON public.registros_atendimento
FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
);

CREATE POLICY "gestor_ve_registros_unidade" ON public.registros_atendimento
FOR SELECT TO authenticated
USING (
  unidade_id IS NOT NULL
  AND unidade_id IN (
    SELECT unidade_id FROM public.profissionais
    WHERE user_id = auth.uid() AND perfil_institucional = 'gestor'
  )
);

CREATE POLICY "gestor_geral_ve_registros" ON public.registros_atendimento
FOR SELECT TO authenticated
USING (
  unidade_id IS NOT NULL
  AND unidade_id IN (
    SELECT ggu.unidade_id
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = auth.uid()
  )
);

CREATE POLICY "admin_ve_tudo_registros" ON public.registros_atendimento
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "profissional_pode_inserir" ON public.registros_atendimento
FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT id FROM public.profissionais WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.carimbar_atendimento(
  p_paciente_id UUID,
  p_tipo_operacao TEXT,
  p_recurso_id UUID DEFAULT NULL,
  p_recurso_tipo TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof RECORD;
  v_registro_id UUID;
BEGIN
  SELECT id, nome, crm, especialidade, unidade_id
  INTO v_prof
  FROM public.profissionais
  WHERE user_id = auth.uid();

  IF v_prof.id IS NULL OR v_prof.unidade_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.registros_atendimento (
    paciente_id, profissional_id, unidade_id, tipo_operacao,
    recurso_id, recurso_tipo,
    profissional_nome, profissional_crm, profissional_especialidade
  ) VALUES (
    p_paciente_id, v_prof.id, v_prof.unidade_id, p_tipo_operacao,
    p_recurso_id, p_recurso_tipo,
    v_prof.nome, v_prof.crm, v_prof.especialidade
  ) RETURNING id INTO v_registro_id;

  RETURN v_registro_id;
END;
$$;
