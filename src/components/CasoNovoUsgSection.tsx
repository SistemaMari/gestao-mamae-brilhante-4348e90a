import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Activity, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';
import { calcIgHojeFromDum, calcIgHojeFromUsg, formatIgCurto } from '@/lib/fichaUtils';
import {
  type CasoNovoUsgEntry,
  type CasoNovoUsgValue,
  ordenarUsgsPorData,
  ordinalUsg,
  temDatasUsgDuplicadas,
} from '@/lib/casoNovoUsg';

function novaEntry(): CasoNovoUsgEntry {
  return { localId: crypto.randomUUID(), dataExame: '', igSemanas: '', igDias: '' };
}

interface Props {
  value: CasoNovoUsgValue;
  onChange: (v: CasoNovoUsgValue) => void;
  dum: string;
  dumDesconhecida: boolean;
}

/**
 * Caso Novo — registra MÚLTIPLAS USGs e escolhe a referência de IG.
 * Numeração por data do exame (1ª = mais antiga). Sem default de referência:
 * o usuário é obrigado a escolher DUM ou uma das USGs.
 */
export default function CasoNovoUsgSection({ value, onChange, dum, dumDesconhecida }: Props) {
  const set = (patch: Partial<CasoNovoUsgValue>) => onChange({ ...value, ...patch });

  const usgsPorData = ordenarUsgsPorData(value.usgs);
  const posicaoCronologica = (localId: string) =>
    usgsPorData.findIndex((u) => u.localId === localId);

  const setJaFez = (opt: 'sim' | 'nao') => {
    if (opt === 'nao') {
      // Sem USG: a referência só pode ser a DUM (se conhecida).
      onChange({ jaFezUsg: 'nao', usgs: [], referencia: dumDesconhecida ? null : { tipo: 'dum' } });
    } else {
      onChange({
        jaFezUsg: 'sim',
        usgs: value.usgs.length > 0 ? value.usgs : [novaEntry()],
        referencia: value.referencia,
      });
    }
  };

  const updateUsg = (localId: string, patch: Partial<CasoNovoUsgEntry>) =>
    set({ usgs: value.usgs.map((u) => (u.localId === localId ? { ...u, ...patch } : u)) });

  const addUsg = () => set({ usgs: [...value.usgs, novaEntry()] });

  const removeUsg = (localId: string) => {
    const restantes = value.usgs.filter((u) => u.localId !== localId);
    // Se a referência apontava para esta USG, zera (sem default).
    const referencia =
      value.referencia?.tipo === 'usg' && value.referencia.localId === localId
        ? null
        : value.referencia;
    set({ usgs: restantes, referencia });
  };

  const datasDuplicadas = temDatasUsgDuplicadas(value.usgs);

  return (
    <div className="space-y-4">
      {/* Pergunta inicial */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>
            A paciente já fez ultrassonografia(s)? <span className="text-destructive">*</span>
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Registre todas as USGs que a paciente já fez (data do exame + IG do laudo). A mais
              antiga (1ª USG) costuma ser a referência mais confiável para datação.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-3">
          {(['sim', 'nao'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setJaFez(opt)}
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

      {value.jaFezUsg === 'sim' && (
        <div className="rounded-xl border border-[#7C4DBA]/30 bg-[#F8F6FC] p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#7C4DBA]" />
              <h3 className="text-sm font-semibold text-[#5B21B6]">Ultrassonografias da paciente</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addUsg}
              className="gap-1 border-[#7C4DBA] text-[#7C4DBA] hover:bg-[#E8E0FF]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">Adicionar USG</span>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            A numeração segue a data do exame — a <strong>1ª USG é a mais antiga</strong>.
          </p>

          {/* Linhas de USG (mantêm a ordem de digitação; o rótulo 1ª/2ª é por data) */}
          <div className="space-y-3">
            {value.usgs.map((u) => {
              const pos = posicaoCronologica(u.localId);
              const rotulo = u.dataExame ? `${ordinalUsg(pos)} USG` : 'USG (informe a data)';
              return (
                <div key={u.localId} className="rounded-lg border border-border bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#5B21B6]">{rotulo}</span>
                    {value.usgs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeUsg(u.localId)}
                        className="rounded p-1 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                        aria-label="Remover USG"
                        title="Remover USG"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data do exame *</Label>
                      <Input
                        type="date"
                        value={u.dataExame}
                        onChange={(e) => updateUsg(u.localId, { dataExame: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Semanas *</Label>
                      <Input
                        type="number"
                        min={0}
                        max={42}
                        value={u.igSemanas}
                        onChange={(e) => updateUsg(u.localId, { igSemanas: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dias *</Label>
                      <Input
                        type="number"
                        min={0}
                        max={6}
                        value={u.igDias}
                        onChange={(e) => updateUsg(u.localId, { igDias: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {datasDuplicadas && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Há duas USGs com a mesma data. Cada USG precisa de uma data distinta.</span>
            </div>
          )}

          {/* Referência de IG — sem default: escolha obrigatória */}
          <div className="space-y-2 border-t border-[#7C4DBA]/20 pt-3">
            <Label className="text-xs font-medium text-[#5B21B6]">
              Qual referência usar para calcular a IG? <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${
                  value.referencia?.tipo === 'dum' ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
                } ${dumDesconhecida || !dum ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="caso-novo-ref-ig"
                  disabled={dumDesconhecida || !dum}
                  checked={value.referencia?.tipo === 'dum'}
                  onChange={() => set({ referencia: { tipo: 'dum' } })}
                />
                <span>
                  {dum
                    ? `DUM — ${formatDateBR(dum)} - ${formatIgCurto(calcIgHojeFromDum(dum))}`
                    : 'DUM (não informada)'}
                </span>
              </label>

              {usgsPorData.map((u, i) => {
                const completa = !!u.dataExame && u.igSemanas !== '';
                const checked = value.referencia?.tipo === 'usg' && value.referencia.localId === u.localId;
                const igHoje = completa
                  ? calcIgHojeFromUsg({
                      data_exame: u.dataExame,
                      ig_semanas: parseInt(u.igSemanas, 10),
                      ig_dias: parseInt(u.igDias || '0', 10),
                    })
                  : null;
                return (
                  <label
                    key={u.localId}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition ${
                      checked ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
                    } ${!completa ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="caso-novo-ref-ig"
                      disabled={!completa}
                      checked={checked}
                      onChange={() => set({ referencia: { tipo: 'usg', localId: u.localId } })}
                    />
                    <span>
                      {ordinalUsg(i)} USG
                      {u.dataExame ? ` — ${formatDateBR(u.dataExame)}` : ''}
                      {igHoje ? ` - ${formatIgCurto(igHoje)}` : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {dumDesconhecida && value.jaFezUsg === 'nao' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Sem referência de IG definida (sem DUM e sem USG). O cálculo de IG ficará indisponível
            até registrar uma USG.
          </span>
        </div>
      )}
    </div>
  );
}
