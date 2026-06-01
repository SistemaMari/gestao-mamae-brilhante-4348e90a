import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Campo `blocos_faltantes` da resposta. `['*']` = todos os blocos. */
  blocosFaltantes: string[];
}

/**
 * Placeholder de "Texto pendente" (34D-B §3.3).
 *
 * Exibido no lugar dos blocos textuais sempre que `obter-textos-laudo` retorna
 * completo=false — estado de transição em que o time clínico ainda não publicou
 * os textos oficiais. Por decisão clínica, NÃO há texto fictício de fallback.
 *
 * Paleta de alerta clínico (amarelo) com borda lateral saturada e contraste
 * WCAG AA (texto âmbar escuro sobre fundo amarelo claro).
 */
export default function PlaceholderTextoPendente({ blocosFaltantes }: Props) {
  const todos = blocosFaltantes.length === 0 || blocosFaltantes.includes('*');

  return (
    <section
      role="status"
      className="laudo-bloco rounded-xl border border-[#FDE68A] border-l-4 border-l-[#D97706] bg-[#FEF9C3] p-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
        <div className="flex-1">
          <h3 className="font-heading text-sm font-bold text-[#92400E]">
            Texto pendente — solicitar ao time clínico
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#78350F]">
            Os textos descritivos deste laudo ainda não foram publicados pelo time clínico. A geração
            do PDF está temporariamente bloqueada até a entrega dos textos oficiais.
          </p>

          <div className="mt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#92400E]">
              Blocos pendentes
            </p>
            {todos ? (
              <p className="mt-0.5 text-xs text-[#78350F]">Todos os blocos.</p>
            ) : (
              <ul className="mt-0.5 list-disc pl-5 text-xs text-[#78350F]">
                {blocosFaltantes.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
