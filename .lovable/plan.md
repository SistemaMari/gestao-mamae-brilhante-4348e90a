## Perfil editável do consultório

Substituir a `PerfilPage` atual (que só mostra "Edição de perfil será construída em breve") por uma tela real de edição na paleta MARI (lilás/verde-água, nada de amarelo/coral do mockup CheckPlanner). Escopo restrito ao perfil **consultório** — o institucional continua read-only (dados vêm da unidade).

### Estrutura da página `/perfil` (consultório)

Header: "Meu perfil" · "Personalize seu espaço."

Cards empilhados, coluna única, largura máx. ~720px:

**1. Perfil**
- Avatar circular editável ("Trocar foto") — PNG/JPG até 2 MB, recorte quadrado no cliente
- Nome completo
- E-mail (read-only + botão "Solicitar alteração" abrindo modal explicando que a troca passa pelo suporte)
- Telefone / WhatsApp (opcional)
- Data de aniversário (opcional, para saudação especial no dia)
- Botão **Salvar** lilás

**2. Dados profissionais**
- Especialidade (select: Médico(a), Enfermeiro(a) Obstétrica, Outros)
- Conselho (CRM/COREN) + UF
- Botão **Salvar**

**3. Alterar senha**
- Nova senha + confirmar (mostrar/ocultar com ícone de olho)
- Sem regras mínimas de complexidade — só valida que os dois campos batem e não estão vazios
- Botão **Salvar nova senha**

**4. Enviar feedback**
- Select "Tipo": Sugestão / Elogio / Reportar erro / Dúvida
- Textarea "Conta pra gente…" (máx. 1000 caracteres, contador)
- Botão "Anexar print" (1 imagem opcional até 3 MB)
- Botão **Enviar** lilás
- Persiste em `feedbacks_usuario`; notifica admin por e-mail

**5. Depoimento**
- "Está gostando do MARI? Deixe seu depoimento 💜"
- Rating 1–5 estrelas lilás
- Textarea "Conte como o MARI tem ajudado na sua rotina…"
- Botão **Enviar avaliação** lilás
- Persiste em `depoimentos_usuario`; admin aprova depois (fora deste escopo)

**6. Zona de perigo** (colapsado, borda vermelha suave)
- "Excluir minha conta" — modal LGPD, confirmação por senha; marca `deleted_at` (soft-delete). Purge efetivo em 30 dias fica fora deste escopo.

### Fora de escopo
- Tela `/configuracoes` da ferramenta (logo/assinatura no laudo, notificações, exportação LGPD) — proposta para iteração separada.
- Moderação/publicação dos depoimentos.
- Purge efetivo das contas excluídas.

### Detalhes técnicos

**Backend**
- Colunas novas em `profissionais` (nullable): `avatar_url text`, `data_aniversario date`, `deleted_at timestamptz`. (`telefone` já existe.)
- Bucket privado `avatares-profissionais` com RLS por `auth.uid()`; URLs assinadas no cliente.
- Nova tabela `public.feedbacks_usuario`: `user_id`, `tipo` (check), `mensagem`, `anexo_url`, `created_at`. GRANT insert/select p/ authenticated do próprio; admin lê tudo via `has_role`.
- Nova tabela `public.depoimentos_usuario`: `user_id`, `rating (1..5)`, `texto`, `aprovado bool default false`, `created_at`. Mesma lógica de GRANT/RLS.
- Edge functions: `solicitar-alteracao-email` (envia e-mail ao suporte), `excluir-minha-conta` (marca `deleted_at`, revoga sessão).
- Troca de senha: `supabase.auth.updateUser({ password })` no cliente — sem edge function.

**Frontend**
- Refatorar `src/pages/PerfilPage.tsx`: layout novo só para `profile === 'consultorio'`; institucional continua com a view read-only atual.
- Novos componentes em `src/components/perfil/`: `AvatarUploader`, `CardPerfilBasico`, `CardDadosProfissionais`, `CardAlterarSenha`, `CardFeedback`, `CardDepoimento`, `CardZonaPerigo`.
- Hook `useProfileMutation` para salvar em `profissionais` com toast otimista.
- Validação com zod em cada card (trim + limites de caracteres); nunca `dangerouslySetInnerHTML`.
- Dispara evento `admin:nome-atualizado` quando o nome muda, sincronizando o rodapé do sidebar.
