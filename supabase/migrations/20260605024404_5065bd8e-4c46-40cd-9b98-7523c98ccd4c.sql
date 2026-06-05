
-- Tighten INSERT policy on profissionais: prevent self-assignment to a unit/role
DROP POLICY IF EXISTS "Usuario pode criar seu proprio registro profissional" ON public.profissionais;
CREATE POLICY "Usuario pode criar seu proprio registro profissional"
ON public.profissionais
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND unidade_id IS NULL
  AND perfil_institucional IS NULL
  AND acesso_revogado = false
);

-- Tighten self-UPDATE: user cannot escalate by setting unidade/perfil/revogação
DROP POLICY IF EXISTS "Profissionais podem atualizar seus dados" ON public.profissionais;
CREATE POLICY "Profissionais podem atualizar seus dados"
ON public.profissionais
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND unidade_id IS NOT DISTINCT FROM (SELECT unidade_id FROM public.profissionais WHERE user_id = auth.uid())
  AND perfil_institucional IS NOT DISTINCT FROM (SELECT perfil_institucional FROM public.profissionais WHERE user_id = auth.uid())
  AND acesso_revogado IS NOT DISTINCT FROM (SELECT acesso_revogado FROM public.profissionais WHERE user_id = auth.uid())
  AND plano_id IS NOT DISTINCT FROM (SELECT plano_id FROM public.profissionais WHERE user_id = auth.uid())
  AND laudos_limite IS NOT DISTINCT FROM (SELECT laudos_limite FROM public.profissionais WHERE user_id = auth.uid())
  AND laudos_usados IS NOT DISTINCT FROM (SELECT laudos_usados FROM public.profissionais WHERE user_id = auth.uid())
  AND plano_status IS NOT DISTINCT FROM (SELECT plano_status FROM public.profissionais WHERE user_id = auth.uid())
);

-- Fix mutable search_path on email queue RPC wrappers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
