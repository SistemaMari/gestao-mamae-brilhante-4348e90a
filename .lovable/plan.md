## Problema
Na ficha salva do Retorno 2 (read-only), o card "Checklist clínico do Retorno 2" aparece colado no card seguinte ("CONTROLE INADEQUADO — …"), sem respiro vertical entre eles.

## Causa
Em `src/pages/FichaPacientePage.tsx` (linhas ~1500-1530), `ChecklistRetorno2ReadOnly` e `FichaACResultCard` são renderizados como irmãos dentro de um `<>...</>`, e o container pai mais próximo não aplica `space-y` entre esses dois nós nesse nível.

## Mudança (apenas presentacional, 1 arquivo)
Envolver o `<ChecklistRetorno2ReadOnly />` em um `<div className="mb-4">` no `FichaPacientePage.tsx`, garantindo espaçamento consistente entre o checklist e o card de conduta logo abaixo.

Sem alterações em lógica, schema, edge functions ou no componente `ChecklistRetorno2ReadOnly` em si (que é reaproveitado em outros lugares).
