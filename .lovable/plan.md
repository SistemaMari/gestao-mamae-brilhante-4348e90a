Vou ajustar dois pontos:

1. Remover contagem/alertas de laudos para profissional institucional
- No shell clínico, a faixa global `Restam X laudos... / Ver planos` deixará de renderizar quando o perfil for `institucional`.
- No dashboard, o card `Plano / Laudos utilizados / Gerenciar plano` e o aviso `Você já usou X de Y laudos...` também ficarão restritos ao perfil `consultorio`.
- O perfil institucional continuará com acesso às telas clínicas permitidas, mas sem qualquer informação visual de consumo/plano de laudos.

2. Corrigir sidebar fixa
- No shell clínico, vou mudar o layout para a rolagem acontecer somente no conteúdo principal, não na página inteira.
- A sidebar desktop ficará fixa/sticky na lateral com altura da viewport abaixo do topo, e o rodapé com `Sair` ficará fora da área rolável interna.
- Vou garantir `h-screen/min-h-0/overflow-hidden` nos contêineres certos para impedir que a sidebar acompanhe o scroll do conteúdo.
- Vou revisar o mesmo padrão nos shells de gestor e gestor geral para manter o botão `Sair` sempre aparente.

Fora do escopo: não vou alterar regras de cobrança, geração de laudo, permissões, rotas ou banco de dados.