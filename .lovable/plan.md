

# Plano: Alinhar cores dos cards de Visão Geral com as tags de Pacientes

## O que muda

Mapear as cores de fundo/borda/ícone dos 6 cards da seção "Visão Geral" do Dashboard de Métricas para corresponder exatamente às cores das tags usadas na tabela de Pacientes:

| Card | Tag atual (Pacientes) | Card atual (Métricas) | Nova cor do card |
|---|---|---|---|
| Aguardando GJ | `bg-gray-500` | Branco/cinza | Fundo cinza claro `#F1F5F9`, borda `#CBD5E1`, ícone cinza |
| Aguardando GTT | `bg-blue-500` | Lavanda | Fundo azul claro `#EFF6FF`, borda `#93C5FD`, ícone azul |
| DMG confirmado | `bg-orange-500` | Lavanda forte | Fundo laranja claro `#FFF7ED`, borda `#FDBA74`, ícone laranja |
| DMG afastado | `bg-emerald-500` | Verde-água | Fundo verde claro `#ECFDF5`, borda `#6EE7B7`, ícone emerald |
| Resultado do parto | `bg-purple-500` | Lavanda | Fundo roxo claro `#F5F3FF`, borda `#C4B5FD`, ícone roxo |
| Associar endocrino | `bg-red-500` | Rosa suave | Fundo vermelho claro `#FEF2F2`, borda `#FCA5A5`, ícone vermelho |

## Arquivo modificado
- `src/pages/DashboardMetricasPage.tsx` — Atualizar as props `bg`, `border` e `style.color` dos ícones nos 6 `StatusCard` da seção Visão Geral (linhas ~386-427) para usar tons claros derivados das cores das tags.

## Resultado
O usuário verá consistência visual imediata entre a cor da tag na lista de pacientes e o card correspondente no dashboard de métricas.

