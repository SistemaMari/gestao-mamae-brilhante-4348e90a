import { FileText } from 'lucide-react';

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
}

export default function FichaACResultCard({
  percentual, adequado, totalPreenchidos, dentroMeta,
  doseTotal, doseManha, doseNoite, peso,
}: FichaACResultCardProps) {
  const bgColor = adequado ? '#DCFCE7' : '#FEF3C7';
  const borderColor = adequado ? '#86EFAC' : '#FCD34D';
  const titleColor = adequado ? '#166534' : '#92400E';
  const textColor = adequado ? '#15803D' : '#B45309';

  return (
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
      </div>

      {!adequado && doseTotal && peso && (
        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: titleColor }}>
            Dose inicial de insulina NPH
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: titleColor }}>
            {doseTotal} UI/dia (0,5 UI/kg/dia × {peso} kg), distribuída em 2-3 tomadas: {doseManha} UI pela manhã (ao acordar) e {doseNoite} UI às 22h.
          </p>
        </div>
      )}
    </div>
  );
}
