import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { type ChecklistState } from './ChecklistRetorno2';
import { BOOL_ITEMS, FETAL_ITEMS } from './checklistRetorno2Items';

/**
 * Versão read-only do "Checklist clínico do Retorno 2" — exibe as 6 respostas
 * já gravadas (decisoes_ficha_a, hidratado no fetchPaciente) no card da ficha
 * salva, ao lado da grade. Sem botões: só leitura.
 *
 * Não renderiza nada quando a ficha não tem checklist (fichas antigas, ou
 * Ficha C > 30 sem, que não coleta o checklist) — evita um bloco vazio.
 */
function rotuloResposta(v: boolean | 'sim' | 'nao' | 'sem_info' | null): string {
  if (v === true || v === 'sim') return i18n.t('common.yes');
  if (v === false || v === 'nao') return i18n.t('common.no');
  if (v === 'sem_info') return i18n.t('ficha.checklistRetorno2ReadOnly.semInfo');
  return '—';
}

export default function ChecklistRetorno2ReadOnly({ value }: { value: ChecklistState }) {
  const { t } = useTranslation();
  const itens = [...BOOL_ITEMS, ...FETAL_ITEMS];
  const temResposta = itens.some(({ key }) => value[key] != null);
  if (!temResposta) return null;

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-2">
      <h3 className="text-sm font-bold text-[#5B21B6]">{t('ficha.checklistRetorno2ReadOnly.title')}</h3>
      <div className="divide-y divide-[#E5E0F2]">
        {itens.map(({ key, label }) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
            <span className="text-foreground">{label}</span>
            <span className="font-medium text-[#5B21B6] shrink-0">{rotuloResposta(value[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
