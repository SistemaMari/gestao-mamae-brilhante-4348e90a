## Por que está quebrando

A tabela do Dashboard (`src/pages/DashboardPage.tsx`, linhas 329-428) usa `w-full` sem `table-layout: fixed` e sem largura definida por coluna. Com a entrada de pacientes-teste com nomes longos ("1. #6 — Caso Novo ↔ Retorno 1 na mesma data", "Teste 03 — DMG → Ficha A adequado…"), o auto-layout do navegador inflou a coluna **Paciente** e comprimiu as demais. Junto disso:

- a coluna do ⚠ (`w-8`, comentário "38B-C (#15)") removeu ~32 px do espaço útil;
- os badges "OVERT DM", "Resultado do parto" e "Em dia — até DD/MM/AAAA" ficaram mais largos e não têm `whitespace-nowrap`;
- os cabeçalhos curtos ("IG hoje", "Última consulta", "Retorno") não têm largura mínima reservada, então quebram em duas linhas quando comprimidos.

Nenhuma mudança global de layout/CSS quebrou isso — é a combinação acima.

## Mudanças (escopo: apenas a tabela desktop do Dashboard)

**Arquivo único:** `src/pages/DashboardPage.tsx`

1. Adicionar `table-fixed` na `<table>` (linha 330) para o navegador respeitar larguras declaradas.
2. Reservar largura em cada `<th>` (linhas 333-338):
   - ⚠: `w-8` (já existe).
   - Paciente: `w-auto` (única coluna fluida) + truncar nome/identificador com `truncate` no `<td>`.
   - IG hoje: `w-[88px]`.
   - Última consulta: `w-[120px]`.
   - Status: `w-[160px]`.
   - Retorno: `w-[170px]`.
3. Em cada `<th>` curto adicionar `whitespace-nowrap` para garantir cabeçalho em uma linha.
4. Nos `<td>` de Paciente (linhas 363-370): envelopar `<p>` do nome e do número em `truncate` + `max-w-full`, e dar `min-w-0` na célula para o truncate funcionar dentro da tabela fixa.
5. Nos `<td>` de IG hoje, Última consulta, Status, Retorno: adicionar `whitespace-nowrap` ao conteúdo (o badge de Status e Retorno recebe `whitespace-nowrap` no `<span>` do badge).
6. Tooltip no nome truncado: envolver o `<p>` do nome num `<Tooltip>` (já importado) para exibir o nome completo no hover — preserva acessibilidade quando o nome é cortado.

## Fora de escopo

- Cards mobile (linhas 431+) — não há quebra reportada.
- Lógica de status, badges, ⚠, ordenação, paginação, filtros.
- Demais tabelas do sistema (admin, gestor, gestor geral).
- Mudança de tokens/tema/tipografia.

## Critérios de aceite

- Cabeçalhos "IG hoje", "Última consulta", "Status", "Retorno" sempre em uma linha.
- Badges "OVERT DM", "Resultado do parto", "Em dia — até DD/MM/AAAA" sem quebra interna.
- Nomes de paciente longos truncam com "…" e mostram nome completo via tooltip; demais colunas mantêm largura.
- Layout da tabela inalterado quando todos os nomes são curtos.
