## Plano — Prompt 26B (revisado com 3 ajustes)

Backend (26A) já existe; ajuste mínimo necessário antes da tela.

---

### Ajuste 1 — Backend: expor `user_id` em `listar`

**Verificação feita no código** (`supabase/functions/gerenciar-admin/index.ts`, linhas 134–139): a ação `listar` retorna apenas `{ id, nome, email, created_at }` — **não retorna `user_id`**, que é necessário para esconder o botão "Remover" da linha do próprio admin logado (critério #3).

**Mudança cirúrgica** no map de saída do `listar`:

```ts
const out = (rows ?? []).map((r) => ({
  id: r.id,
  user_id: r.user_id,   // ← adicionado
  nome: r.nome,
  email: emailMap.get(r.user_id) ?? null,
  created_at: r.created_at,
}));
```

Sem outras mudanças no backend. Função é redeployada automaticamente.

---

### Arquivo principal: `src/pages/admin/AdminsPage.tsx`

Reescrita completa, substituindo o placeholder.

#### Estrutura

```text
┌ Header ──────────────────────────────────────────────┐
│ Administradores                  [+ Adicionar admin] │
│ [N] administradores                                  │
└──────────────────────────────────────────────────────┘
┌ Tabela (Sora títulos / Plus Jakarta corpo) ──────────┐
│ Nome | E-mail | Desde | Ações                        │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

- `useQuery(['admin-admins'])` chama `gerenciar-admin` com `{ acao: 'listar' }`.
- Skeleton enquanto carrega; estado vazio com mensagem padrão.
- `useAuth` (ou `supabase.auth.getUser()`) para obter `currentUserId`.
- Linhas zebradas (#FFFFFF / #F5F3FA), header roxo escuro #5B3A8E texto branco.
- "Remover" oculto se `admin.user_id === currentUserId` OU `admins.length <= 1`. Texto #DC2626, hover bg #FEE2E2.

---

### Ajuste 2 — Modal "+ Adicionar administrador" (validação)

shadcn `Dialog`, largura 480px. Estado local `{ nome, email, touchedNome, touchedEmail }`.

**Regras de validação:**
- `emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())`.
- `nomeValido = nome.trim().length > 0`.
- Erro inline abaixo do campo, texto vermelho #DC2626 menor que o input:
  - E-mail: aparece quando `touchedEmail && (!email || !emailValido)` → "E-mail inválido." (ou "E-mail obrigatório." se vazio).
  - Nome: aparece quando `touchedNome && !nomeValido` → "Nome obrigatório."
- `onBlur` em cada campo seta `touched*`.
- Botão **"Adicionar"**: `disabled={!nomeValido || !email || !emailValido || submitting}`. Habilita assim que os 3 critérios forem atendidos. Cor roxo #7C4DBA, hover #5B3A8E, spinner durante submit.
- Botão **"Cancelar"** sempre habilitado.

**Aviso fixo** dentro do modal (acima dos botões): bloco bg #F5F3FA, texto #4B3F66, ícone `Info` à esquerda, com mensagem de unicidade do prompt original.

**Mensagens de erro do backend (mapeadas inline no modal, abaixo do aviso):**
- `email_existente` → "Este e-mail já é administrador."
- `email_em_uso_profissional` / `_gestor_unidade` / `_gestor_geral` / `_outro` → mensagens específicas do Bloco 3.3.

**Sucesso**: fecha modal, toast verde "Administrador adicionado! E-mail enviado para [email].", `queryClient.invalidateQueries(['admin-admins'])`.

---

### Modal de confirmação de remoção

shadcn `AlertDialog`, borda esquerda vermelha 4px:
- Texto: "Tem certeza que deseja remover [nome] como administrador? Esta ação não pode ser desfeita."
- Botões "Cancelar" e "Confirmar remoção" (vermelho).
- Mensagens mapeadas: `auto_remocao` → "Você não pode remover a si mesmo."; `ultimo_admin` → "Não é possível remover o último administrador." (toast vermelho).
- Sucesso → toast "Administrador removido." + invalidate.

---

### Ajuste 3 — Tratamento de erro genérico (criar e remover)

Helper compartilhado:

```ts
async function extrairErroEdge(error: unknown) {
  let payload: any = null;
  try { payload = await (error as any)?.context?.json?.(); } catch {}
  console.error('[gerenciar-admin]', { error, payload });
  return { codigo: payload?.codigo as string | undefined, mensagem: payload?.mensagem as string | undefined };
}
```

**Fluxo nos dois mutations (criar e remover):**

```ts
const { data, error } = await supabase.functions.invoke('gerenciar-admin', { body });
if (error) {
  const { codigo } = await extrairErroEdge(error);
  if (codigo === 'email_existente') { /* inline modal */ return; }
  if (codigo === 'email_em_uso_profissional') { /* inline */ return; }
  if (codigo === 'email_em_uso_gestor_unidade') { /* inline */ return; }
  if (codigo === 'email_em_uso_gestor_geral') { /* inline */ return; }
  if (codigo === 'email_em_uso_outro') { /* inline */ return; }
  if (codigo === 'auto_remocao') { toast.error('Você não pode remover a si mesmo.'); return; }
  if (codigo === 'ultimo_admin') { toast.error('Não é possível remover o último administrador.'); return; }
  // Fallback genérico
  setOpen(false); // fecha modal (criar) — não deixa preso
  toast.error('Não foi possível concluir a ação. Tente novamente em instantes.');
  return;
}
```

- `console.error` sempre com `error` + `payload`.
- Fallback aplicado em **ambas** as mutations.
- No criar, o modal é fechado antes do toast genérico.

---

### Critérios de aceite cobertos

Originais 1–13 (lista, contador, ocultar Remover do próprio/único admin, modal com aviso fixo, mapeamento de todos os códigos, modal de confirmação, refresh via `invalidateQueries`, identidade visual roxo/lilás/branco + Sora + Plus Jakarta).

Adicionais 14–18:
- **14**: backend ajustado para retornar `user_id` no `listar` (verificação feita; mudança incluída).
- **15**: validação inline `onBlur` para nome e e-mail.
- **16**: botão "Adicionar" desabilitado enquanto critérios não atendidos.
- **17**: fallback genérico com toast padrão + `console.error` completo.
- **18**: fallback genérico aplicado em criar e remover.

---

### Fora de escopo
UI de auditoria, gestores institucionais (Prompt 27), edição inline de admin, perfil do admin.
