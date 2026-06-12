-- PROMPT 40A — Ampliar CHECK de registros_atendimento.tipo_operacao
-- Mantém os 11 valores existentes + acrescenta 4 novos.

ALTER TABLE public.registros_atendimento
  DROP CONSTRAINT IF EXISTS registros_atendimento_tipo_operacao_check;

ALTER TABLE public.registros_atendimento
  ADD CONSTRAINT registros_atendimento_tipo_operacao_check
  CHECK (tipo_operacao IN (
    -- 11 valores legados (preservados, inclusive abrir_ficha e perfil_glicemico)
    'abrir_ficha',
    'preencher_ficha_ac',
    'preencher_ficha_bd',
    'preencher_gtt',
    'consulta_inicial',
    'retorno',
    'perfil_glicemico',
    'gerar_laudo',
    'registrar_parto',
    'encerramento',
    'editar_dados_paciente',
    -- 4 novos (PROMPT 40A)
    'preencher_ficha_e',
    'inserir_usg',
    'trocar_referencia_ig',
    'reabrir_consulta'
  ));