/**
 * 36E-B — Result card da Ficha E.
 *  - manter_e (controle adequado): card verde, permanece na Ficha E, 7-10 dias, sem insulina.
 *  - insulina (controle inadequado): delega para FichaACResultCard (peso → dose 0,5 UI/kg/dia).
 */
import { FileText } from 'lucide-react';
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
          Após confirmar o peso e a dose, abra a <strong>Ficha {(igSemanas ?? 0) > 30 ? 'D' : 'B'}</strong> pelo botão "+ Nova consulta".
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
        CONTROLE ADEQUADO — {percentual.toFixed(1)}% das glicemias dentro da meta
      </h2>
      <div className="rounded-lg bg-white/70 p-3 space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#166534' }}>Conduta</p>
        <p className="text-xs" style={{ color: '#15803D' }}>
          Manter dieta e exercício, perfil de 6 pontos, reavaliar em 7-10 dias.
          Sem insulina. Permanece na Ficha E.
        </p>
        <p className="text-xs" style={{ color: '#15803D' }}>
          {dentroMeta} de {totalPreenchidos} valores dentro da meta ({percentual.toFixed(1)}%).
        </p>
      </div>
    </div>
  );
}
