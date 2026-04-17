/**
 * Grade glicêmica readonly compacta para o laudo.
 * 4 ou 6 pontos × N dias, células coloridas conforme alvo, "—" para vazio.
 */

export interface GradeGlicemicaProps {
  pontos: 4 | 6;
  /** Matriz [dia][ponto] = valor mg/dL ou null */
  valores: (number | null)[][];
  percentual: number;
  diasPreenchidos?: number;
}

const PONTOS_4 = ['Jejum', 'Pós-café', 'Pós-almoço', 'Pós-jantar'];
const PONTOS_6 = ['Jejum', 'Pós-café', 'Pré-almoço', 'Pós-almoço', 'Pré-jantar', 'Pós-jantar'];

// Alvos (mg/dL): jejum/pré ≤95; pós ≤140 (1h) — usaremos pós ≤140 simplificado
function dentroMeta(valor: number, indicePonto: number, pontos: 4 | 6): boolean {
  // Para 4 pontos: idx 0 = jejum (≤95); demais = pós (≤140)
  // Para 6 pontos: idx 0 = jejum, 2 = pré-almoço, 4 = pré-jantar (todos ≤95); demais pós (≤140)
  if (pontos === 4) {
    return indicePonto === 0 ? valor <= 95 : valor <= 140;
  }
  const eJejumOuPre = indicePonto === 0 || indicePonto === 2 || indicePonto === 4;
  return eJejumOuPre ? valor <= 95 : valor <= 140;
}

export default function GradeGlicemicaCompacta({ pontos, valores, percentual, diasPreenchidos }: GradeGlicemicaProps) {
  const labels = pontos === 4 ? PONTOS_4 : PONTOS_6;
  const dias = valores.length;
  const adequado = percentual >= 70;

  return (
    <section className="laudo-grade rounded-xl border border-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold text-foreground">
          Perfil glicêmico ({pontos} pontos × {dias} dias)
        </h3>
        {diasPreenchidos !== undefined && (
          <span className="text-[10px] text-muted-foreground">
            {diasPreenchidos}/{dias} dias preenchidos
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-border bg-muted px-1.5 py-1 text-left font-semibold text-foreground">Dia</th>
              {labels.map((l) => (
                <th key={l} className="border border-border bg-muted px-1.5 py-1 text-center font-semibold text-foreground">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valores.map((linha, idxDia) => (
              <tr key={idxDia}>
                <td className="border border-border bg-muted/50 px-1.5 py-1 text-center font-medium text-foreground">
                  {idxDia + 1}
                </td>
                {linha.map((v, idxPonto) => {
                  if (v == null) {
                    return (
                      <td key={idxPonto} className="border border-border bg-white px-1.5 py-1 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  }
                  const ok = dentroMeta(v, idxPonto, pontos);
                  return (
                    <td
                      key={idxPonto}
                      className={`border border-border px-1.5 py-1 text-center font-medium ${
                        ok ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Dentro da meta</span>
        <span className={`font-semibold ${adequado ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
          {percentual}% — {adequado ? 'controle adequado' : 'controle inadequado'}
        </span>
      </div>
    </section>
  );
}
