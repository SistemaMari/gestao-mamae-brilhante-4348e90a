import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Consulta1ResultCardProps {
  /** Mantidas por compatibilidade — não são mais usadas neste card. */
  janelaGTT?: { inicio: Date; fim: Date } | null;
  igMaior24?: boolean;
}

export default function Consulta1ResultCard(_props: Consulta1ResultCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
      <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {t('consulta1Result.title')}
      </h2>

      <div className="rounded-lg bg-white/70 p-3">
        <p className="text-sm font-semibold text-emerald-900">{t('consulta1Result.orientationTitle')}</p>
        <p className="mt-1 text-xs text-emerald-800">
          {t('consulta1Result.orientationBody')}
        </p>
      </div>
    </div>
  );
}
