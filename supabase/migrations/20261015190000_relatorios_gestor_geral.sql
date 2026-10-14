-- ============================================================
-- Tela "Relatórios" do gestor geral (14/out/2026): ele baixa os relatórios
-- mensais (PDF) das unidades da rede, como o gestor de cada unidade.
--
-- O arquivo no storage já era liberado (is_gestor_geral + gestor_geral_tem_unidade),
-- mas a leitura da tabela relatorios_unidade dependia de has_role('gestor_geral')
-- em user_roles — que nem todo gestor geral tem (os criados pelo admin/importação
-- ficam só em gestores_gerais). Esta policy SOMA o mesmo critério do storage:
-- gestor geral ativo, unidade da rede dele, rede não encerrada. Não remove nada.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

DROP POLICY IF EXISTS "Relatorios unidade: gestor geral das unidades da rede" ON public.relatorios_unidade;
CREATE POLICY "Relatorios unidade: gestor geral das unidades da rede"
ON public.relatorios_unidade FOR SELECT TO authenticated
USING (
  public.is_gestor_geral(auth.uid())
  AND public.gestor_geral_tem_unidade(auth.uid(), unidade_id)
);
