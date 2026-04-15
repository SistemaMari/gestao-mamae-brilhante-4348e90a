import { Info } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const POINTS = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
type Point = typeof POINTS[number];

const POINT_LABELS: Record<Point, string> = {
  jejum: 'Jejum',
  pos_cafe: '1h pós café',
  pos_almoco: '1h pós almoço',
  pos_jantar: '1h pós jantar',
};

const POINT_METAS: Record<Point, number> = {
  jejum: 90,
  pos_cafe: 140,
  pos_almoco: 140,
  pos_jantar: 140,
};

interface FichaACReadOnlyGridProps {
  gridValores: Record<string, string>[];
}

export default function FichaACReadOnlyGrid({ gridValores }: FichaACReadOnlyGridProps) {
  // Filter to only show days that have at least one value
  const daysWithData = gridValores
    .map((row, idx) => ({ row, dayNum: idx + 1 }))
    .filter(({ row }) => POINTS.some(p => {
      const v = parseInt(row[p]);
      return !isNaN(v) && v > 0;
    }));

  if (daysWithData.length === 0) return null;

  const getCellBg = (point: Point, value: string) => {
    const num = parseInt(value);
    if (!num || num <= 0) return '';
    if (num >= POINT_METAS[point]) return 'bg-[#FEE2E2]';
    return 'bg-[#DCFCE7]';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border mb-4">
      <table className="w-full min-w-[420px]">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-2 py-2 text-xs font-medium text-foreground text-left w-16">Dia</th>
            {POINTS.map(p => (
              <th key={p} className="px-2 py-2 text-center">
                <span className="text-xs font-medium text-foreground">{POINT_LABELS[p]}</span>
                <br />
                <span className="text-[10px] text-muted-foreground">{'< '}{POINT_METAS[p]} mg/dL</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daysWithData.map(({ row, dayNum }) => (
            <tr key={dayNum} className="border-t border-border">
              <td className="px-2 py-1.5 text-xs font-medium text-foreground">Dia {dayNum}</td>
              {POINTS.map(p => {
                const val = row[p];
                const num = parseInt(val);
                const hasValue = !isNaN(num) && num > 0;
                return (
                  <td key={p} className="px-1 py-1">
                    <div
                      className={`text-center text-sm rounded-md px-1 py-1.5 ${
                        hasValue ? getCellBg(p, val) : ''
                      }`}
                    >
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
