
-- 1. Inserir admins iniciais (idempotente)
INSERT INTO public.admins (user_id, nome)
VALUES 
  ('5a881ae0-1ea6-4365-8a8f-d5e94f613b64', 'strategyaisolucoes'),
  ('6ba34fda-311d-4ca0-9246-b78b00ec7b92', 'moadecarvalho')
ON CONFLICT DO NOTHING;

-- 2. Policies de gestão para tabela admins
CREATE POLICY "Admins podem ver todos os admins"
ON public.admins FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem inserir admins"
ON public.admins FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem remover admins"
ON public.admins FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 3. Policies de gestão para tabela gestores_gerais
CREATE POLICY "Admins podem ver gestores gerais"
ON public.gestores_gerais FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem inserir gestores gerais"
ON public.gestores_gerais FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem remover gestores gerais"
ON public.gestores_gerais FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. Policies para gestão de unidades
CREATE POLICY "Admins podem inserir unidades"
ON public.unidades FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins podem atualizar unidades"
ON public.unidades FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 5. Permitir que admins vejam todos os profissionais (para gerenciar)
CREATE POLICY "Admins podem ver todos os profissionais"
ON public.profissionais FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 6. Permitir que admins atualizem profissionais (vincular a unidade, mudar perfil_institucional)
CREATE POLICY "Admins podem atualizar profissionais"
ON public.profissionais FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 7. Permitir que profissionais criem seu próprio registro (onboarding consultório)
CREATE POLICY "Usuario pode criar seu proprio registro profissional"
ON public.profissionais FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
