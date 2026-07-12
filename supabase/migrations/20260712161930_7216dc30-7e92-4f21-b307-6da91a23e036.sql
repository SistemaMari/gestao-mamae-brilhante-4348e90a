-- 1. Adicionar status em feedbacks_usuario
ALTER TABLE public.feedbacks_usuario
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo'
  CHECK (status IN ('novo','lido','resolvido'));

-- 2. Policies admin (feedbacks): SELECT/UPDATE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedbacks_usuario' AND policyname='Admins veem todos os feedbacks'
  ) THEN
    CREATE POLICY "Admins veem todos os feedbacks"
      ON public.feedbacks_usuario FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='feedbacks_usuario' AND policyname='Admins atualizam status dos feedbacks'
  ) THEN
    CREATE POLICY "Admins atualizam status dos feedbacks"
      ON public.feedbacks_usuario FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 3. Policies admin (depoimentos): SELECT/UPDATE/DELETE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='depoimentos_usuario' AND policyname='Admins veem todos os depoimentos'
  ) THEN
    CREATE POLICY "Admins veem todos os depoimentos"
      ON public.depoimentos_usuario FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='depoimentos_usuario' AND policyname='Admins moderam depoimentos'
  ) THEN
    CREATE POLICY "Admins moderam depoimentos"
      ON public.depoimentos_usuario FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='depoimentos_usuario' AND policyname='Admins excluem depoimentos'
  ) THEN
    CREATE POLICY "Admins excluem depoimentos"
      ON public.depoimentos_usuario FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;