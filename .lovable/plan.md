## Diagnóstico

Confirmei no banco:

- `roberto.costa@unesp.br` — usuário existe, email confirmado em 11/05, **`last_sign_in_at` = null** (nunca conseguiu logar).
- `suportemari@novodmg.com.br` — mesma situação: existe, confirmado, **nunca logou**.
- As outras 4 contas institucionais logaram hoje normalmente.

Como ambas nunca tiveram um login bem-sucedido, a senha que está hoje no `auth.users` para essas duas **não é** a que você tem na lista (`bwX@FJP&4u8f$NCZ` e `nwm*UXihErP37N4f`). Provavelmente foram criadas com outra senha em 11/05 e nunca atualizadas. Não dá pra ler o hash; precisa resetar.

## Plano

Criar uma edge function temporária `reset-senhas-teste` (protegida por header secreto) que usa a service role para chamar `auth.admin.updateUserById` e gravar a senha desejada para cada um dos dois emails.

1. **Nova edge function `supabase/functions/reset-senhas-teste/index.ts`**
   - Lê header `x-reset-secret` e compara com secret `RESET_SENHAS_SECRET`.
   - Recebe body `{ items: [{ email, password }] }`.
   - Para cada item: busca o user por email (`listUsers` paginado ou `getUserByEmail` via admin) e chama `supabase.auth.admin.updateUserById(id, { password, email_confirm: true })`.
   - Retorna log por item: `ok` / `not_found` / `error`.
   - Sem autenticação JWT (`verify_jwt = false` em `config.toml`), protegida só pelo secret.

2. **Secret novo**: `RESET_SENHAS_SECRET` (você confirma e eu adiciono via `add_secret` na hora de implementar).

3. **Execução**: depois do deploy, eu chamo a função com as duas linhas:
   - `roberto.costa@unesp.br` → `bwX@FJP&4u8f$NCZ`
   - `suportemari@novodmg.com.br` → `nwm*UXihErP37N4f`
   E mostro o resultado.

4. **Limpeza (opcional, recomendado)**: depois que confirmarmos que os dois entram, eu removo a edge function e o secret pra não ficar um endpoint de reset de senha vivo no projeto.

## Observação sobre o `suportemari`

Lembrando do diagnóstico anterior: esse user tem `admin` + linha em `profissionais` com nome "Roberto Costa" vinculada à UBS Demo Pinheiros. O reset de senha não toca nisso — se quiser, dá pra incluir nesse mesmo plano a limpeza (remover a role `institucional` extra e a linha de `profissionais` duplicada). Me diga se quer junto ou separado.
