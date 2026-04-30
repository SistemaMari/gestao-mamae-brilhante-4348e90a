# Fix: admin cai em /onboarding ao logar

## Causa raiz

Em `src/contexts/AuthContext.tsx`, o efeito que monitora a sessão chama `setLoading(false)` **antes** de `determineProfile()` resolver — porque `determineProfile` está dentro de `setTimeout(..., 0)` e é assíncrono.

Sequência atual após login do admin:
1. `onAuthStateChange` dispara → `setUser(session.user)` + agenda `determineProfile` em setTimeout.
2. `setLoading(false)` executa imediatamente.
3. React renderiza `ProtectedRoute` com `loading=false`, `user=truthy`, `profile=null`.
4. `ProtectedRoute` linha 33: `if (profile === null && !skipOnboardingRedirect)` → `<Navigate to="/onboarding" />`.
5. `determineProfile` resolve `'admin'` ms depois, mas a navegação já aconteceu e o `OnboardingPage` é montado com `skipOnboardingRedirect`, ficando preso.

Resultado: admin (e qualquer perfil) sempre vê a tela de onboarding por uma fração de segundo, e às vezes fica preso nela. A própria conta `strategyaisolucoes` está corretamente registrada em `public.admins` — não é problema de dados.

## Correção

Manter `loading=true` enquanto o `profile` ainda não foi resolvido. Editar `src/contexts/AuthContext.tsx`:

- Extrair a resolução do perfil em `resolverPerfil(uid)` que faz `setProfile` e só depois `setLoading(false)`.
- No `onAuthStateChange`: quando há sessão, `setLoading(true)` e chama `resolverPerfil` dentro do `setTimeout(0)` (mantém o pattern anti-deadlock do Supabase).
- No `getSession` inicial: chama `resolverPerfil` direto; só faz `setLoading(false)` na ausência de sessão.
- Adicionar flag `cancelado` no cleanup para evitar `setState` após unmount.

Comportamento resultante: o `<Loader2>` do `ProtectedRoute` fica visível por uns ms até `determineProfile` retornar `'admin'`, e então redireciona corretamente para `/admin` sem passar pelo onboarding.

## O que NÃO muda

- Sem mudanças em `OnboardingPage.tsx`, `ProtectedRoute.tsx`, rotas, RLS, tabelas ou Edge Functions.
- A rota `/onboarding` continua existindo para usuários genuinamente sem perfil (auto-cadastro futuro / convidados que ainda não criaram registro).
- Nenhuma migração de banco.

## Arquivos editados

- `src/contexts/AuthContext.tsx` (apenas o `useEffect` que escuta auth state — ~30 linhas).

## Aceite

- Login com `strategyaisolucoes` cai direto em `/admin` (sem flash de onboarding).
- Login com profissional cai em `/dashboard`.
- Login com gestor cai em `/gestao`. Login com gestor geral em `/consolidar`.
- Usuário sem registro em nenhuma tabela continua indo para `/onboarding` (comportamento intencional).
