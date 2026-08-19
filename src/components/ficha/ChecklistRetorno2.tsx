/**
 * 36B REV3 — PARTE 1: Checklist de 6 itens do Retorno 2.
 * O frontend NÃO decide conduta — apenas coleta as 6 respostas e envia ao backend.
 * Itens 1-3: Sim/Não (boolean). Itens 4-6: Sim/Não/Sem informação (text).
 */
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { BOOL_ITEMS, FETAL_ITEMS } from './checklistRetorno2Items';

export type FetalAnswer = 'sim' | 'nao' | 'sem_info' | null;

export interface ChecklistState {
  dieta: boolean | null;
  exercicio: boolean | null;
  ganho_peso: boolean | null;
  pfe_us: FetalAnswer;
  ca: FetalAnswer;
  la: FetalAnswer;
}

export const CHECKLIST_VAZIO: ChecklistState = {
  dieta: null, exercicio: null, ganho_peso: null,
  pfe_us: null, ca: null, la: null,
};

/** Os indicadores de crescimento fetal (PFE/CA/LA — itens 4/5/6) vêm da US
 *  obstétrica de crescimento, feita a partir de 28 sem. Antes disso não aparecem
 *  no checklist e não são exigidos. IG desconhecida (null) → mostra (default seguro). */
export const IG_MINIMA_FETAL = 28;
export function fetaisAplicaveis(igSemanas: number | null | undefined): boolean {
  return igSemanas == null || igSemanas >= IG_MINIMA_FETAL;
}

export function isChecklistCompleto(c: ChecklistState, igSemanas?: number | null): boolean {
  const base = c.dieta !== null && c.exercicio !== null && c.ganho_peso !== null;
  // Antes de 28 sem os itens fetais não são coletados → não entram no "completo".
  if (!fetaisAplicaveis(igSemanas)) return base;
  return base && c.pfe_us !== null && c.ca !== null && c.la !== null;
}

interface Props {
  value: ChecklistState;
  onChange: (next: ChecklistState) => void;
  /** IG (semanas) na consulta — abaixo de 28 os itens fetais (4/5/6) somem. */
  igSemanas?: number | null;
  disabled?: boolean;
}

function Pill({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-[#7C4DBA] text-white border-[#7C4DBA]'
          : 'bg-white text-[#5B21B6] border-[#D6BCFA] hover:bg-[#F1F0FB]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export default function ChecklistRetorno2({ value, onChange, igSemanas, disabled }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof ChecklistState>(k: K, v: ChecklistState[K]) => onChange({ ...value, [k]: v });
  const mostrarFetais = fetaisAplicaveis(igSemanas);

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-[#5B21B6]">{t('ficha.checklistRetorno2.title')}</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-[#7E69AB] cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                {t('ficha.checklistRetorno2.tooltip')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-3">
        {BOOL_ITEMS.map(({ key, label, tooltip }) => (
          <div key={key} className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground">{label}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs"><p className="text-xs">{tooltip}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-2">
              <Pill disabled={disabled} active={value[key] === true} onClick={() => set(key, true)}>{t('common.yes')}</Pill>
              <Pill disabled={disabled} active={value[key] === false} onClick={() => set(key, false)}>{t('common.no')}</Pill>
            </div>
          </div>
        ))}

        {/* V4 — indicadores de crescimento fetal (4/5/6): só a partir de 28 sem
            (vêm da US obstétrica de crescimento). Antes disso, ocultos. */}
        {mostrarFetais && (
        <div className="border-t border-[#E5E0F2] pt-3 space-y-3">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.checklistRetorno2.subtituloFetais')}</p>
          {FETAL_ITEMS.map(({ key, label, tooltip }) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-foreground">{label}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs"><p className="text-xs">{tooltip}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                <Pill disabled={disabled} active={value[key] === 'sim'} onClick={() => set(key, 'sim')}>{t('common.yes')}</Pill>
                <Pill disabled={disabled} active={value[key] === 'nao'} onClick={() => set(key, 'nao')}>{t('common.no')}</Pill>
                <Pill disabled={disabled} active={value[key] === 'sem_info'} onClick={() => set(key, 'sem_info')}>{t('ficha.checklistRetorno2.noInfo')}</Pill>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
