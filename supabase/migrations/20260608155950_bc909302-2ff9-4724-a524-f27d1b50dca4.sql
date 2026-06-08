-- Add revocation flag to gestores_gerais
ALTER TABLE public.gestores_gerais
  ADD COLUMN IF NOT EXISTS acesso_revogado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acesso_revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS acesso_revogado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_revogacao text;

-- Enforce revocation inside is_gestor_geral
CREATE OR REPLACE FUNCTION public.is_gestor_geral(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gestores_gerais
    WHERE user_id = _user_id
      AND acesso_revogado = false
  );
$$;

-- Enforce revocation inside gestor_geral_tem_unidade
CREATE OR REPLACE FUNCTION public.gestor_geral_tem_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gestores_gerais_unidades ggu
    JOIN public.gestores_gerais gg ON gg.id = ggu.gestor_geral_id
    WHERE gg.user_id = _user_id
      AND gg.acesso_revogado = false
      AND ggu.unidade_id = _unidade_id
  );
$$;

-- Tighten consolidacoes INSERT policy to require active gestor geral
DROP POLICY IF EXISTS "Gestor geral cria consolidados" ON public.consolidacoes;
CREATE POLICY "Gestor geral cria consolidados"
ON public.consolidacoes
FOR INSERT
TO authenticated
WITH CHECK (
  (
    gestor_geral_id IN (
      SELECT id FROM public.gestores_gerais
      WHERE user_id = auth.uid() AND acesso_revogado = false
    )
  )
  OR public.is_admin(auth.uid())
);

-- Scoped SELECT policy for gestor geral on profissionais (units they oversee)
DROP POLICY IF EXISTS "Gestor geral ve profissionais das suas unidades" ON public.profissionais;
CREATE POLICY "Gestor geral ve profissionais das suas unidades"
ON public.profissionais
FOR SELECT
TO authenticated
USING (
  unidade_id IS NOT NULL
  AND public.is_gestor_geral(auth.uid())
  AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
);