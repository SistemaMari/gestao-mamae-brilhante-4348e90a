import { useState } from 'react';
import { FileText, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreviewPacienteById,
  updatePreviewPaciente,
} from '@/lib/previewPatients';

interface FichaACResultCardProps {
  percentual: number;
  adequado: boolean;
  totalPreenchidos: number;
  dentroMeta: number;
  doseTotal?: number | null;
  doseManha?: number | null;
  doseNoite?: number | null;
  peso?: number | null;
  retornoDias: number;
  dataProximoRetorno?: string | null;
  fichaType: string;
  /** Necessários para persistir o peso/dose após o Bloco 1 (Fichas A/C com controle inadequado) */
  pacienteId?: string;
  consultaId?: string;
  isPreview?: boolean;
  onWeightSaved?: () => void;
}

export default function FichaACResultCard({
  percentual, adequado, totalPreenchidos, dentroMeta,
  peso, doseTotal, doseManha, doseNoite,
  pacienteId, consultaId, isPreview, onWeightSaved,
}: FichaACResultCardProps) {
  const bgColor = adequado ? '#DCFCE7' : '#FEF3C7';
  const borderColor = adequado ? '#86EFAC' : '#FCD34D';
  const titleColor = adequado ? '#166534' : '#92400E';
  const textColor = adequado ? '#15803D' : '#B45309';

  // Estado local para captura de peso (apenas quando inadequado e ainda sem peso registrado)
  const [pesoInput, setPesoInput] = useState('');
  const [saving, setSaving] = useState(false);

  const pesoNum = parseFloat(pesoInput) || 0;
  const calcDoseTotal = pesoNum > 0 ? Math.round(0.5 * pesoNum * 10) / 10 : null;
  const calcDoseManha = calcDoseTotal ? Math.round((calcDoseTotal * 2 / 3) * 10) / 10 : null;
  const calcDoseNoite = calcDoseTotal ? Math.round((calcDoseTotal * 1 / 3) * 10) / 10 : null;

  const needsWeight = !adequado && (peso == null || peso <= 0);
  const hasWeight = !adequado && peso != null && peso > 0 && doseTotal != null;

  const handleConfirmWeight = async () => {
    if (pesoNum <= 0 || !calcDoseTotal || !pacienteId || !consultaId) return;
    setSaving(true);

    if (isPreview) {
      const p = getPreviewPacienteById(pacienteId);
      if (!p) {
        toast.error('Paciente não encontrada.');
        setSaving(false);
        return;
      }
      const updatedConsultas = (p.consultas || []).map(c =>
        c.id === consultaId
          ? {
              ...c,
              peso_kg: pesoNum,
              dose_total: calcDoseTotal,
              dose_manha: calcDoseManha,
              dose_noite: calcDoseNoite,
            }
          : c
      );
      updatePreviewPaciente(pacienteId, { consultas: updatedConsultas });
      window.dispatchEvent(new Event('preview-pacientes-updated'));
      toast.success('Peso confirmado. Dose calculada.');
      setSaving(false);
      onWeightSaved?.();
      return;
    }

    // Real mode — atualiza perfil_glicemico vinculado à consulta
    try {
      const { error: perfErr } = await supabase
        .from('perfis_glicemicos' as any)
        .update({
          peso_paciente_kg: pesoNum,
          dose_insulina_calculada: calcDoseTotal,
        })
        .eq('consulta_id', consultaId);
      if (perfErr) throw perfErr;
      toast.success('Peso confirmado. Dose calculada.');
      setSaving(false);
      onWeightSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar peso: ' + (err?.message || 'Erro desconhecido'));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 p-5 space-y-4"
        style={{ backgroundColor: bgColor, borderColor }}
      >
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: titleColor }}>
          <FileText className="h-4 w-4" />
          {adequado
            ? `CONTROLE ADEQUADO — ${percentual.toFixed(1)}% das glicemias dentro da meta`
            : `CONTROLE INADEQUADO — ${percentual.toFixed(1)}% das glicemias dentro da meta`}
        </h2>

        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: titleColor }}>
            Resultado
          </p>
          <p className="mt-1 text-xs" style={{ color: textColor }}>
            {dentroMeta} de {totalPreenchidos} valores dentro da meta ({percentual.toFixed(1)}%).
          </p>
          <p className="mt-2 text-xs italic" style={{ color: textColor }}>
            {adequado
              ? 'Orientações no laudo completo abaixo.'
              : 'Conduta: iniciar insulina. Dose e orientações no laudo completo abaixo.'}
          </p>
        </div>
      </div>

      {/* Captura de peso — só aparece quando inadequado E ainda sem peso registrado */}
      {needsWeight && pacienteId && consultaId && (
        <div className="rounded-xl border-2 border-[#F59E0B] bg-[#FEF3C7] p-4 space-y-3 no-print">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#F59E0B]" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-800">
                Controle glicêmico abaixo da meta — informe o peso para calcular a dose
              </p>
              <p className="text-xs text-amber-700">
                A conduta indicada pelo protocolo é associar insulina NPH subcutânea. Informe o peso atual da paciente para que o sistema calcule a dose inicial e libere os Blocos 2 e 3 do laudo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-amber-900">
                  Peso atual (kg) <span className="text-red-600">*</span>
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-amber-700 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">O peso é necessário para calcular a dose inicial padrão de insulina: 0,5 UI/kg/dia. Essa dose é padronizada mundialmente para início de insulinoterapia em DMG. Ex: paciente de 70 kg → 35 UI/dia em 2-3 tomadas.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={pesoInput}
                onChange={e => setPesoInput(e.target.value)}
                placeholder="Ex: 70"
                className="w-32 bg-white"
              />
            </div>

            {calcDoseTotal && pesoNum > 0 && (
              <div className="rounded-lg bg-white/80 border border-[#F59E0B] px-3 py-2 text-xs space-y-0.5">
                <p className="font-semibold text-amber-800">
                  Dose calculada: {calcDoseTotal} UI/dia
                </p>
                <p className="text-amber-700">
                  {calcDoseManha} UI manhã + {calcDoseNoite} UI 22h
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleConfirmWeight}
            disabled={pesoNum <= 0 || saving}
            className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar peso e gerar laudo
          </Button>
        </div>
      )}

      {/* Resumo de peso/dose já confirmados — visível inclusive na impressão */}
      {hasWeight && (
        <div className="rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-800">
            Peso registrado: {peso} kg — dose inicial de NPH: {doseTotal} UI/dia (0,5 UI/kg/dia)
          </p>
          {doseManha != null && doseNoite != null && (
            <p className="text-xs text-amber-700">
              Distribuição: {doseManha} UI pela manhã (ao acordar) e {doseNoite} UI às 22h.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
