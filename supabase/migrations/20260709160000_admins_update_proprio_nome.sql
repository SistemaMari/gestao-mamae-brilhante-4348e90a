-- ============================================================
-- Configurações do admin: permitir que o admin edite o PRÓPRIO nome
-- ------------------------------------------------------------
-- A tabela public.admins tinha SELECT/INSERT/DELETE, mas NÃO tinha UPDATE,
-- então nenhuma tela conseguia gravar admins.nome. Esta policy libera o
-- admin a atualizar apenas a própria linha.
--
-- ⚠️ Aplicar via chat do Lovable (ele roda a migration) OU à mão no Supabase.
-- ============================================================

DROP POLICY IF EXISTS "Admin atualiza seus dados" ON public.admins;
CREATE POLICY "Admin atualiza seus dados"
ON public.admins FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
