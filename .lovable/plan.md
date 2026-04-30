## Diagnóstico

Encontrei duas causas raízes distintas, ambas confirmadas no banco de dados.

### Erro 1 — Redirecionamento para perfil de médico em vez de admin

A conta logada (`strategyaisolucoes`, `user_id 5a881ae0…`) está cadastrada **simultaneamente** em duas tabelas:

- `admins` (correto)
- `profissionais` (resíduo de cadastro antigo)

A função `determineProfile` em `AuthContext.tsx` consulta `admins` **primeiro**, então deveria retornar `'admin'`. Porém, como a consulta a `admins` usa `.maybeSingle()` e a RLS exige `auth.uid() = user_id`, **se o token JWT ainda não estiver propagado no momento exato da query** (race condition residual com `getSession`), a consulta retorna `null` silenciosamente e cai no fallback `profissionais` → perfil `consultorio`.

A conta `Admin Teste` (`f406391a…`) **não** está em `profissionais`, então funciona. Por isso o problema só aparece nesta conta específica.

### Erro 2 — "Limite de pacientes atingido" com 0/3

A função RPC `pode_criar_ficha` é `SECURITY DEFINER`, mas o privilégio `EXECUTE` **não foi concedido ao role `authenticated`** — apenas a `postgres`, `service_role` e `sandbox_exec`. Quando o Dashboard chama `supabase.rpc('pode_criar_ficha', …)`, a chamada falha silenciosamente, `data` vem `null`/`false`, e o código trata como "bloqueado" → abre o `BlockingModal`.

## Plano de correção

### 1. Limpar o cadastro duplicado do admin (migration)

Remover o registro de `profissionais` do `user_id 5a881ae0-1ea6-4365-8a8f-d5e94f613b64`, já que a conta é admin. Isso garante que mesmo no fallback a função retorne `'admin'`.

```sql
DELETE FROM public.profissionais
WHERE user_id = '5a881ae0-1ea6-4365-8a8f-d5e94f613b64';
```

### 2. Conceder EXECUTE nas RPCs de plano (migration)

```sql
GRANT EXECUTE ON FUNCTION public.pode_criar_ficha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_gerar_laudo(uuid) TO authenticated;
```

Isso resolve o BlockingModal indevido para todos os profissionais (não só o admin).

### 3. Tornar `determineProfile` mais defensivo (código)

Em `src/contexts/AuthContext.tsx`, ajustar `determineProfile` para:

- Se a query a `admins` retornar erro (não apenas `null`), tentar novamente uma vez antes de cair no fallback.
- Logar via `console.warn` quando uma conta tem registros em mais de uma tabela de perfil, facilitando diagnóstico futuro.

Sem mudança de comportamento para contas saudáveis.

### 4. Validação

Após aplicar:
- Login com `strategyaisolucoes` → deve ir direto para `/admin`.
- Login com qualquer profissional Free com 0 pacientes → botão "Nova Paciente" abre o formulário, sem BlockingModal.

## Resumo dos arquivos

- **Migration nova**: limpeza do duplicado + GRANT EXECUTE nas duas RPCs.
- **Editado**: `src/contexts/AuthContext.tsx` (hardening de `determineProfile`).

Nenhum outro arquivo é alterado.