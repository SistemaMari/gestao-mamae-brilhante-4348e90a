/**
 * Labels dos 6 itens do "Checklist clínico do Retorno 2" — fonte única,
 * compartilhada entre o form (ChecklistRetorno2) e a versão read-only
 * (ChecklistRetorno2ReadOnly). Mantido em módulo de dados (sem componente)
 * para não disparar react-refresh/only-export-components.
 *
 * Itens 1-3: boolean (Sim/Não). Itens 4-6: FetalAnswer (Sim/Não/Sem informação).
 */
export const BOOL_ITEMS: Array<{ key: 'dieta' | 'exercicio' | 'ganho_peso'; label: string; tooltip: string }> = [
  { key: 'dieta', label: '1. Está aderindo à dieta orientada?', tooltip: 'Considerar adesão completa às orientações nutricionais (fracionamento, controle de carboidratos, etc.).' },
  { key: 'exercicio', label: '2. Está praticando exercício físico?', tooltip: 'Atividade física regular conforme orientação (caminhada após refeições, etc.).' },
  { key: 'ganho_peso', label: '3. Ganho de peso adequado para a IG?', tooltip: 'Avaliar ganho de peso semanal de acordo com IMC pré-gestacional e idade gestacional.' },
];

export const FETAL_ITEMS: Array<{ key: 'pfe_us' | 'ca' | 'la'; label: string; tooltip: string }> = [
  { key: 'pfe_us', label: '4. PFE-US < P90', tooltip: 'Peso fetal estimado por ultrassonografia abaixo do percentil 90 — descarta sinais de macrossomia.' },
  { key: 'ca', label: '5. CA < P75', tooltip: 'Circunferência abdominal fetal abaixo do percentil 75.' },
  { key: 'la', label: '6. LA normal', tooltip: 'Volume de líquido amniótico dentro da normalidade (ausência de polidrâmnio).' },
];
