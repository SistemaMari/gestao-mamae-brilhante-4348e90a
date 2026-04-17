interface Props {
  variante: 'lilas' | 'menta';
  linhas?: number;
}

const TONS = {
  lilas: 'bg-[#E9E5F8]',
  menta: 'bg-[#BBF1DF]',
};

export default function SkeletonShimmer({ variante, linhas = 3 }: Props) {
  const base = TONS[variante];
  const widths = ['w-11/12', 'w-10/12', 'w-8/12'];
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className={`relative h-3 overflow-hidden rounded ${base} ${widths[i % widths.length]}`}
        >
          <div className="laudo-shimmer absolute inset-0" />
        </div>
      ))}
    </div>
  );
}
