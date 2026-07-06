-- Prompt 42A: persistência de encerramento em pacientes (aditivo)

-- Enum do motivo de encerramento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_encerramento_paciente') THEN
    CREATE TYPE public.motivo_encerramento_paciente AS ENUM (
      'insulinizacao',
      'parto',
      'aborto',
      'nao_retornou',
      'outro'
    );
  END IF;
END$$;

-- Colunas novas (todas nullable — paciente ativa = vazio)
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS motivo_encerramento public.motivo_encerramento_paciente,
  ADD COLUMN IF NOT EXISTS data_encerramento   date,
  ADD COLUMN IF NOT EXISTS obs_encerramento    text;

COMMENT ON COLUMN public.pacientes.motivo_encerramento IS
  'Motivo do encerramento do acompanhamento. NULL = paciente ativa.';
COMMENT ON COLUMN public.pacientes.data_encerramento IS
  'Data do evento que encerrou o acompanhamento (parto/aborto/consulta/registro).';
COMMENT ON COLUMN public.pacientes.obs_encerramento IS
  'Observação livre — usada quando motivo_encerramento = ''outro''.';
