import { ArrowRight } from 'lucide-react';

interface Props {
  texto: string;
}

export default function ProximaFichaCard({ texto }: Props) {
  return (
    <section className="laudo-proxima rounded-xl border border-[#D6BCFA] bg-[#E8E0FF] p-3">
      <div className="flex items-start gap-2">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
        <div>
          <p className="text-xs font-semibold text-[#5B21B6]">Próxima ficha</p>
          <p className="mt-0.5 text-xs text-[#6D28D9]">{texto}</p>
        </div>
      </div>
    </section>
  );
}
