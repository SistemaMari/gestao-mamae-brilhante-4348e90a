import { FileText, Printer } from 'lucide-react';

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
  retornoDias, dataProximoRetorno, fichaType,
}: FichaACResultCardProps) {
  const bgColor = adequado ? '#DCFCE7' : '#FEF3C7';
  const borderColor = adequado ? '#86EFAC' : '#FCD34D';
  const titleColor = adequado ? '#166534' : '#92400E';
  const textColor = adequado ? '#15803D' : '#B45309';

  return (
    <div className="space-y-4">
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

        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: titleColor }}>
            Conduta
          </p>
          {adequado ? (
            <p className="mt-1 text-xs" style={{ color: textColor }}>
              Manter dieta e atividade física. Próximo retorno em {retornoDias} dias com perfil glicêmico de 4 pontos.
            </p>
          ) : (
            <div className="mt-1 space-y-2">
              <p className="text-xs" style={{ color: textColor }}>
                Associar insulina NPH subcutânea. Próximo retorno em {retornoDias} dias com perfil glicêmico de 6 pontos (inclui pré-prandiais).
              </p>
              {doseTotal && peso && (
                <p className="text-xs font-semibold" style={{ color: titleColor }}>
                  Dose inicial de insulina NPH: {doseTotal} UI/dia (0,5 UI/kg/dia × {peso} kg), distribuída em 2-3 tomadas: {doseManha} UI pela manhã (ao acordar) e {doseNoite} UI às 22h.
                </p>
              )}
            </div>
          )}
        </div>

        {dataProximoRetorno && (
          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-sm font-semibold" style={{ color: titleColor }}>
              Próximo retorno sugerido
            </p>
            <p className="mt-1 text-xs" style={{ color: textColor }}>
              {dataProximoRetorno} ({retornoDias} dias)
            </p>
          </div>
        )}

        {/* Placeholder Blocos 2 e 3 */}
        <div className="rounded-lg border-2 border-dashed border-[#CBD5E1] bg-[#F1F5F9] p-5 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Justificativa científica e conduta personalizada
          </p>
          <p className="text-xs text-muted-foreground italic">
            Estes blocos serão gerados automaticamente pelo sistema de inteligência artificial em breve.
          </p>
        </div>
      </div>

      {/* Technical notes */}
      <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
        <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
          <li>O percentual de controle considera apenas os campos preenchidos — dias sem medição não penalizam o resultado.</li>
          <li>Metas: jejum {'<'} 90 mg/dL; pós-prandiais (1h) {'<'} 140 mg/dL.</li>
          <li>Controle adequado (≥ 70%): manter dieta + atividade física. Controle inadequado ({'<'} 70%): associar insulina NPH.</li>
          <li>A dose padrão de insulina NPH é 0,5 UI/kg/dia, distribuída em 2-3 tomadas (2/3 manhã + 1/3 às 22h).</li>
        </ul>
      </div>

      {/* Ctrl+P instruction */}
      <div className="rounded-xl border border-dashed border-[#D6BCFA] bg-[#F1F0FB] p-4 text-center print:hidden">
        <p className="text-xs text-[#7E69AB] flex items-center justify-center gap-2">
          <Printer className="h-4 w-4" />
          Para salvar ou imprimir este resultado, pressione <strong>Ctrl+P</strong> (Windows) ou <strong>Cmd+P</strong> (Mac).
        </p>
      </div>
    </div>
  );
}
