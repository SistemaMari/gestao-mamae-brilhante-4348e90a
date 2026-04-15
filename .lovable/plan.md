

# Plano: Permitir edição de valores clínicos da última consulta

## Problema
Hoje, ao salvar uma consulta (Retorno 1, GTT, Ficha A/C, Ficha B/D), o resultado aparece no histórico como read-only e não há como corrigir valores (ex: glicemia). O botão "Editar" no topo da ficha só edita dados demográficos (nome, nascimento, etc). A regra é: enquanto uma nova consulta não for aberta, a última consulta salva deve ser editável.

## Solução
Adicionar um botão "Editar" (ícone lápis) dentro de cada item do accordion do histórico, **apenas para a última consulta** (a mais recente). Ao clicar, o formulário correspondente reabre em modo de edição, pré-preenchido com os valores salvos.

## Implementação

### 1. Identificar a última consulta editável
Em `FichaPacientePage.tsx`, a última consulta é `consultasHistorico[0]` (o array está em ordem reversa). Definir `const isLastConsulta = c.id === consultasHistorico[0]?.id`.

### 2. Botão "Editar" no accordion de cada tipo
Dentro do `AccordionContent`, para a última consulta, renderizar um botão "Editar valores" que:
- Para `retorno_1`: reabre `Retorno1Form` em modo edição (já suporta `editingResult`)
- Para `retorno_gtt`: reabre `GttForm` em modo edição
- Para `ficha_a`/`ficha_c`: reabre `FichaACForm` em modo edição
- Para `ficha_b`/`ficha_d`: reabre `FichaBDForm` em modo edição

### 3. Modo edição nos formulários
Cada formulário receberá uma prop opcional `editingConsulta?: PreviewConsulta` que, quando presente:
- Pré-preenche todos os campos com os valores salvos
- Na hora de salvar, **atualiza** a consulta existente em vez de criar uma nova
- Recalcula diagnóstico/resultado com os novos valores

**Formulários a atualizar:**
- `Retorno1Form.tsx` — já tem `editingResult`, adaptar para receber dados da consulta salva
- `GttForm.tsx` — adicionar prop `editingConsulta` para pré-preencher `gtt_jejum`, `gtt_1h`, `gtt_2h`, `recurso_limitado`
- `FichaACForm.tsx` — adicionar prop para pré-preencher `grid_valores`, `peso_kg`, `data_inicio`, `data_fim`
- `FichaBDForm.tsx` — mesma lógica que FichaACForm

### 4. Fluxo de edição
1. Usuário expande a última consulta no accordion
2. Vê o botão "Editar" (lápis lilás) no canto superior direito do resultado
3. Clica → diálogo de confirmação: "Tem certeza? O resultado será recalculado."
4. Confirma → o formulário correspondente aparece pré-preenchido, substituindo o card de resultado
5. Salva → atualiza a consulta existente, recarrega dados, resultado recalculado aparece no accordion

### 5. Regra de visibilidade
O botão "Editar" **desaparece** quando:
- Uma nova consulta é aberta (formulário visível: `showRetorno1`, `showFichaAC`, etc.)
- O item não é a última consulta

## Arquivos modificados
- `src/pages/FichaPacientePage.tsx` — botão editar no accordion, state para controlar modo edição
- `src/components/Retorno1Form.tsx` — aceitar `editingConsulta` prop
- `src/components/GttForm.tsx` — aceitar `editingConsulta` prop
- `src/components/FichaACForm.tsx` — aceitar `editingConsulta` prop
- `src/components/FichaBDForm.tsx` — aceitar `editingConsulta` prop

