import { AlertCircle } from 'lucide-react';

/**
 * CamposPendentesBanner — banner amarelo claro no topo da ficha quando
 * `status_ficha === 'rascunho'` E há campos obrigatórios pendentes
 * (Prompt 34B seção 3.1.3).
 *
 * Características:
 *   - A lista é passada pelo caller, calculada localmente em tempo real.
 *   - Banner some quando lista vazia OU quando status não é mais rascunho.
 *   - Texto fixo: "Esta ficha está em rascunho. Campos pendentes: [lista]"
 *
 * Não chama backend. Não duplica validação — quem define a lista é o form
 * dono dos campos (mesma fonte de verdade usada para habilitar o botão
 * "Salvar e finalizar").
 */

interface Props {
  /** Lista de rótulos dos campos pendentes. Banner some quando vazia. */
  pendentes: string[];
  /** Quando false, banner não renderiza (typicamente status !== 'rascunho'). */
  ativo: boolean;
  className?: string;
}

export default function CamposPendentesBanner({ pendentes, ativo, className = '' }: Props) {
  if (!ativo) return null;
  if (pendentes.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <div className="space-y-1 text-xs text-amber-900">
        <p className="font-semibold">
          Esta ficha está em rascunho. Campos pendentes:
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {pendentes.map((campo) => (
            <li key={campo}>{campo}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
