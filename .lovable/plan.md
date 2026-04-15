

# Plano: Exibir laudo completo (Blocos 1, 2 e 3) após salvar Ficha A/C

## Problema
Após salvar a Ficha A/C e fechar o popup de impacto, o formulário desmonta e o card de resultado no histórico recebe dados zerados (`percentual={0}`, `totalPreenchidos={0}`). O laudo com os 3 blocos nunca aparece.

## Causa raiz
1. `PreviewConsulta` não armazena os dados do perfil glicêmico (percentual, totalPreenchidos, dentroMeta, peso, dose).
2. Na `FichaPacientePage`, o `FichaACResultCard` dentro do accordion usa valores hardcoded `0`.
3. Não existe lógica para mostrar o resultado standalone após fechar o popup (como existe para Retorno 1).

## Solução

### 1. Expandir `PreviewConsulta` com campos opcionais do perfil
**Arquivo:** `src/lib/previewPatients.ts`
- Adicionar campos opcionais: `percentual_meta`, `total_preenchidos`, `dentro_meta`, `peso_kg`, `dose_total`, `dose_manha`, `dose_noite`, `retorno_dias`, `data_proximo_retorno`.

### 2. Salvar esses dados na consulta preview
**Arquivo:** `src/components/FichaACForm.tsx`
- No bloco `isPreview`, incluir os campos novos no objeto `newConsulta`.

### 3. Passar dados reais ao FichaACResultCard no histórico
**Arquivo:** `src/pages/FichaPacientePage.tsx`
- No accordion, ao renderizar `FichaACResultCard` para `ficha_a`/`ficha_c`, usar `c.percentual_meta`, `c.total_preenchidos`, `c.dentro_meta`, etc. em vez de zeros.

### 4. Mostrar resultado standalone após fechar popup
**Arquivo:** `src/pages/FichaPacientePage.tsx`
- Usar `fichaACCompleted` + `fichaACResult` (estado local com os dados do resultado) para renderizar um `FichaACResultCard` completo quando o form é desmontado — mesma lógica usada para Retorno 1.

### 5. Garantir que o `FichaACResultCard` já existente mostra os 3 blocos
**Arquivo:** `src/components/FichaACResultCard.tsx`
- Bloco 1: Resultado e conduta (já existe).
- Blocos 2 e 3: Placeholder com borda tracejada (já existe — confirmar que aparece).
- Notas técnicas e instrução Ctrl+P (já existem).

## Resultado
Após salvar e fechar o popup, o laudo completo aparece na ficha da paciente com: resultado colorido (verde/laranja), conduta, placeholder dos blocos 2/3, notas técnicas e instrução de impressão.

