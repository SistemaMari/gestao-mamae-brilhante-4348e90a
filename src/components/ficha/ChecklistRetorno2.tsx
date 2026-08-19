/**
 * 36B REV3 — PARTE 1: Checklist de 6 itens do Retorno 2.
 * O frontend NÃO decide conduta — apenas coleta as 6 respostas e envia ao backend.
 * Itens 1-3: Sim/Não (boolean). Itens 4-6: Sim/Não/Sem informação (text).
 */
import { useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { BOOL_ITEMS, FETAL_ITEMS } from './checklistRetorno2Items';
import {
  janelaDaIg, chaveLegendaJanela, type JanelaCrescimento, type RespostaVigenteCrescimento,
} from '@/lib/janelaCrescimentoFetal';
import { formatDateBR } from '@/lib/dateUtils';

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

/** Os indicadores de crescimento fetal (PFE/CA/LA — itens 4/5/6) são a leitura da
 *  US obstétrica de crescimento, e só são COLETADOS na janela do exame: 28–32 sem
 *  (1º) e a partir de 36 sem (2º). Entre 33 e 35 não há exame a preencher — o 1º
 *  já passou e o 2º ainda não aconteceu —, então não aparecem nem são exigidos.
 *  IG desconhecida (null) → mostra (default seguro, comportamento antigo). */
export const IG_MINIMA_FETAL = 28;
export function fetaisAplicaveis(igSemanas: number | null | undefined): boolean {
  if (igSemanas == null) return true;
  return janelaDaIg(igSemanas) != null;
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
  /** Resposta já registrada para o ultrassom DESTA janela (28–32 ou 36ª sem).
   *  Presente → os itens 4/5/6 aparecem fechados, sem repergunta: é o MESMO
   *  exame, lido na consulta de origem. Ver `janelaCrescimentoFetal`. */
  respostaVigente?: RespostaVigenteCrescimento | null;
  /** Último resultado de crescimento conhecido, para as semanas SEM janela de
   *  coleta (IG 33–35): não há o que preencher, mas o registro segue à vista. */
  ultimoRegistro?: RespostaVigenteCrescimento | null;
  disabled?: boolean;
}

/** Rótulo de qual dos dois ultrassons do cronograma está em jogo. Ao COLETAR avisa
 *  que na 36ª semana são parâmetros NOVOS; ao apenas EXIBIR o resultado já lido,
 *  usa a forma neutra (senão a tela diria "parâmetros novos" logo acima de "não é
 *  necessário responder de novo"). */
function LegendaJanela({ janela, registro }: { janela: JanelaCrescimento | null; registro: boolean }) {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] italic text-[#7E69AB]">{t(chaveLegendaJanela(janela, registro))}</p>
  );
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

export default function ChecklistRetorno2({ value, onChange, igSemanas, respostaVigente, ultimoRegistro, disabled }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof ChecklistState>(k: K, v: ChecklistState[K]) => onChange({ ...value, [k]: v });
  const mostrarFetais = fetaisAplicaveis(igSemanas);
  // O exame desta janela já foi lido em outra consulta → exibe fechado. O botão
  // de corrigir existe porque a UI só permite editar a consulta MAIS RECENTE:
  // sem ele, um registro errado ficaria travado até a janela seguinte — e são
  // esses parâmetros que indicam insulina (regra_fetal).
  const [corrigindo, setCorrigindo] = useState(false);
  // Três situações: (1) na janela do exame e ainda sem resultado → COLETA;
  // (2) na janela e resultado já lido → exibe fechado, com opção de corrigir;
  // (3) fora de janela (IG 33–35) → nada a preencher; se já existe resultado
  //     conhecido, ele é exibido como registro, sem opção de responder.
  const emJanela = fetaisAplicaveis(igSemanas);
  const travado = emJanela && !!respostaVigente && !corrigindo;
  const soRegistro = !emJanela && !!ultimoRegistro;
  const exibido = travado ? respostaVigente! : soRegistro ? ultimoRegistro! : null;
  const janela = exibido ? exibido.janela : janelaDaIg(igSemanas);

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

        {/* V4 — indicadores de crescimento fetal (4/5/6): vêm da US obstétrica de
            crescimento, então só são coletados na janela do exame (28–32 e ≥36).
            Fora dela sobra, no máximo, o registro do resultado já conhecido. */}
        {(mostrarFetais || soRegistro) && (
        <div className="border-t border-[#E5E0F2] pt-3 space-y-3">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.checklistRetorno2.subtituloFetais')}</p>
          {(janela || exibido) && <LegendaJanela janela={janela} registro={!!exibido} />}

          {exibido ? (
            /* Mesmo exame já lido: mostra as respostas fechadas e de onde vieram. */
            <div className="rounded-lg border border-[#D6BCFA] bg-white/70 p-3 space-y-2">
              <p className="text-xs text-[#5B21B6]">
                {t(soRegistro
                  ? 'ficha.checklistRetorno2.semExameNestaSemana'
                  : 'ficha.checklistRetorno2.jaRespondido', {
                  data: formatDateBR(exibido.data),
                  ig: exibido.igSemanas ?? '—',
                })}
              </p>
              {FETAL_ITEMS.map(({ key, label }) => {
                const v = exibido.valores[key];
                return (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-foreground">{label}</span>
                    <span className="text-xs font-semibold text-[#5B21B6]">
                      {v === 'sim' ? t('common.yes') : v === 'nao' ? t('common.no') : t('ficha.checklistRetorno2.noInfo')}
                    </span>
                  </div>
                );
              })}
              {/* Fora da janela do exame não há o que corrigir aqui: não existe
                  resultado novo para esta consulta, só o registro do anterior. */}
              {!disabled && travado && (
                <button
                  type="button"
                  onClick={() => setCorrigindo(true)}
                  className="text-[11px] underline text-[#7E69AB] hover:text-[#5B21B6]"
                >
                  {t('ficha.checklistRetorno2.corrigirExame')}
                </button>
              )}
            </div>
          ) : (
          <>
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
          </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
