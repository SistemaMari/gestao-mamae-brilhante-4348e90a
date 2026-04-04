
-- Tabela de convites institucionais
CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  email_convidado text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  convidado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- RLS
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- Gestores podem ver convites da sua unidade
CREATE POLICY "Gestores podem ver convites da sua unidade"
ON public.convites FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais
    WHERE profissionais.user_id = auth.uid()
      AND profissionais.unidade_id = convites.unidade_id
      AND profissionais.perfil_institucional = 'gestor'
  )
);

-- Convites podem ser lidos publicamente por token (para validação na tela pública)
CREATE POLICY "Acesso público por token"
ON public.convites FOR SELECT TO anon
USING (true);

-- Índice para busca por token
CREATE INDEX idx_convites_token ON public.convites(token);
CREATE INDEX idx_convites_unidade ON public.convites(unidade_id);
