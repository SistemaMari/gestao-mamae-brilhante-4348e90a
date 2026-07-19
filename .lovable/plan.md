## Plano

1. **Ajustar a estrutura da tabela do dashboard exibida no print**
   - Alterar a tabela em `DashboardPage` para sair do layout `table-fixed`, porque hoje as larguras fixas comprimem as colunas e o aumento de `padding` quase não aparece visualmente.
   - Definir larguras mais coerentes por coluna: Gestante maior, IG Hoje compacta, Última consulta compacta, Status com espaço suficiente para chips, Retorno com espaço próprio.

2. **Melhorar separação entre títulos e colunas**
   - Trocar o cabeçalho atual, onde “ÚLTIMA CONSULTA” e “STATUS” ficam visualmente colados, para colunas realmente separadas com espaçamento consistente.
   - Adicionar divisórias verticais sutis entre os grupos de colunas, especialmente entre:
     - Gestante / IG Hoje
     - IG Hoje / Última consulta
     - Última consulta / Status
     - Status / Retorno

3. **Garantir que os chips não “invadam” a coluna vizinha**
   - Manter os badges de status e retorno com `whitespace-nowrap`, mas dar largura mínima suficiente para a coluna de status.
   - Evitar que a coluna “Retorno” fique colada no chip de status.

4. **Preservar o restante da tela**
   - Não alterar dados, filtros, busca, paginação, backend ou regras clínicas.
   - Não mexer na versão mobile em cards, porque o problema do print é a tabela desktop.

## Detalhe técnico

O problema provável é que a tabela está com `table-fixed` e colunas com larguras rígidas (`88px`, `120px`, `160px`, `220px`). Isso limita o efeito do padding: o espaço interno aumenta, mas a distribuição geral das colunas continua apertada. O ajuste deve ser estrutural: larguras de coluna + divisórias + tabela com layout mais flexível.