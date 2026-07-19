import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';

/**
 * Card permanente exibido na ficha quando o parto foi registrado
 * (status = resultado_parto). Encerra o acompanhamento da MARI.
 */
export default function EncerramentoPartoCard() {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
            {t('encerramentoParto.title')}
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
            {t('encerramentoParto.body')}
          </p>
        </div>
      </div>

      {/* 38B-B (#22): lembrete de reteste puerperal — conduta acionável, em âmbar */}
      <div className="flex items-start gap-3 rounded-lg border p-3" style={{ backgroundColor: '#F4FF00', borderColor: '#CCD400' }}>
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#3F3F00' }} />
        <p className="text-sm" style={{ color: '#1F1F00' }}>
          <Trans i18nKey="encerramentoParto.reteste" components={{ strong: <strong /> }} />
        </p>
      </div>
    </div>
  );
}
