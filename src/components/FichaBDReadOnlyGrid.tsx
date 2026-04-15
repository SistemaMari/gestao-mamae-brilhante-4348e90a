const POINTS_6 = ['jejum', 'pos_cafe', 'pre_almoco', 'pos_almoco', 'pre_jantar', 'pos_jantar'] as const;
type Point6 = typeof POINTS_6[number];

const POINT_LABELS_6: Record<Point6, string> = {
  jejum: 'Jejum',
  pos_cafe: '1h pós café',
  pre_almoco: 'Pré-almoço',
  pos_almoco: '1h pós almoço',
  pre_jantar: 'Pré-jantar',
  pos_jantar: '1h pós jantar',
};

const POINT_META_LABELS: Record<Point6, string> = {
  jejum: '< 90',
  pos_cafe: '< 140',
  pre_almoco: '70-100',
  pos_almoco: '< 140',
  pre_jantar: '70-100',
  pos_jantar: '< 140',
};

const IS_PRE_PRANDIAL: Record<Point6, boolean> = {
  jejum: false,
  pos_cafe: false,
  pre_almoco: true,
  pos_almoco: false,
  pre_jantar: true,
  pos_jantar: false,
};

function isWithinMeta(point: Point6, value: number): boolean {
  if (point === 'jejum') return value < 90;
  if (point === 'pre_almoco' || point === 'pre_jantar') return value >= 70 && value <= 100;
  return value < 140;
}

function isHypoglycemia(point: Point6, value: number): boolean {
  return (point === 'pre_almoco' || point === 'pre_jantar') && value > 0 && value < 70;
}

interface FichaBDReadOnlyGridProps {
  gridValores: Record<string, string>[];
}

export default function FichaBDReadOnlyGrid({ gridValores }: FichaBDReadOnlyGridProps) {
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
    if (isHypoglycemia(point, num)) return 'bg-[#FEE2E2]';
    if (!isWithinMeta(point, num)) return 'bg-[#FEE2E2]';
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
                <span className="text-xs font-medium text-foreground">{POINT_LABELS_6[p]}</span>
                <br />
                <span className="text-[10px] text-muted-foreground">{POINT_META_LABELS[p]} mg/dL</span>
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
