import { AlertTriangle } from 'lucide-react';

interface Props {
  titulo: string;
  mensagem: string;
}

/**
 * Placeholder genérico para blocos 2/3 do laudo quando há dados clínicos
 * faltantes (ex: Ficha A salva sem decisão calculada, perfis ausentes, etc).
 *
 * Mesma paleta de alerta clínico do PlaceholderTextoPendente — amarelo com
 * borda lateral âmbar e contraste WCAG AA — para manter consistência visual.
 */
export default function PlaceholderBlocoLaudo({ titulo, mensagem }: Props) {
  return (
    <section
      role="status"
      className="laudo-bloco rounded-xl border border-[#FDE68A] border-l-4 border-l-[#D97706] bg-[#FEF9C3] p-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
        <div className="flex-1">
          <h3 className="font-heading text-sm font-bold text-[#92400E]">{titulo}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#78350F]">{mensagem}</p>
        </div>
      </div>
    </section>
  );
}
