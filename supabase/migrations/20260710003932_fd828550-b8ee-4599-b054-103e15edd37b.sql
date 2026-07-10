DROP POLICY IF EXISTS "Admin atualiza seus dados" ON public.admins;

CREATE POLICY "Admin atualiza seus dados"
ON public.admins FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);