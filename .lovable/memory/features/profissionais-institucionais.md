---
name: Profissionais e gestores institucionais (admin)
description: 4 abas em /admin/institucionais — Unidades, Gestores de Unidade, Profissionais, Gestores Gerais. Inclui gate acesso_revogado em RLS.
type: feature
---

## Ordem das abas em `/admin/institucionais`
1. Unidades (default)
2. Gestores de Unidade
3. Profissionais
4. Gestores Gerais

## Distinção crítica
- `profissionais.perfil_institucional='gestor'` → aba "Gestores de Unidade".
- `profissionais.perfil_institucional='institucional'` (com `unidade_id`) → aba "Profissionais".
- Filtro `listar_profissionais` exclui gestores via `.neq("perfil_institucional", "gestor")`.

## Vínculo gestor↔unidade
- Não há coluna `unidades.gestor_id`. Vínculo é `profissionais.unidade_id` + `perfil_institucional='gestor'`.
- Cardinalidade 1:1 é convencional (sem UNIQUE no banco) — **dívida técnica**.
- Gestor pode existir SEM unidade (`unidade_id=NULL`), aguardando vinculação.

## Edge Function `gerenciar-institucional` — ações de gestor de unidade
listar_gestores_unidade, cadastrar_gestor_unidade (sem unidade), editar_gestor_unidade (só nome), revogar_acesso_gestor_unidade (bloqueia se vinculado → `gestor_ainda_vinculado`), reativar_acesso_gestor_unidade (não revincula).

## `criar_unidade` — modos
- `gestor_modo='novo'` (default, legado): cria gestor + envia invite.
- `gestor_modo='existente'`: valida gestor solto (perfil='gestor', `unidade_id IS NULL`, não revogado), cria unidade e seta `unidade_id`.

## Combobox de gestores disponíveis
- Filtro client-side (poucos gestores). **Dívida técnica**: revisitar quando passar de 50.

## Campos novos em `profissionais` (Prompt 28)
`perfil_clinico`, `acesso_revogado`, `acesso_revogado_em/_por`, `motivo_revogacao`. Gate `acesso_revogado` em RLS de 8 tabelas clínicas.
