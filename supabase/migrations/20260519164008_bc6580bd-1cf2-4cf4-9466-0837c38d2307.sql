ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS referencia_usg_id uuid
REFERENCES public.exames_usg(id)
ON DELETE SET NULL;

UPDATE public.pacientes p
SET referencia_usg_id = (
  SELECT id FROM public.exames_usg e
  WHERE e.paciente_id = p.id
  ORDER BY e.ordem ASC
  LIMIT 1
)
WHERE p.referencia_ig = 'usg'
  AND p.referencia_usg_id IS NULL;