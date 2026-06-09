import { type JanelaPosPrandial, metaPosPrandial, rotuloPosPrandial } from '@/lib/posPrandial';

const POINTS_6 = ['jejum', 'pos_cafe', 'pre_almoco', 'pos_almoco', 'pre_jantar', 'pos_jantar'] as const;
type Point6 = typeof POINTS_6[number];

// 35B — pós-prandiais dependem da janela (1h → < 140, 2h → < 120). Jejum e pré-prandiais inalterados.
const REFEICAO_POS_6: Record<'pos_cafe' | 'pos_almoco' | 'pos_jantar', 'café' | 'almoço' | 'jantar'> = {
  pos_cafe: 'café',
  pos_almoco: 'almoço',
  pos_jantar: 'jantar',
};

function isPosPrandial(point: Point6): point is 'pos_cafe' | 'pos_almoco' | 'pos_jantar' {
  return point === 'pos_cafe' || point === 'pos_almoco' || point === 'pos_jantar';
}

function label6(point: Point6, janela: JanelaPosPrandial): string {
  if (isPosPrandial(point)) return rotuloPosPrandial(REFEICAO_POS_6[point], janela);
  if (point === 'jejum') return 'Jejum';
  return point === 'pre_almoco' ? 'Pré-almoço' : 'Pré-jantar';
}

function metaLabel6(point: Point6, janela: JanelaPosPrandial): string {
  if (isPosPrandial(point)) return `< ${metaPosPrandial(janela)}`;
  if (point === 'jejum') return '< 95';
  return '70-100';
}

const IS_PRE_PRANDIAL: Record<Point6, boolean> = {
  jejum: false,
  pos_cafe: false,
  pre_almoco: true,
  pos_almoco: false,
  pre_jantar: true,
  pos_jantar: false,
};

function isWithinMeta(point: Point6, value: number, janela: JanelaPosPrandial): boolean {
  // Hipoglicemia (< 70) sempre conta como fora da meta, em qualquer ponto
  if (value < 70) return false;
  if (point === 'jejum') return value < 95;
  if (point === 'pre_almoco' || point === 'pre_jantar') return value >= 70 && value <= 100;
  return value < metaPosPrandial(janela);
}

function isHypoglycemia(_point: Point6, value: number): boolean {
  // Em Fichas B/D (paciente em insulina), hipoglicemia (< 70 mg/dL) é relevante em qualquer ponto.
  return value > 0 && value < 70;
}

interface FichaBDReadOnlyGridProps {
  gridValores: Record<string, string>[];
  tipoPosPrandial?: JanelaPosPrandial;
}

export default function FichaBDReadOnlyGrid({ gridValores, tipoPosPrandial = '1h' }: FichaBDReadOnlyGridProps) {
  const daysWithData = gridValores
    .map((row, idx) => ({ row, dayNum: idx + 1 }))
    .filter(({ row }) => POINTS_6.some(p => {
      const v = parseInt(row[p]);
      return !isNaN(v) && v > 0;
    }));

  if (daysWithData.length === 0) return null;

  const getCellBg = (point: Point6, value: string) => {
    const num = parseInt(value);
    if (!num || num <= 0) return '';
    if (isHypoglycemia(point, num)) return 'bg-[#FEE2E2] border border-red-400';
    if (!isWithinMeta(point, num, tipoPosPrandial)) return 'bg-[#FEE2E2]';
    return 'bg-[#DCFCE7]';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border mb-4">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-2 py-2 text-xs font-medium text-foreground text-left w-16">Dia</th>
            {POINTS_6.map(p => (
              <th key={p} className={`px-2 py-2 text-center ${IS_PRE_PRANDIAL[p] ? 'bg-[#E8E0FF]' : ''}`}>
                <span className="text-xs font-medium text-foreground">{label6(p, tipoPosPrandial)}</span>
                <br />
                <span className="text-[10px] text-muted-foreground">{metaLabel6(p, tipoPosPrandial)} mg/dL</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daysWithData.map(({ row, dayNum }) => (
            <tr key={dayNum} className="border-t border-border">
              <td className="px-2 py-1.5 text-xs font-medium text-foreground">Dia {dayNum}</td>
              {POINTS_6.map(p => {
                const val = row[p];
                const num = parseInt(val);
                const hasValue = !isNaN(num) && num > 0;
                return (
                  <td key={p} className={`px-1 py-1 ${IS_PRE_PRANDIAL[p] ? 'bg-[#E8E0FF]/30' : ''}`}>
                    <div className={`text-center text-sm rounded-md px-1 py-1.5 ${hasValue ? getCellBg(p, val) : ''}`}>
                      {hasValue ? num : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
