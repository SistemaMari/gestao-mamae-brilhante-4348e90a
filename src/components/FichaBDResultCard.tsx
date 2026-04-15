import { FileText, Printer } from 'lucide-react';

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
  percentual, adequado, totalPreenchidos, dentroMeta,
  retornoDias, dataProximoRetorno, fichaType, hypoCount,
}: FichaBDResultCardProps) {
  if (adequado) {
    return (
      <div className="space-y-4">
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

          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-sm font-semibold" style={{ color: '#166534' }}>Conduta</p>
            <p className="mt-1 text-xs" style={{ color: '#15803D' }}>
              Manter dose atual de insulina. Próximo retorno em {retornoDias} dias com perfil glicêmico de 6 pontos.
            </p>
          </div>

          {(hypoCount ?? 0) > 0 && (
            <div className="rounded-lg bg-white/70 border border-amber-300 p-3">
              <p className="text-xs text-amber-800 font-medium">
                Atenção: {hypoCount} episódio(s) de hipoglicemia registrado(s). Avaliar necessidade de ajuste de dose com o endocrinologista.
              </p>
            </div>
          )}

          {dataProximoRetorno && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="text-sm font-semibold" style={{ color: '#166534' }}>Próximo retorno sugerido</p>
              <p className="mt-1 text-xs" style={{ color: '#15803D' }}>
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
            <li>Metas: jejum {'<'} 90 mg/dL; pós-prandiais (1h) {'<'} 140 mg/dL; pré-prandiais 70-100 mg/dL.</li>
            <li>Controle adequado (≥ 70%): manter dose atual de insulina. Controle inadequado ({'<'} 70%): encaminhar para endocrinologista.</li>
            <li>Valores pré-prandiais abaixo de 70 mg/dL indicam hipoglicemia — avaliar com endocrinologista.</li>
          </ul>
        </div>

        {/* Ctrl+P */}
        <div className="rounded-xl border border-dashed border-[#D6BCFA] bg-[#F1F0FB] p-4 text-center print:hidden">
          <p className="text-xs text-[#7E69AB] flex items-center justify-center gap-2">
            <Printer className="h-4 w-4" />
            Para salvar ou imprimir este resultado, pressione <strong>Ctrl+P</strong> (Windows) ou <strong>Cmd+P</strong> (Mac).
          </p>
        </div>
      </div>
    );
  }

  // Inadequado — Cenário 7
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }}>
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#991B1B' }}>
          <FileText className="h-4 w-4" />
          CONTROLE INADEQUADO COM INSULINA — {percentual.toFixed(1)}% das glicemias dentro da meta
        </h2>

        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Resultado</p>
          <p className="mt-1 text-xs" style={{ color: '#B91C1C' }}>
            {dentroMeta} de {totalPreenchidos} valores dentro da meta ({percentual.toFixed(1)}%).
          </p>
        </div>

        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>
            A Dra. Mari Diagnóstica se encerra aqui para esta paciente.
          </p>
          <p className="text-xs" style={{ color: '#B91C1C' }}>
            A dose de insulina precisa ser ajustada, o que requer acompanhamento conjunto com endocrinologista.
          </p>
        </div>

        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Orientação ao profissional</p>
          <ul className="list-disc pl-4 text-xs space-y-1" style={{ color: '#B91C1C' }}>
            <li>Associar endocrinologista para gestão da insulinoterapia.</li>
            <li>O obstetra MANTÉM a condução do pré-natal — nunca delegar inteiramente ao endocrinologista.</li>
            <li>As metas de controle glicêmico devem ser as obstétricas (jejum {'<'} 90, 1h {'<'} 140) — não as metas de DM fora da gravidez.</li>
            <li>O endocrinologista não conduz o caso sozinho. É uma associação GO + endocrinologista para cuidar da paciente e do bebê.</li>
          </ul>
        </div>

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
          <li>Metas: jejum {'<'} 90 mg/dL; pós-prandiais (1h) {'<'} 140 mg/dL; pré-prandiais 70-100 mg/dL.</li>
          <li>Controle inadequado com insulina: a Dra. Mari se encerra. Acompanhamento GO + endocrinologista.</li>
          <li>Valores pré-prandiais abaixo de 70 mg/dL indicam hipoglicemia — avaliar com endocrinologista.</li>
        </ul>
      </div>

      {/* Ctrl+P */}
      <div className="rounded-xl border border-dashed border-[#D6BCFA] bg-[#F1F0FB] p-4 text-center print:hidden">
        <p className="text-xs text-[#7E69AB] flex items-center justify-center gap-2">
          <Printer className="h-4 w-4" />
          Para salvar ou imprimir este resultado, pressione <strong>Ctrl+P</strong> (Windows) ou <strong>Cmd+P</strong> (Mac).
        </p>
      </div>
    </div>
  );
}
