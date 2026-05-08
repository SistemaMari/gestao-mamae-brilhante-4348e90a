---
name: Convite Institucional
description: Flow for institutional invites — edge functions, convites table, gestor equipe page, public invite registration page
type: feature
---
## Convite Institucional

### Regra fundamental: 1 e-mail = 1 modelo
Cada e-mail no MARI pertence a UM ÚNICO modelo:
- **consultório** (assinatura Asaas individual, `unidade_id = NULL`)
- **institucional** (vinculado a uma `unidade_id`)

NÃO existe migração entre modelos. Se uma pessoa de consultório quiser
atender numa unidade institucional, precisa criar conta com OUTRO e-mail.
Razões: Asaas cobra consultório individualmente; institucional é faturado
externamente; misturar quebraria cobrança e privacidade de prontuários.

### Table: convites
- Fields: unidade_id, email_convidado, token (unique), status (pendente/aceito/expirado), convidado_por, expires_at (7 days)
- RLS: gestores can see their unit's invites; anon can read by token

### Edge Functions
1. **enviar-convite** — gestor sends invite. Bloqueia se e-mail já é admin,
   gestor de outra unidade, gestor geral, profissional de outra unidade,
   OU profissional consultório → retorna `email_em_uso_consultorio`.
2. **aceitar-convite** — creates auth user + profissional record. Se
   o e-mail já tem auth user, retorna `email_existente` (sem vincular).
3. **vincular-profissional** — DESCONTINUADA. Retorna 410 Gone com
   mensagem explicando a nova regra. Mantida só para clientes legados.
4. **remover-profissional** — sets unidade_id/perfil_institucional to null (fichas stay)

### Pages
- `/gestao/equipe` — GestaoEquipePage (gestor only): team list, invite modal, resend, remove
- `/convite/:token` — CadastroConvitePage (public): token validation, registration form. Em caso de e-mail existente, mostra tela explicando a regra "1 e-mail = 1 modelo" com CTA "Voltar ao login".

### Form Fields (convite registration)
Email (readonly), nome, senha, confirmar senha, CRM/COREN, especialidade, idioma (PT-BR/EN-US/ES)
No país/estado/cidade — location belongs to the unit.

### Email sending
Placeholder in enviar-convite — developer will integrate actual email service later.
