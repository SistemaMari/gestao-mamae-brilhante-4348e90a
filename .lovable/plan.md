## Aba "Dicas do Dashboard" no ADMIN + integração no painel institucional

### 1. Banco (Lovable Cloud)
Nova tabela `public.dicas_dashboard`:
- `id uuid pk default gen_random_uuid()`
- `slot int unique not null` (1..30) — controla ordem/limite fixo de 30 campos
- `texto text not null default ''`
- `ativa boolean not null default false` — só entra no sorteio se ativa e texto não vazio
- `updated_at timestamptz default now()`
- `updated_by uuid` (id do admin)

Grants + RLS:
- `GRANT SELECT ON public.dicas_dashboard TO authenticated` (todo profissional logado lê para exibir no dashboard).
- `GRANT ALL ON public.dicas_dashboard TO service_role`.
- Policies:
  - SELECT: `authenticated` — apenas linhas `ativa = true` visíveis para não-admins; admins veem tudo.
  - INSERT/UPDATE/DELETE: apenas `has_role(auth.uid(),'admin')`.
- Seed inicial: inserir 30 linhas (slots 1..30). Slots 1-9 populados com as 9 frases aprovadas e `ativa=true`; slots 10-30 com `texto=''` e `ativa=false`.

### 2. Aba no ADMIN
- Novo item na `AdminSidebar.tsx` "Dicas do dashboard" (ícone Lightbulb), posicionado logo abaixo de "Gerenciar tutoriais" (acima de "Planos").
- Nova rota `/admin/dicas` → `src/pages/admin/DicasAdminPage.tsx`:
  - Lista os 30 slots numerados (1..30) em cards verticais.
  - Cada slot: `Textarea` para o texto + `Switch` "Ativa" + botão "Salvar" (por slot) OU botão único "Salvar alterações" no topo (batch upsert). **Vamos com salvar em batch** — mais simples e evita 30 toasts.
  - Indicador de quantas dicas estão ativas ("9 de 30 ativas") e aviso se nenhuma estiver ativa.
  - Contador de caracteres (limite sugerido 160).
  - Validação client-side: não permitir marcar `ativa=true` com `texto` vazio.

### 3. Dashboard institucional (`src/pages/DashboardPage.tsx`)
- Substituir o array hard-coded `DICAS` por fetch do Supabase (`select texto from dicas_dashboard where ativa = true and texto <> '' order by slot`).
- Manter a rotação determinística por dia do ano sobre o array retornado.
- Fallback: se fetch falhar ou retornar vazio, usar as 9 frases atuais como default embutido (para não deixar o card vazio).
- Loading: enquanto carrega, mantém o card com skeleton curto (uma linha).

### 4. Arquivos afetados
- Migration nova (schema + seed).
- `src/pages/admin/DicasAdminPage.tsx` (novo).
- `src/App.tsx` (rota `/admin/dicas`).
- `src/components/admin/AdminSidebar.tsx` (item de menu).
- `src/pages/DashboardPage.tsx` (fetch + rotação).

Nenhuma mudança em i18n (card já é PT-BR only hoje).