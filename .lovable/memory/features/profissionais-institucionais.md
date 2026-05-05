---
name: Profissionais institucionais (admin)
description: 3ª aba em /admin/institucionais — listar/convidar/editar/transferir/revogar profissionais. Inclui gate acesso_revogado em RLS.
type: feature
---

## Campos novos em `profissionais`
- `perfil_clinico` TEXT (medico|enfermeiro|tecnico_enfermagem|outro) — separado de `especialidade` (texto livre) e `perfil_institucional` (gestor|institucional, controla `user_roles`).
- `acesso_revogado` BOOLEAN, `acesso_revogado_em`, `acesso_revogado_por` (FK profissionais), `motivo_revogacao` TEXT.

## Gate `acesso_revogado` nas RLS (8 tabelas)
pacientes, consultas, exames_glicemia, perfis_glicemicos, valores_perfil, laudos, partos, registros_atendimento. Profissional revogado não vê nem insere nada clínico. Função `carimbar_atendimento` retorna NULL se revogado.

## Edge Function — 6 ações novas em `gerenciar-institucional`
listar_profissionais, convidar_profissional_unidade, editar_profissional, transferir_profissional, revogar_acesso_profissional, reativar_acesso_profissional. Todas exigem admin.

- editar_profissional só altera `nome` e `perfil_clinico`. CRM e e-mail são imutáveis (preserva carimbo CFM).
- transferir_profissional: NÃO move pacientes (ficam órfãs na unidade origem para reatribuição).
- email_em_uso_consultorio: bloqueia com mensagem específica (não força vínculo).

## Frontend
- `AbaProfissionais.tsx` — query `["institucional","profissionais"]`, filtros (unidade/status/busca).
- 5 modais/alerts: ModalConvidarProfissional, ModalEditarProfissional, ModalTransferirProfissional, AlertRevogarAcesso, AlertReativarAcesso.
- `AuthContext.determineProfile`: força signOut se `acesso_revogado=TRUE`.

## Dívida técnica
- E-mails lidos via `auth.admin.listUsers/getUserById` (1 chamada por user_id em listar_profissionais). OK até ~100 profs; depois cachear `email` na tabela profissionais.
