## Diagnóstico

Confirmei via SQL no banco:

| Email | user_id existe | linha em profissionais/admins/gg | plano | status |
|---|---|---|---|---|
| consultorio@teste.dramari | sim | profissionais ✓ | pro | ativo |
| consultorio.free@teste.dramari | sim | profissionais ✓ | free | ativo |
| institucional@teste.dramari | sim | profissionais ✓ (unidade vinculada) | pro | ativo |
| gestor@teste.dramari | sim | profissionais ✓ (perfil_institucional=gestor) | pro | ativo |
| gestorgeral@teste.dramari | sim | gestores_gerais ✓ | — | — |
| admin@teste.dramari | sim | admins ✓ | — | — |

Todos os 6 perfis estão **corretamente populados**. O login no Supabase Auth também sucedeu (confirmado nos auth logs). RLS de `profissionais` permite `auth.uid() = user_id`, então a query do `LoginPage` deveria encontrar a linha.

A mensagem **"Conta não vinculada a nenhum perfil. Entre em contato com o suporte."** que aparece na sua screenshot **não existe em nenhum lugar do código atual** (varri `src/`, `i18n/`, `LoginPage.tsx`, `AuthContext.tsx`). A versão atual do `LoginPage` mostra `t('auth.timeout')` quando o polling falha — texto diferente.

**Conclusão**: o navegador está renderizando um bundle JS antigo (cache do Service Worker / CDN), de antes da última correção do fluxo de login. Os dados e o código novo estão certos; o cliente é que está velho.

## Correções a executar

1. **Adicionar log de diagnóstico no LoginPage** para confirmar, no próximo login, qual perfil é detectado (some assim que confirmarmos):

```text
após cada query (admin / gestor_geral / profissionais), console.log
do resultado, para você ver no console qual ramo tomou.
```

2. **Forçar invalidação de cache**: bumpar versão no `index.html` (meta no-cache + query string no entry script via vite) para garantir que o bundle novo seja baixado.

3. **Instruções para você testar limpo**:
   - Hard reload: **Ctrl+Shift+R** (ou Cmd+Shift+R no Mac)
   - Ou abrir aba **anônima/incógnita** e logar com `consultorio@teste.dramari` / `Teste@2026`
   - Se ainda falhar, abra o DevTools → Console e me mande o que aparece após clicar em "Entrar"

4. **Se mesmo no incógnito falhar**, o problema real está no `LoginPage` — caso em que removo o polling manual e uso só o `AuthContext` (que já implementa `determineProfile` corretamente) + `getRedirectPath`. A página `/login` viraria: chama `signIn`, espera `profile` ficar não-nulo via context, e navega via `getRedirectPath(profile)`. Isso elimina a duplicação de lógica de detecção de perfil entre `AuthContext` e `LoginPage`.

## O que NÃO vou fazer

- Não vou recriar contas (já estão corretas no banco).
- Não vou mudar RLS (já permite o acesso).
- Não vou tocar no `AuthContext` antes de confirmar que o problema persiste em incógnito.

## Próximo passo

Aprove para eu (a) adicionar logs de diagnóstico no LoginPage e (b) bumpar cache-busting. Depois você testa em aba incógnita e me manda o resultado/console. Se ainda assim o erro aparecer, refatoro o LoginPage para usar só o AuthContext.
