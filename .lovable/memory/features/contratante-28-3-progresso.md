---
name: Camada Contratante (Prompt 28.3) — COMPLETO
description: Trilogia 28.3 (a/b/c-1/c-2) 100% em produção. Camada Contratante totalmente integrada.
type: feature
---

## Status: ✅ Trilogia 28.3 COMPLETA. Apenas housekeeping não-bloqueante pendente.

### EM PRODUÇÃO
- Tabelas: `contratantes`, `gestores_gerais_contratantes`, `log_transferencia_unidade`.
- `unidades.contratante_id NOT NULL` + FK + trigger `validar_datas_contratante`.
- MARI Sandbox id=`feac2ad0-cb91-43c3-a043-094ac0d95d08`.
- RLS nas 3 novas tabelas.

### Edge Function `gerenciar-institucional` (28.3a aplicado)
Ações ajustadas:
- `criar_unidade`: valida `contratante_id` (existe + ativo). Fallback MARI Sandbox mantido até 28.3b expor Select.
- `listar_unidades`: retorna `contratante_id`/`contratante_nome`/`contratante_status`. Filtro opcional `contratante_id`.
- `criar_gestor_geral`: aceita `contratante_ids[]`. Backwards-compat: converte `unidade_ids[]` legado.
- `listar_gestores_gerais`: retorna `contratantes_vinculados[]`. Mantém `unidades`/`unidades_vinculadas` derivados via contratante (compat).
- `atualizar_vinculos_gestor_geral`: opera em `gestores_gerais_contratantes`. Alias `atualizar_vinculos_unidades` mantido convertendo unidade→contratante.
- `listar_profissionais`: retorna `contratante_id`/`contratante_nome`. Filtro opcional `contratante_id`.

Ações novas (6):
- `listar_contratantes` — retorna lista + counts (unidades, gestores_gerais, profissionais).
- `criar_contratante` — valida CNPJ (14 dígitos, normaliza com máscara, único), datas, e-mail.
- `editar_contratante` — UPDATE parcial. CNPJ e status imutáveis nesta ação.
- `encerrar_contratante` — modos `preview` / `confirmar`. Marca contratante=encerrado, unidades.ativa=false, profissionais.acesso_revogado=true com marker `encerramento_contratante:<id>`. signOut global. Dados clínicos preservados.
- `reativar_contratante` — reverte. Reativa SOMENTE profissionais cujo `motivo_revogacao` bate com o marker do encerramento (reativação seletiva).
- `transferir_unidade_de_contratante` — valida destino ativo, ≠origem, justificativa ≥20. Insere log + UPDATE unidade.

### Códigos de erro adicionados em `src/lib/mensagensUnicidade.ts`
`cnpj_duplicado`, `cnpj_invalido`, `contratante_inexistente`, `contratante_encerrado`, `contratante_destino_inativo`, `contratante_destino_igual_origem`, `data_termino_invalida`, `data_inicio_obrigatoria`, `justificativa_curta`, `nome_contratante_obrigatorio`, `contato_email_invalido`.

### Smoke tests (ok)
- `listar_contratantes` → MARI Sandbox + counts.
- `listar_gestores_gerais` → `contratantes_vinculados[]` populado, `unidades` compat preservado.
- `listar_unidades` → `contratante_nome` em todas as 4 unidades.
- `criar_contratante` → "Unimed RJ Smoke" criado (id `dd75c1f7-b779-4c66-a396-db7ea7848a52`, sem unidades — pode ser deletado manualmente).
- `cnpj_duplicado` bloqueado.
- `justificativa_curta` bloqueada na transferência.
- `encerrar_contratante` modo preview funciona.

### Dívidas técnicas registradas
- Operações multi-tabela em `encerrar_contratante`/`reativar_contratante` não usam transação real (limitação edge function). Idempotência garantida via marker `encerramento_contratante:<id>`.
- `MARI Sandbox` fallback em `criar_unidade` continua até 28.3b.
- Alias `atualizar_vinculos_unidades` continua até 28.3c remover do frontend.

### Próximos sub-prompts
- **28.3b**: AbaContratantes + ModalCadastrar/Editar; remover fallback MARI Sandbox de `criar_unidade` quando ModalCriarUnidade ganhar Select.
- **28.3c**: ModalEncerrar/AlertReativar/ModalTransferir + ajustes em AbaUnidades/AbaProfissionais/AbaGestoresGerais + nova ordem de tabs.

### 28.3b APLICADO
- Aba Contratantes (default) com listar/cadastrar/editar — CNPJ read-only no editar.
- Filtro client-side: `nome !== "MARI Sandbox"` em `AbaContratantes` e `SelectContratante`.
- `SelectContratante.tsx` reutilizável (props `incluirEncerrados`, `onIrParaContratantes`) — será usado em 28.3c (ModalTransferirUnidade, ModalCadastrarGestorGeral).
- `ModalCriarUnidade` agora exige `contratante_id`. Workaround MARI Sandbox REMOVIDO em `criar_unidade` (retorna `contratante_obrigatorio` se ausente).
- Validação data_termino > 1 ano: ALERTA via window.confirm, NÃO bloqueio.
- `listar_contratantes` agora retorna `unidades_nomes[]` para tooltip.
- `mensagensUnicidade.ts`: adicionado `contratante_obrigatorio`.
- Smoke OK: `criar_unidade` sem contratante_id → 400 `contratante_obrigatorio`.

### PENDENTE 28.3c (CRITICO — não esquecer)
- Botões **Encerrar** e **Reativar** em `AbaContratantes.tsx` estão como stub `disabled` com tooltip "Em breve — 28.3c". Implementar `ModalEncerrarContratante` + `AlertReativarContratante` chamando `encerrar_contratante`/`reativar_contratante` (já existem na Edge Function).
- ModalTransferirUnidade + ajustes em AbaUnidades/AbaProfissionais (coluna Contratante) + AbaGestoresGerais (vínculo por contratante).

### 28.3c-1 APLICADO
- AbaUnidades: nova coluna "Contratante" entre Cidade e Gestor + filtro Select; MARI Sandbox como badge cinza ⚙ Sandbox; click na célula vai para aba Contratantes (stub).
- AbaProfissionais: nova coluna "Contratante" entre Unidade e Status + filtro Select; profissionais sem contratante exibem "—" e somem ao filtrar contratante específico.
- AbaGestoresGerais: coluna "Unidades" → "Contratantes" usando `contratantes_vinculados[]`; tooltip lista até 10 nomes + "…".
- ModalCadastrarGestorGeral: troca para `MultiSelectContratantes` + envia `contratante_ids` (campo legado `unidade_ids` removido).
- ModalEditarVinculos: usa `contratantes_vinculados` + carrega ativos+encerrados, encerrados só visíveis se já estavam vinculados (prop `desabilitarEncerrados`).
- Novo componente `MultiSelectContratantes.tsx` (duplicado de MultiSelectUnidades).
- BUG FIX `AbaGestoresUnidade`: filtro 'Ativos' agora inclui convite pendente; só revogados ficam excluídos.

### 28.3c-2 APLICADO ✅ Trilogia 28.3 COMPLETA
- Backend: `listar_gestores_unidade` e `listar_gestores_gerais` agora retornam `contratante_id`/`nome`/`status` via JOIN.
- 3 modais novos: `ModalEncerrarContratante` (preview impacto + motivo ≥20), `AlertReativarContratante`, `ModalTransferirUnidade` (excluirIds + justificativa ≥20).
- `SelectContratante` ganhou prop `excluirIds[]`.
- `AbaContratantes`: botões Encerrar (status=ativo) e Reativar (status=encerrado) funcionais — stubs disabled removidos.
- `AbaUnidades` + `LinhaUnidadeExpandida`: ação "Transferir contratante" (disabled tooltip se unidade inativa).
- `AbaGestoresUnidade`: nova coluna Contratante (badge ⚙ Sandbox / ⊘ Encerrado) + filtro Contratante; colSpan ajustado para 6.
- `AbaProfissionais`: badge ⊘ Encerrado + opacity-60 em linhas com contratante encerrado.
- `AbaGestoresGerais`: tooltip prefixa ⊘ em contratantes com `status="encerrado"`.

### Housekeeping pós-28.3 (futuro, não-bloqueante)
- Remover `MultiSelectUnidades.tsx` legado.
- Remover ação alias `atualizar_vinculos_unidades` no backend (mantido por compat).
- Substituir stub `onIrParaContratantes` por filtro automático na aba Contratantes (V2).
