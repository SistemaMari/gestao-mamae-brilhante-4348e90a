import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { todayLocalISO, validarDataClinica } from '@/lib/dateUtils';
import {
  MOTIVO_ENCERRAMENTO_LABEL,
  MOTIVOS_MANUAIS,
  motivoExigeData,
  motivoExigeObs,
  type MotivoEncerramento,
} from '@/lib/motivoEncerramento';

/**
 * PROMPT 42E — Modal de encerramento manual do acompanhamento.
 *
 * Seleciona o motivo (parto/aborto/nao_retornou/outro) e o campo obrigatório
 * correspondente (data para parto/aborto; texto livre para outro). O botão
 * Confirmar só habilita quando o campo obrigatório do motivo está válido.
 * A escrita em `pacientes` fica no parent (padrão de update direto da ficha).
 */

export interface EncerramentoPayload {
  motivo: MotivoEncerramento;
  data: string | null;
  obs: string | null;
}

interface Props {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: EncerramentoPayload) => void;
}

export default function EncerrarAcompanhamentoModal({
  open, submitting = false, onClose, onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [motivo, setMotivo] = useState<MotivoEncerramento | ''>('');
  const [data, setData] = useState('');
  const [obs, setObs] = useState('');

  // Reset ao (re)abrir — evita carregar seleção anterior.
  useEffect(() => {
    if (open) { setMotivo(''); setData(''); setObs(''); }
  }, [open]);

  const hoje = useMemo(() => todayLocalISO(), []);

  const dataValida = useMemo(() => {
    if (!data) return false;
    if (!validarDataClinica(data).valida) return false;
    return data <= hoje; // não futura
  }, [data, hoje]);

  const podeConfirmar = useMemo(() => {
    if (!motivo) return false;
    if (motivoExigeData(motivo) && !dataValida) return false;
    if (motivoExigeObs(motivo) && !obs.trim()) return false;
    return true;
  }, [motivo, dataValida, obs]);

  function handleConfirm() {
    if (!motivo || !podeConfirmar || submitting) return;
    onConfirm({
      motivo,
      data: motivoExigeData(motivo) ? data : null,
      obs: motivoExigeObs(motivo) ? obs.trim() : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">
            {t('encerrarAcompanhamento.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('encerrarAcompanhamento.intro')}
          </p>

          <RadioGroup
            value={motivo}
            onValueChange={(v) => setMotivo(v as MotivoEncerramento)}
          >
            {MOTIVOS_MANUAIS.map((m) => (
              <div key={m} className="flex items-start gap-2">
                <RadioGroupItem value={m} id={`motivo-${m}`} className="mt-1" />
                <Label htmlFor={`motivo-${m}`} className="font-normal">
                  {MOTIVO_ENCERRAMENTO_LABEL[m]}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {motivo && motivoExigeData(motivo) && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-data">
                {motivo === 'parto'
                  ? t('encerrarAcompanhamento.dateLabelParto')
                  : t('encerrarAcompanhamento.dateLabelAborto')}
              </Label>
              <Input
                id="enc-data"
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value)}
                disabled={submitting}
              />
              {data && !dataValida && (
                <p className="text-xs text-[#DC2626]">
                  {t('encerrarAcompanhamento.invalidDate')}
                </p>
              )}
            </div>
          )}

          {motivo && motivoExigeObs(motivo) && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-obs">{t('encerrarAcompanhamento.obsLabel')}</Label>
              <Textarea
                id="enc-obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder={t('encerrarAcompanhamento.obsPlaceholder')}
                rows={3}
                disabled={submitting}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!podeConfirmar || submitting}
            className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('encerrarAcompanhamento.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
