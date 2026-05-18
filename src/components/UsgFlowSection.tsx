import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Activity, AlertTriangle } from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';

export type UsgFlowValue = {
  jaFezUsg: 'sim' | 'nao' | null;
  dataExame: string;          // YYYY-MM-DD
  igSemanas: string;          // numeric string
  igDias: string;             // numeric string
  referenciaIg: 'dum' | 'usg' | null;
};

export const emptyUsgFlow: UsgFlowValue = {
  jaFezUsg: null,
  dataExame: '',
  igSemanas: '',
  igDias: '',
  referenciaIg: null,
};

interface Props {
  value: UsgFlowValue;
  onChange: (v: UsgFlowValue) => void;
  dum: string;
  dumDesconhecida: boolean;
  /** Se já existe pelo menos uma USG no paciente, oculta pergunta inicial. */
  jaPossuiUsg?: boolean;
  /** Mostra apenas o badge "1ª USG — referência preferencial". */
  ehPrimeiraUsg?: boolean;
}

export default function UsgFlowSection({
  value,
  onChange,
  dum,
  dumDesconhecida,
  jaPossuiUsg = false,
  ehPrimeiraUsg = true,
}: Props) {
  const set = (patch: Partial<UsgFlowValue>) => onChange({ ...value, ...patch });

  const igPreenchida =
    value.dataExame.length > 0 && value.igSemanas !== '';

  const semRefDefinida =
    dumDesconhecida && (!jaPossuiUsg && (value.jaFezUsg !== 'sim' || !igPreenchida));

  // Quando DUM é desconhecida e USG é registrada, força referência = USG.
  const handleUsgFilled = () => {
    if (dumDesconhecida && value.referenciaIg !== 'usg') {
      set({ referenciaIg: 'usg' });
    }
  };

  return (
    <div className="space-y-4">
      {!jaPossuiUsg && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>A paciente já fez a 1ª ultrassonografia? <span className="text-destructive">*</span></Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Se sim, registre data do exame e a IG informada no laudo. A 1ª USG é a referência mais confiável.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-3">
            {(['sim', 'nao'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => set({ jaFezUsg: opt, ...(opt === 'nao' ? { dataExame: '', igSemanas: '', igDias: '', referenciaIg: dumDesconhecida ? null : 'dum' } : {}) })}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  value.jaFezUsg === opt
                    ? 'border-[#7C4DBA] bg-[#7C4DBA]/10 text-[#7C4DBA]'
                    : 'border-[#7C4DBA]/30 bg-card text-muted-foreground hover:border-[#7C4DBA]/60'
                }`}
              >
                {opt === 'sim' ? 'Sim' : 'Ainda não'}
              </button>
            ))}
          </div>
        </div>
      )}

      {(jaPossuiUsg || value.jaFezUsg === 'sim') && (
        <div className="rounded-xl border border-[#7C4DBA]/30 bg-[#F8F6FC] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#7C4DBA]" />
            <h3 className="text-sm font-semibold text-[#5B21B6]">
              Dados da {ehPrimeiraUsg ? '1ª ' : ''}Ultrassonografia
            </h3>
            {ehPrimeiraUsg && (
              <span className="ml-auto text-[10px] font-medium bg-[#7C4DBA] text-white px-2 py-0.5 rounded-full">
                1ª USG — referência preferencial
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="usg-data" className="text-xs">Data do exame *</Label>
              <Input
                id="usg-data"
                type="date"
                value={value.dataExame}
                onChange={(e) => { set({ dataExame: e.target.value }); handleUsgFilled(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usg-sem" className="text-xs">Semanas *</Label>
              <Input
                id="usg-sem"
                type="number"
                min={0}
                max={42}
                value={value.igSemanas}
                onChange={(e) => { set({ igSemanas: e.target.value }); handleUsgFilled(); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usg-dias" className="text-xs">Dias *</Label>
              <Input
                id="usg-dias"
                type="number"
                min={0}
                max={6}
                value={value.igDias}
                onChange={(e) => { set({ igDias: e.target.value }); handleUsgFilled(); }}
              />
            </div>
          </div>

          {igPreenchida && (
            <div className="space-y-2 border-t border-[#7C4DBA]/20 pt-3">
              <Label className="text-xs font-medium text-[#5B21B6]">
                Qual referência usar para calcular IG a partir de agora?
              </Label>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${
                  value.referenciaIg === 'dum' ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
                } ${dumDesconhecida ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="ref-ig"
                    checked={value.referenciaIg === 'dum'}
                    disabled={dumDesconhecida || !dum}
                    onChange={() => set({ referenciaIg: 'dum' })}
                  />
                  <span>
                    DUM {dum ? `— ${formatDateBR(dum)}` : '(não informada)'}
                  </span>
                </label>
                <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${
                  value.referenciaIg === 'usg' ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
                }`}>
                  <input
                    type="radio"
                    name="ref-ig"
                    checked={value.referenciaIg === 'usg'}
                    onChange={() => set({ referenciaIg: 'usg' })}
                  />
                  <span>
                    {ehPrimeiraUsg ? '1ª USG' : 'USG'} — {value.igSemanas || 0}s {value.igDias || 0}d
                    {value.dataExame ? ` em ${formatDateBR(value.dataExame)}` : ''}
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {semRefDefinida && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Sem referência de IG definida. O cálculo da janela GTT ficará indisponível até o registro da 1ª USG.
          </span>
        </div>
      )}
    </div>
  );
}
