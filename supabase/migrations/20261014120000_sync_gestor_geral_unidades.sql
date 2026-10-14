-- ============================================================
-- Fix: gestor geral criado/editado pelo admin não via nenhuma unidade.
--
-- Desde o modelo de contratantes (20260506004825), o admin vincula o gestor
-- geral a CONTRATANTES (gestores_gerais_contratantes) — gerenciar-institucional
-- criar_gestor_geral / atualizar_vinculos_gestor_geral. Mas toda a
-- visibilidade do gestor geral lê gestores_gerais_unidades: _unidades_gg,
-- gestor_geral_tem_unidade, as policies de RLS, FiltrosGestorGeralContext,
-- consolidar-relatorios. Nada preenchia essa tabela a partir do contratante
-- (só a migração única de 20260506004825) → painel vazio.
--
-- Correção: gatilhos mantêm gestores_gerais_unidades em sincronia com
--   (a) vínculos gestor geral × contratante (insert / delete) e
--   (b) unidades criadas num contratante ou transferidas de contratante,
-- + carga inicial dos vínculos que já existem. Nenhum leitor muda.
-- Só ACRESCENTA acessos derivados de contratante; vínculos diretos antigos
-- (criados por unidade) são preservados, exceto quando o próprio vínculo de
-- contratante que os justifica é removido.
--
-- ⚠️ Aplicar via chat do Lovable OU à mão no SQL Editor do Supabase.
-- ============================================================

-- (a) vínculo gestor geral × contratante
CREATE OR REPLACE FUNCTION public._ggu_sync_por_contratante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gestores_gerais_unidades (gestor_geral_id, unidade_id)
    SELECT NEW.gestor_geral_id, u.id
    FROM public.unidades u
    WHERE u.contratante_id = NEW.contratante_id
      AND NOT EXISTS (
        SELECT 1 FROM public.gestores_gerais_unidades x
        WHERE x.gestor_geral_id = NEW.gestor_geral_id AND x.unidade_id = u.id
      );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.gestores_gerais_unidades ggu
    USING public.unidades u
    WHERE ggu.gestor_geral_id = OLD.gestor_geral_id
      AND ggu.unidade_id = u.id
      AND u.contratante_id = OLD.contratante_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ggu_sync_por_contratante ON public.gestores_gerais_contratantes;
CREATE TRIGGER trg_ggu_sync_por_contratante
AFTER INSERT OR DELETE ON public.gestores_gerais_contratantes
FOR EACH ROW EXECUTE FUNCTION public._ggu_sync_por_contratante();

-- (b) unidade criada num contratante ou transferida para outro
CREATE OR REPLACE FUNCTION public._ggu_sync_por_unidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.contratante_id IS NOT DISTINCT FROM NEW.contratante_id THEN
    RETURN NEW;
  END IF;

  -- Transferência: quem via a unidade só pelo contratante antigo perde o acesso.
  IF TG_OP = 'UPDATE' AND OLD.contratante_id IS NOT NULL THEN
    DELETE FROM public.gestores_gerais_unidades ggu
    WHERE ggu.unidade_id = NEW.id
      AND ggu.gestor_geral_id IN (
        SELECT c.gestor_geral_id FROM public.gestores_gerais_contratantes c
        WHERE c.contratante_id = OLD.contratante_id
      )
      AND ggu.gestor_geral_id NOT IN (
        SELECT c.gestor_geral_id FROM public.gestores_gerais_contratantes c
        WHERE c.contratante_id = NEW.contratante_id
      );
  END IF;

  IF NEW.contratante_id IS NOT NULL THEN
    INSERT INTO public.gestores_gerais_unidades (gestor_geral_id, unidade_id)
    SELECT c.gestor_geral_id, NEW.id
    FROM public.gestores_gerais_contratantes c
    WHERE c.contratante_id = NEW.contratante_id
      AND NOT EXISTS (
        SELECT 1 FROM public.gestores_gerais_unidades x
        WHERE x.gestor_geral_id = c.gestor_geral_id AND x.unidade_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ggu_sync_por_unidade ON public.unidades;
CREATE TRIGGER trg_ggu_sync_por_unidade
AFTER INSERT OR UPDATE OF contratante_id ON public.unidades
FOR EACH ROW EXECUTE FUNCTION public._ggu_sync_por_unidade();

-- Funções de gatilho não devem ser chamadas diretamente pela API.
REVOKE ALL ON FUNCTION public._ggu_sync_por_contratante() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ggu_sync_por_unidade() FROM PUBLIC, anon, authenticated;

-- Carga inicial: todo gestor geral passa a ver as unidades dos contratantes
-- aos quais já está vinculado (o que o admin configurou e não funcionava).
INSERT INTO public.gestores_gerais_unidades (gestor_geral_id, unidade_id)
SELECT c.gestor_geral_id, u.id
FROM public.gestores_gerais_contratantes c
JOIN public.unidades u ON u.contratante_id = c.contratante_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.gestores_gerais_unidades x
  WHERE x.gestor_geral_id = c.gestor_geral_id AND x.unidade_id = u.id
);
