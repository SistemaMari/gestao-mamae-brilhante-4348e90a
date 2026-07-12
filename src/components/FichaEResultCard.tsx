/**
 * 36E-B — Result card da Ficha E.
 *  - manter_e (controle adequado): card verde, permanece na Ficha E, 7-10 dias, sem insulina.
 *  - insulina (controle inadequado): delega para FichaACResultCard (peso → dose 0,5 UI/kg/dia).
 */
import { FileText } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import FichaACResultCard from './FichaACResultCard';

interface FichaEResultCardProps {
  percentual: number;
  adequado: boolean;
  totalPreenchidos: number;
  dentroMeta: number;
  doseTotal?: number | null;
  doseManha?: number | null;
  doseNoite?: number | null;
  peso?: number | null;
  igSemanas?: number | null;
  pacienteId?: string;
  consultaId?: string;
  isPreview?: boolean;
  isReadOnly?: boolean;
  onWeightSaved?: () => void;
}

export default function FichaEResultCard({
  percentual, adequado, totalPreenchidos, dentroMeta,
  doseTotal, doseManha, doseNoite, peso, igSemanas,
  pacienteId, consultaId, isPreview, isReadOnly, onWeightSaved,
}: FichaEResultCardProps) {
  const { t } = useTranslation();
  if (!adequado) {
    // Reaproveita o card de A/C: tela de cálculo de dose OBRIGATÓRIA (peso → 0,5 UI/kg/dia).
    return (
      <div className="space-y-3">
        <FichaACResultCard
          percentual={percentual}
          adequado={false}
          condutaInsulina={true}
          totalPreenchidos={totalPreenchidos}
          dentroMeta={dentroMeta}
          doseTotal={doseTotal}
          doseManha={doseManha}
          doseNoite={doseNoite}
          peso={peso}
          retornoDias={(igSemanas ?? 0) > 30 ? 7 : 15}
          fichaType="ficha_e"
          pacienteId={pacienteId}
          consultaId={consultaId}
          isPreview={isPreview}
          isReadOnly={isReadOnly}
          onWeightSaved={onWeightSaved}
        />
        <div className="rounded-lg border border-[#D6BCFA] bg-[#F1F0FB] p-3 text-xs text-[#5B21B6]">
          <Trans
            i18nKey="fichaEResultCard.openNextFicha"
            values={{ ficha: (igSemanas ?? 0) > 30 ? 'D' : 'B' }}
            components={{ strong: <strong /> }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border-2 p-5 space-y-4"
      style={{ backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }}
    >
      <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#166534' }}>
        <FileText className="h-4 w-4" />
        {t('fichaEResultCard.controleAdequadoTitle', { percentual: percentual.toFixed(1) })}
      </h2>
      <div className="rounded-lg bg-white/70 p-3 space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#166534' }}>{t('fichaEResultCard.condutaLabel')}</p>
        <p className="text-xs" style={{ color: '#15803D' }}>
          {t('fichaEResultCard.condutaText')}
        </p>
        <p className="text-xs" style={{ color: '#15803D' }}>
          {t('fichaEResultCard.dentroMetaSummary', { dentroMeta, totalPreenchidos, percentual: percentual.toFixed(1) })}
        </p>
      </div>
    </div>
  );
}
