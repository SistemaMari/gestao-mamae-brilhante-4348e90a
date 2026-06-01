
-- 1. belongs_to_unidade: ignore revoked professionals
CREATE OR REPLACE FUNCTION public.belongs_to_unidade(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profissionais
    WHERE user_id = _user_id
      AND unidade_id = _unidade_id
      AND acesso_revogado = false
  );
$function$;

-- 2. partos SELECT policy: scope gestor_geral to assigned units
DROP POLICY IF EXISTS "Profissional pode ver seus partos" ON public.partos;
CREATE POLICY "Profissional pode ver seus partos"
ON public.partos
FOR SELECT
USING (
  (profissional_id IN (
    SELECT p.id FROM profissionais p
    WHERE p.user_id = auth.uid() AND p.acesso_revogado = false
  ))
  OR (paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof
      ON prof.user_id = auth.uid() AND prof.acesso_revogado = false
    WHERE pac.unidade_id IS NOT NULL
      AND pac.unidade_id = prof.unidade_id
  ))
  OR is_admin(auth.uid())
  OR (
    is_gestor_geral(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.pacientes pac2
      WHERE pac2.id = partos.paciente_id
        AND pac2.unidade_id IS NOT NULL
        AND public.gestor_geral_tem_unidade(auth.uid(), pac2.unidade_id)
    )
  )
);

-- 3. Storage policies for exportacoes-admin (admin-only)
DROP POLICY IF EXISTS "Admins can read exportacoes-admin" ON storage.objects;
DROP POLICY IF EXISTS "Admins can insert exportacoes-admin" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update exportacoes-admin" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete exportacoes-admin" ON storage.objects;

CREATE POLICY "Admins can read exportacoes-admin"
ON storage.objects FOR SELECT
USING (bucket_id = 'exportacoes-admin' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert exportacoes-admin"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exportacoes-admin' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update exportacoes-admin"
ON storage.objects FOR UPDATE
USING (bucket_id = 'exportacoes-admin' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete exportacoes-admin"
ON storage.objects FOR DELETE
USING (bucket_id = 'exportacoes-admin' AND public.is_admin(auth.uid()));

-- 4. Fix mutable search_path on remaining functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.get_painel_gargalos_detalhado(uuid, integer) SET search_path = public;
