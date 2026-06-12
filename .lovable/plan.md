## Objetivo

Padronizar o badge da coluna "Retorno" no painel (`/dashboard`) para que o estado "Em dia" passe a exibir a data — ficando consistente com os outros dois estados:

- `Vencido há X dias` (vermelho)
- `Retorno próximo — até DD/MM/AAAA` (âmbar)
- **`Em dia — até DD/MM/AAAA`** (neutro) ← muda

Hoje o ramo "Em dia" mostra só o texto curto, o que dá a sensação (no perfil institucional) de que o sistema "perdeu" a informação da data.

## Mudança

### `src/pages/DashboardPage.tsx` — função `getReturnBadge` (linhas 58-62)

Trocar o label do estado `em_dia`:

```ts
return {
  type: 'em_dia',
  label: `Em dia — até ${dataLimite}`,
  tooltip: `Próximo retorno até ${dataLimite}.`,
};
```

Nenhuma alteração em cor, ícone, layout do badge ou na lógica do semáforo (≤ 0, ≤ 3, > 3 dias). O tooltip permanece igual.

## Fora de escopo

- Sem mudanças em `FichasUnidadePage`, edge functions, regras clínicas ou schema.
- Sem mudanças nos estados "vencido" e "próximo", que já mostram a data.
- Sem alterar versão mobile (já consome o mesmo `getReturnBadge`).

## Verificação manual

No `/dashboard` (ambos os perfis): pacientes com `status_ficha = 'dmg_confirmado'` e retorno daqui a mais de 3 dias passam a exibir `Em dia — até DD/MM/AAAA` no badge cinza.
