## Ajustes no perfil do consultório + moderação no admin

Refinamentos sobre o que já foi construído em `/perfil`, mais duas novas abas no admin e uma saudação especial de aniversário.

### 1. Card Perfil — botão "Remover foto"

- Ao lado de "Trocar foto", novo botão outline lilás "Remover foto" (só aparece quando já existe avatar).
- Ação: apaga o arquivo do bucket `avatares-profissionais` e seta `avatar_url = null` em `profissionais`.
- Confirmação via `AlertDialog` ("Remover sua foto de perfil?").

### 2. Card Alterar senha — exigir senha atual

- Novo campo "Senha atual" no topo do card (com toggle olho).
- Fluxo: antes do `updateUser({ password })`, chamar `signInWithPassword({ email: user.email, password: senhaAtual })` para revalidar.
- Se falhar → erro "Senha atual incorreta" e não avança.
- Sem regras mínimas de complexidade (mantido).

### 3. Feedback → aba admin + e-mail para suporte

**Admin (nova aba `/admin/feedbacks`)**
- Item no `AdminSidebar.tsx` abaixo de "Dicas de dashboards".
- Página `FeedbacksAdminPage.tsx`: tabela ordenável (data, usuário, tipo, mensagem, anexo, status).
- Coluna `status` (`novo` | `lido` | `resolvido`) com toggle inline.
- Filtro por tipo e busca por texto.
- Contador de "novos" como badge no menu.

**E-mail para suporte**
- Novo template app-email `feedback-recebido.tsx` em `supabase/functions/_shared/transactional-email-templates/`.
- Registrar em `registry.ts`.
- Edge function `enviar-feedback` (ou disparo direto do envio existente): após inserir em `feedbacks_usuario`, invoca `send-transactional-email` para `suporte@maridmg.com.br` (configurável via secret `EMAIL_SUPORTE`).
- Idempotência: `idempotencyKey = feedback-${row.id}`.
- Se a infraestrutura de e-mail ainda não estiver configurada, executar `setup_email_infra` + `scaffold_transactional_email` antes.

**Schema**
- `ALTER TABLE feedbacks_usuario ADD COLUMN status text DEFAULT 'novo' CHECK (status IN ('novo','lido','resolvido'))`.
- Nova policy: admin lê tudo via `has_role(auth.uid(),'admin')`; admin pode `UPDATE status`.

### 4. Depoimento → aba admin para moderação

- Item no `AdminSidebar.tsx` abaixo de "Feedbacks".
- Página `DepoimentosAdminPage.tsx`: cards com estrelas, texto, nome do autor, data.
- Ações: "Aprovar", "Reprovar", "Excluir".
- Filtros: pendentes / aprovados / reprovados.
- Sem publicação automática em vitrine ainda (fora deste escopo).
- Policy admin: `SELECT` e `UPDATE aprovado` via `has_role`.

### 5. Aniversário → saudação especial no dashboard

- `DashboardPage.tsx` (consultório e institucional): busca `data_aniversario` do profissional.
- Se `to_char(data_aniversario,'MM-DD') = to_char(now(),'MM-DD')` → substitui o header:
  - Título: "🎉 Feliz aniversário, {Dr(a). Nome}!"
  - Subtítulo: "Que seu dia seja tão especial quanto o cuidado que você entrega às pacientes 💜"
  - Card lilás com gradient sutil (mesmos tokens `--gradient-primary`) em vez do fundo normal.
- Não afeta cards de métricas nem "Dica do dia".

### 6. Formato da data de aniversário (screenshot 3)

- Manter `<input type="date">` (nativo), mas envolver em wrapper com placeholder pt-BR visível ("dd/mm/aaaa") — já está assim, sem alteração adicional.

### Fora de escopo

- Publicação de depoimentos em landing pública.
- Purge efetivo de contas com `deleted_at`.
- Configurações da ferramenta (logo no laudo, notificações etc.) — iteração separada.

### Detalhes técnicos resumidos

**Backend**
- `feedbacks_usuario`: coluna `status` + policies admin.
- `depoimentos_usuario`: policies admin já cobrem `aprovado`.
- E-mail: verificar `check_email_domain_status`; se ok, scaffold do template `feedback-recebido` e deploy do `send-transactional-email`.
- Secret novo: `EMAIL_SUPORTE` (default `suporte@maridmg.com.br`).

**Frontend**
- `PerfilPage.tsx`: adicionar botão remover foto + campo senha atual.
- Novas páginas: `src/pages/admin/FeedbacksAdminPage.tsx`, `src/pages/admin/DepoimentosAdminPage.tsx`.
- Rotas em `AdminLayout`/`App.tsx`.
- `AdminSidebar.tsx`: dois itens novos + badge de "novos" em Feedbacks.
- `DashboardPage.tsx`: hook `useIsBirthday` + variante visual do header.
