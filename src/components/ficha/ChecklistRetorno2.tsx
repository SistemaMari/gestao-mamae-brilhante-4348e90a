/**
 * 36B REV3 — PARTE 1: Checklist de 6 itens do Retorno 2.
 * O frontend NÃO decide conduta — apenas coleta as 6 respostas e envia ao backend.
 * Itens 1-3: Sim/Não (boolean). Itens 4-6: Sim/Não/Sem informação (text).
 */
import { Info } from 'lucide-react';
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

export function isChecklistCompleto(c: ChecklistState): boolean {
  return c.dieta !== null && c.exercicio !== null && c.ganho_peso !== null
    && c.pfe_us !== null && c.ca !== null && c.la !== null;
}

interface Props {
  value: ChecklistState;
  onChange: (next: ChecklistState) => void;
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

export default function ChecklistRetorno2({ value, onChange, disabled }: Props) {
  const set = <K extends keyof ChecklistState>(k: K, v: ChecklistState[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-[#5B21B6]">Checklist clínico do Retorno 2</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-[#7E69AB] cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                As 6 respostas são enviadas ao backend, que devolve a conduta (manter MEV / reforçar MEV / iniciar insulina / avaliar memória do glicosímetro) e a próxima ficha recomendada.
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
              <Pill disabled={disabled} active={value[key] === true} onClick={() => set(key, true)}>Sim</Pill>
              <Pill disabled={disabled} active={value[key] === false} onClick={() => set(key, false)}>Não</Pill>
            </div>
          </div>
        ))}

        <div className="border-t border-[#E5E0F2] pt-3 space-y-3">
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
                <Pill disabled={disabled} active={value[key] === 'sim'} onClick={() => set(key, 'sim')}>Sim</Pill>
                <Pill disabled={disabled} active={value[key] === 'nao'} onClick={() => set(key, 'nao')}>Não</Pill>
                <Pill disabled={disabled} active={value[key] === 'sem_info'} onClick={() => set(key, 'sem_info')}>Sem informação</Pill>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
