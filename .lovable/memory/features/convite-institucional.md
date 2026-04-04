---
name: Convite Institucional
description: Flow for institutional invites — edge functions, convites table, gestor equipe page, public invite registration page
type: feature
---
## Convite Institucional (Prompts 5A + 5B)

### Table: convites
- Fields: unidade_id, email_convidado, token (unique), status (pendente/aceito/expirado), convidado_por, expires_at (7 days)
- RLS: gestores can see their unit's invites; anon can read by token

### Edge Functions
1. **enviar-convite** — gestor sends invite (checks ja_vinculado, convite_pendente)
2. **aceitar-convite** — creates auth user + profissional record, sets convite to aceito
3. **vincular-profissional** — links existing consultório user to a unit
4. **remover-profissional** — sets unidade_id/perfil_institucional to null (fichas stay)

### Pages
- `/gestao/equipe` — GestaoEquipePage (gestor only): team list, invite modal, resend, remove
- `/convite/:token` — CadastroConvitePage (public): token validation, registration form, vincular flow

### Form Fields (convite registration)
Email (readonly), nome, senha, confirmar senha, CRM/COREN, especialidade, idioma (PT-BR/EN-US/ES)
No país/estado/cidade — location belongs to the unit.

### Email sending
Placeholder in enviar-convite — developer will integrate actual email service later.
