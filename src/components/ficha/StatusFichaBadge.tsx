/**
 * StatusFichaBadge — badge visual do status da ficha (Prompt 34B seção 3.1.2).
 *
 * Reflete o valor de `consultas.status_ficha` (enum no banco):
 *   - 'rascunho'      → 🟡 amarelo "Rascunho"
 *   - 'completa'      → 🟢 verde "Completa"
 *   - 'laudo_gerado'  → 🔵 azul "Laudo gerado"
 *   - 'finalizada'    → ⚫ cinza "Finalizada"
 *
 * Valores desconhecidos não renderizam (permite ocultar em fichas legadas que
 * ainda não tiveram status_ficha populado).
 */

import { useTranslation } from 'react-i18next';

export type StatusFicha = 'rascunho' | 'completa' | 'laudo_gerado' | 'finalizada';

interface Props {
  status: string | null | undefined;
  className?: string;
}

const CONFIG: Record<StatusFicha, { labelKey: string; classes: string; emoji: string }> = {
  rascunho: {
    labelKey: 'ficha.statusFichaBadge.rascunho',
    classes: 'bg-amber-50 text-amber-800 border-amber-300',
    emoji: '🟡',
  },
  completa: {
    labelKey: 'ficha.statusFichaBadge.completa',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    emoji: '🟢',
  },
  laudo_gerado: {
    labelKey: 'ficha.statusFichaBadge.laudoGerado',
    classes: 'bg-sky-50 text-sky-800 border-sky-300',
    emoji: '🔵',
  },
  finalizada: {
    labelKey: 'ficha.statusFichaBadge.finalizada',
    classes: 'bg-gray-100 text-gray-700 border-gray-300',
    emoji: '⚫',
  },
};

export function isStatusFichaConhecido(s: string | null | undefined): s is StatusFicha {
  return s === 'rascunho' || s === 'completa' || s === 'laudo_gerado' || s === 'finalizada';
}

export default function StatusFichaBadge({ status, className = '' }: Props) {
  const { t } = useTranslation();
  if (!isStatusFichaConhecido(status)) return null;
  const cfg = CONFIG[status];
  const label = t(cfg.labelKey);
  return (
    <span
      role="status"
      aria-label={t('ficha.statusFichaBadge.ariaLabel', { label })}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.classes} ${className}`}
    >
      <span aria-hidden className="text-[10px] leading-none">{cfg.emoji}</span>
      {label}
    </span>
  );
}
