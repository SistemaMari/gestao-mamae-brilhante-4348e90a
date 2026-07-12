import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  /** 36B-FIX1: o card só exibe peso/dose/insulina quando o MOTOR de decisão
   *  resolve para um desfecho de insulina (proxima_ficha b/d). Nunca recalcula
   *  conduta por percentual. Para o galho de reforço de MEV, fica false. */
  condutaInsulina: boolean;
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
  isReadOnly?: boolean;
  onWeightSaved?: () => void;
}

export default function FichaACResultCard({
  percentual, adequado, condutaInsulina, totalPreenchidos, dentroMeta,
  peso, doseTotal, doseManha, doseNoite,
  pacienteId, consultaId, isPreview, isReadOnly, onWeightSaved,
}: FichaACResultCardProps) {
  const { t } = useTranslation();
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

  // 36B-FIX1: peso/dose só quando o MOTOR resolveu para insulina — nunca por percentual.
  const needsWeight = condutaInsulina && (peso == null || peso <= 0) && !isReadOnly;
  const hasWeight = condutaInsulina && peso != null && peso > 0 && doseTotal != null;

  const handleConfirmWeight = async () => {
    if (pesoNum <= 0 || !calcDoseTotal || !pacienteId || !consultaId) return;
    setSaving(true);

    if (isPreview) {
      const p = getPreviewPacienteById(pacienteId);
      if (!p) {
        toast.error(t('fichaACResult.patientNotFound'));
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
      toast.success(t('fichaACResult.weightConfirmed'));
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
      toast.success(t('fichaACResult.weightConfirmed'));
      setSaving(false);
      onWeightSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error(t('fichaACResult.weightSaveError', { error: err?.message || t('fichaACResult.unknownError') }));
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
            ? t('fichaACResult.controlAdequate', { percent: percentual.toFixed(1) })
            : t('fichaACResult.controlInadequate', { percent: percentual.toFixed(1) })}
        </h2>

        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: titleColor }}>
            {t('fichaACResult.result')}
          </p>
          <p className="mt-1 text-xs" style={{ color: textColor }}>
            {t('fichaACResult.valuesInTarget', { within: dentroMeta, total: totalPreenchidos, percent: percentual.toFixed(1) })}
          </p>
          <p className="mt-2 text-xs italic" style={{ color: textColor }}>
            {adequado
              ? t('fichaACResult.guidanceAdequate')
              : condutaInsulina
                ? t('fichaACResult.guidanceInsulin')
                : t('fichaACResult.guidanceMev')}
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
                {t('fichaACResult.weightPromptTitle')}
              </p>
              <p className="text-xs text-amber-700">
                {t('fichaACResult.weightPromptDesc')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-amber-900">
                  {t('fichaACResult.currentWeightKg')} <span className="text-red-600">*</span>
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-amber-700 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{t('fichaACResult.weightTooltip')}</p>
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
                onBlur={() => { if (pesoNum > 0 && !saving) handleConfirmWeight(); }}
                placeholder={t('fichaACResult.weightPlaceholder')}
                className="w-32 bg-white"
              />
              {saving && (
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t('common.saving')}
                </p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Destaque da dose inicial — preview ao vivo OU dose persistida */}
      {(() => {
        const showLive = needsWeight && calcDoseTotal && pesoNum > 0;
        const showSaved = hasWeight;
        if (!showLive && !showSaved) return null;

        const dTotal = showSaved ? doseTotal! : calcDoseTotal!;
        const dManha = showSaved ? doseManha : calcDoseManha;
        const dNoite = showSaved ? doseNoite : calcDoseNoite;
        const pesoShow = showSaved ? peso : pesoNum;

        return (
          <div className="rounded-xl border-2 border-primary/30 bg-primary/10 p-5 space-y-2">
            <p className="text-sm font-semibold text-[#7E69AB] uppercase tracking-wide">
              {t('fichaACResult.initialNphDose')}
            </p>
            <p className="font-heading text-4xl font-bold leading-none text-[#7E69AB]">
              {dTotal}
              <span className="ml-1 text-base font-medium opacity-80">{t('fichaACResult.uiPerDay')}</span>
            </p>
            {dManha != null && dNoite != null && (
              <p className="text-sm text-[#7E69AB]">
                {t('fichaACResult.doseSplit', { morning: dManha, night: dNoite })}
              </p>
            )}
            <p className="text-xs text-[#7E69AB]/80">
              {t('fichaACResult.weightFormula', { weight: pesoShow })}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
