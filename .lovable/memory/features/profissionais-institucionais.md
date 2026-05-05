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
listar_gestores_unidade, cadastrar_gestor_unidade (com `unidade_id` opcional), editar_gestor_unidade (só nome), revogar_acesso_gestor_unidade (bloqueia se vinculado → `gestor_ainda_vinculado`), reativar_acesso_gestor_unidade (não revincula), **vincular_gestor_a_unidade**, **desvincular_gestor** (não revoga, mantém ativo).

## `criar_unidade` — 3 modos
- `gestor_modo='novo'`: cria gestor + invite.
- `gestor_modo='existente'`: valida gestor solto, cria unidade e seta `unidade_id`.
- `gestor_modo='em_aberto'`: cria unidade sem gestor (status `criada_em_aberto`).

## 3 estados legítimos do par gestor↔unidade
1. **Vinculado** — gestor.unidade_id=X
2. **Unidade em aberto** — sem gestor ativo (badge "⚠ Sem gestor")
3. **Gestor solto** — gestor ativo, sem unidade (badge "⚠ Sem unidade")

## Desvincular ≠ Revogar
- **Desvincular**: gestor segue ativo. Unidade vira em aberto.
- **Revogar**: bloqueia login. Só permitido se gestor já estiver solto.

## Tela /gestao para gestor desvinculado
`src/pages/GestaoPage.tsx`: gestor ativo sem unidade vê mensagem "Você ainda não está vinculado a uma unidade".

## Códigos de erro novos
`unidade_ja_tem_gestor`, `gestor_nao_vinculado`, `gestor_revogado_para_vincular`.

## Combobox de gestores disponíveis
- Filtro client-side (poucos gestores). **Dívida técnica**: revisitar quando passar de 50.

## Campos novos em `profissionais` (Prompt 28)
`perfil_clinico`, `acesso_revogado`, `acesso_revogado_em/_por`, `motivo_revogacao`. Gate `acesso_revogado` em RLS de 8 tabelas clínicas.
