# Histórico de consultas — abrir todas retraídas

## Comportamento atual
Ao entrar na ficha da paciente, dentro do card "Histórico de consultas", a consulta mais recente vem automaticamente expandida (accordion abre o primeiro item por padrão).

## Comportamento desejado
Ao entrar na ficha, todas as consultas do histórico aparecem retraídas (igual ao print). O usuário expande manualmente a que quiser. Só uma por vez continua podendo ficar aberta (comportamento single/collapsible mantido).

## Mudança
Arquivo: `src/pages/FichaPacientePage.tsx` (linha 1340).

Remover a prop `defaultValue={consultasHistorico[0]?.id}` do `<Accordion>` dentro do bloco "Histórico de consultas". Sem valor inicial, o accordion (`type="single" collapsible`) começa com tudo fechado.

## Fora de escopo
- Card "Histórico de consultas" em si (o `Collapsible` externo continua abrindo por padrão quando não há ficha em edição — sem mudança).
- Outros cards da ficha (Dados de identificação, USG, etc.).
- Comportamento ao salvar/criar nova consulta — sem alteração.

## Verificação
Abrir uma paciente com 2+ consultas: o card "Histórico de consultas" aparece aberto, mas os itens RETORNO 2 / RETORNO 1 / CASO NOVO ficam todos colapsados, com o chevron apontando para baixo — idêntico ao print.
