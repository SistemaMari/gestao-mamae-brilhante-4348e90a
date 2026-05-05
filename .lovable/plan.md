## Ajuste de rota nos magic links: `/definir-senha` → `/nova-senha`

### Auditoria das funções

| Função | Estado atual | Ação |
|--------|-------------|------|
| `gerenciar-institucional` | usa `/definir-senha?destino=...` em 5 chamadas | trocar para `/nova-senha?destino=...` |
| `gerenciar-admin` | `inviteUserByEmail` e `generateLink` **sem** `redirectTo` | adicionar `redirectTo: ${APP_URL}/nova-senha` |
| `asaas-webhook` (equivalente do Stripe neste projeto) | já usa `/nova-senha` ✓ | nada a fazer |
| `enviar-convite` (Prompt 5B) | gera token próprio em tabela `convites` (link `/cadastro-convite?token=...`); **não dispara magic link Supabase Auth** | nada a fazer (não há `redirectTo` aplicável) |

### Mudanças

**1) `supabase/functions/gerenciar-institucional/index.ts`** — 5 substituições, preservando `?destino=...`:
- L310: `/definir-senha?destino=/gestao` → `/nova-senha?destino=/gestao`
- L507: idem (troca de gestor)
- L685: `/definir-senha?destino=/consolidar` → `/nova-senha?destino=/consolidar`
- L1052–1053: ambos os caminhos do reenvio de convite

**2) `supabase/functions/gerenciar-admin/index.ts`**
- Definir constante no topo (mesmo padrão de `gerenciar-institucional`):
  ```ts
  const APP_URL = Deno.env.get("APP_PUBLIC_URL") ?? "https://gestao-mamae-brilhante.lovable.app";
  ```
- L248 (`inviteUserByEmail`): adicionar `redirectTo: \`${APP_URL}/nova-senha\`` ao objeto de opções, mantendo `data` existente.
- L265 (`generateLink` fallback): adicionar `options: { redirectTo: \`${APP_URL}/nova-senha\` }`.

**3) Deploy** das duas funções (`gerenciar-institucional`, `gerenciar-admin`) para garantir que o ajuste esteja em produção antes do primeiro convite real.

### Observação sobre Prompt 5B
O `enviar-convite` atual NÃO usa `inviteUserByEmail` nem `generateLink` — entrega o link `/cadastro-convite?token=...` próprio. Como o pedido é estritamente sobre `redirectTo`/`emailRedirectTo`, nada a alterar. Se quiser também trocar a URL do convite de profissional (mudança diferente, fora deste escopo), me avise.

### Fora de escopo
- Textos visíveis dos e-mails (botão "Definir senha e acessar" preservado).
- Banco, migrações, novas funções.
- UI de `/nova-senha` (já é multi-propósito conforme Prompt 4).