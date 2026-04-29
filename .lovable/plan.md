## Objetivo

Garantir que cada perfil (consultorio, institucional, gestor, gestor_geral, admin) só acesse as rotas autorizadas. Hoje o `ProtectedRoute` já tem a prop `allowedProfiles` e ela já é aplicada em `/gestao`, `/admin` e `/consolidar`, mas **não está aplicada nas rotas clínicas** (`/dashboard`, `/dashboard/metricas`, `/paciente/*`, `/planos`, `/perfil`, `/laudos`, `/laudo/:id`). Além disso, o redirecionamento atual quando o perfil não é permitido manda sempre para `/dashboard`, o que é errado para `gestor`, `gestor_geral` e `admin`.

## Mudanças

### 1. `src/contexts/AuthContext.tsx`
- Exportar o tipo `UserProfile` (hoje é interno) para reuso no `ProtectedRoute`.
- Manter `getRedirectPath` intocado (já está exportado e correto).

### 2. `src/components/ProtectedRoute.tsx`
- Renomear/alinhar a prop existente `allowedProfiles` → manter o nome `allowedProfiles` (já em uso) e alinhá-la ao tipo `UserProfile` exportado.
- **Corrigir o redirecionamento**: hoje faz `Navigate to="/dashboard"` quando o perfil não está permitido. Trocar por `Navigate to={getRedirectPath(profile)} replace` para mandar cada perfil à sua home.
- Ordem de verificação preservada:
  1. loading → spinner
  2. sem `user` → `/login`
  3. `profile === null` (e não skipOnboardingRedirect) → `/onboarding`
  4. perfil incompleto (consultorio/institucional, sem skipProfileCheck) → `/completar-perfil`
  5. **NOVO comportamento**: perfil válido fora de `allowedProfiles` → `getRedirectPath(profile)` (hoje vai sempre p/ `/dashboard`)
  6. renderiza `children`
- Retrocompatibilidade: se `allowedProfiles` não for passado, comportamento idêntico ao atual.

### 3. `src/App.tsx` — aplicar matriz de acesso

Reorganizar o bloco do `AppShellClinico` em grupos por permissão:

```text
/dashboard, /dashboard/metricas         → [consultorio, institucional]
/paciente/nova, /paciente/:id           → [consultorio, institucional]
/laudos, /laudo/:id                     → [consultorio, institucional]
/planos                                 → [consultorio]
/perfil                                 → [consultorio, institucional, gestor, gestor_geral, admin]
/completar-perfil (skipProfileCheck)    → [consultorio, institucional]   (apenas perfis que precisam completar cadastro)
```

Rotas fora do shell clínico — apenas ajustar/confirmar `allowedProfiles`:
```text
/gestao                 → [gestor, admin, gestor_geral]   (manter como está)
/gestao/equipe          → [gestor]                        (manter)
/admin, /admin/*        → [admin]                         (manter)
/consolidar             → [admin, gestor_geral]           (manter)
```

Rotas que **não mudam**:
- Vitrine (`/vitrine/*`), `/login`, `/recuperar-senha`, `/nova-senha`, `/convite/:token`, `/onboarding`, `*` (NotFound).

### 4. Sem mudanças
- `getRedirectPath` permanece como está.
- RLS, edge functions, sidebars e UIs internas — fora de escopo.
- Sem toast/alert ao redirecionar (silencioso, conforme especificado).

## Diagrama de fluxo do ProtectedRoute

```text
request → loading? ──sim──► spinner
            │
            └─não─► user? ──não──► /login
                     │
                     └─sim─► profile==null? ──sim──► /onboarding
                              │
                              └─não─► perfil incompleto? ──sim──► /completar-perfil
                                       │
                                       └─não─► allowedProfiles && !inclui(profile)?
                                                ├─sim─► getRedirectPath(profile)
                                                └─não─► <children/>
```

## Critérios de aceite
1. Tipo `UserProfile` exportado de `AuthContext`.
2. `ProtectedRoute` usa `getRedirectPath(profile)` no fallback de não-autorizado (não mais `/dashboard` fixo).
3. Todas as rotas clínicas no `App.tsx` ganham `allowedProfiles` conforme a matriz.
4. Gestor digitando `/dashboard` → vai para `/gestao`. Gestor geral digitando `/admin` → vai para `/consolidar`. Admin digitando `/dashboard` → vai para `/admin`. Consultório digitando `/gestao` → vai para `/dashboard`. Institucional digitando `/planos` → vai para `/dashboard`.
5. Vitrine, login, onboarding e completar-perfil continuam funcionando como hoje.
6. Nenhuma rota existente quebra; sem mensagens visíveis no redirecionamento.