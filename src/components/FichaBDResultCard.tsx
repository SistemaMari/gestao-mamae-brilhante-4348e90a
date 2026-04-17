import { FileText } from 'lucide-react';

interface FichaBDResultCardProps {
  percentual: number;
  adequado: boolean;
  totalPreenchidos: number;
  dentroMeta: number;
  retornoDias: number;
  dataProximoRetorno?: string | null;
  fichaType: string;
  hypoCount?: number;
}

export default function FichaBDResultCard({
  percentual, adequado, totalPreenchidos, dentroMeta, hypoCount,
}: FichaBDResultCardProps) {
  if (adequado) {
    return (
      <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }}>
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#166534' }}>
          <FileText className="h-4 w-4" />
          CONTROLE ADEQUADO COM INSULINA — {percentual.toFixed(1)}% das glicemias dentro da meta
        </h2>

        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: '#166534' }}>Resultado</p>
          <p className="mt-1 text-xs" style={{ color: '#15803D' }}>
            {dentroMeta} de {totalPreenchidos} valores dentro da meta ({percentual.toFixed(1)}%).
          </p>
        </div>

        {(hypoCount ?? 0) > 0 && (
          <div className="rounded-lg bg-white/70 border border-amber-300 p-3">
            <p className="text-xs text-amber-800 font-medium">
              Atenção: {hypoCount} episódio(s) de hipoglicemia registrado(s).
            </p>
          </div>
        )}
      </div>
    );
  }

  // Inadequado — encerramento (acompanhamento conduzido pelo GO + endocrino associado)
  return (
    <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
      <h2 className="text-base font-bold" style={{ color: '#991B1B' }}>
        Acompanhamento da MARI encerrado para esta paciente
      </h2>

      <div className="rounded-lg bg-white/70 p-3">
        <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Resultado</p>
        <p className="mt-1 text-xs" style={{ color: '#B91C1C' }}>
          {dentroMeta} de {totalPreenchidos} valores dentro da meta ({percentual.toFixed(1)}%).
        </p>
      </div>
    </div>
  );
}
