
-- 1. Add plano_expira_em to profissionais
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS plano_expira_em timestamp with time zone;

-- 2. Add Stripe fields to unidades
ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plano_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS plano_expira_em timestamp with time zone;

-- 3. Fix RLS on consultas: add unidade-based access
DROP POLICY IF EXISTS "Profissional pode ver suas consultas" ON public.consultas;
CREATE POLICY "Profissional pode ver suas consultas"
ON public.consultas FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid())
  OR
  paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid()
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  )
);

DROP POLICY IF EXISTS "Profissional pode criar consultas" ON public.consultas;
CREATE POLICY "Profissional pode criar consultas"
ON public.consultas FOR INSERT TO authenticated
WITH CHECK (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Profissional pode atualizar suas consultas" ON public.consultas;
CREATE POLICY "Profissional pode atualizar suas consultas"
ON public.consultas FOR UPDATE TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid())
);

-- 4. Fix RLS on exames_glicemia: add unidade-based SELECT access
DROP POLICY IF EXISTS "Profissionais can view own exames" ON public.exames_glicemia;
CREATE POLICY "Profissionais can view own exames"
ON public.exames_glicemia FOR SELECT TO authenticated
USING (
  profissional_id IN (SELECT p.id FROM profissionais p WHERE p.user_id = auth.uid())
  OR
  paciente_id IN (
    SELECT pac.id FROM pacientes pac
    JOIN profissionais prof ON prof.user_id = auth.uid()
    WHERE pac.unidade_id IS NOT NULL AND pac.unidade_id = prof.unidade_id
  )
);

-- 5. Create storage bucket for knowledge base
INSERT INTO storage.buckets (id, name, public)
VALUES ('base-conhecimento', 'base-conhecimento', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for authenticated users
CREATE POLICY "Authenticated users can read knowledge base"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'base-conhecimento');

-- Only service role / edge functions can upload (no user upload policy)
