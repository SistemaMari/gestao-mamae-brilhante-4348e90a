## Preview: ficha encerrada por parto (fluxo novo)

Sem alterar código nem banco. Gero uma imagem estática (PNG) simulando exatamente como a ficha ficaria hoje, no fluxo atual (encerramento manual → motivo = parto → só data), reaproveitando os componentes existentes como referência visual:

**Composição da tela simulada**
1. Cabeçalho da paciente (nome fictício, idade, UBS) com o badge lilás `Acompanhamento encerrado (parto)`.
2. Card `EncerramentoPartoCard` (lavanda) com:
   - Título "Acompanhamento da MARI encerrado"
   - Linha nova: **"Parto em 15/06/2026"** (única informação persistida hoje)
   - Conclusão clínica curta (mesmo tom do card atual)
   - Sub-banner âmbar de reteste puerperal (GTT 75g entre 6 e 8 semanas)
3. **Sem** o card "Dados do parto" (`RegistroPartoReadOnlyCard`) — deixo explícito na legenda que ele não aparece mais no fluxo novo.
4. Rodapé "Preview visual · dados fictícios · fluxo atual pós-42H".

**Entregável**
- 1 PNG em `/mnt/documents/preview-encerramento-parto-fluxo-novo.png`, renderizado com `imagegen` no estilo da paleta do sistema (lilás #9b87f5 / lavanda #F1F0FB / âmbar #FEF3C7).
- Nenhum arquivo do projeto criado, editado ou removido. A rota dev `/dev/preview-encerramento-parto` anterior permanece como está (posso remover em outro turno se quiser).
