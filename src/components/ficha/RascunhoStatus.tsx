import { Cloud, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Indicador visual do estado de salvamento da ficha (Prompt 34B seção 3.4).
 *
 * Estados:
 *   - 'idle'              → não renderiza nada (form intocado, sem rascunho)
 *   - 'local'             → "Rascunho salvo localmente às HH:MM" (cinza, ícone nuvem)
 *   - 'servidor'          → "Rascunho salvo no servidor às HH:MM" (verde, ícone check)
 *   - 'dirty'             → "Alterações não salvas (último save: HH:MM)" (amarelo, alerta)
 *   - 'salvando'          → "Salvando..." (cinza, spinner)
 *   - 'erro'              → "Erro ao salvar — verificar conexão" (vermelho, ícone X + botão)
 */

export type RascunhoVisualState =
  | 'idle'
  | 'local'
  | 'servidor'
  | 'dirty'
  | 'salvando'
  | 'erro';

interface Props {
  state: RascunhoVisualState;
  /** Timestamp do save (servidor ou local) em ISO 8601. null quando irrelevante. */
  savedAt: string | null;
  /** Callback de retry quando state='erro'. */
  onRetry?: () => void;
  className?: string;
}

function formatHHMM(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

export default function RascunhoStatus({ state, savedAt, onRetry, className = '' }: Props) {
  if (state === 'idle') return null;

  const hhmm = formatHHMM(savedAt);

  if (state === 'local') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700 ${className}`}
      >
        <Cloud className="h-3.5 w-3.5" aria-hidden />
        Rascunho salvo localmente{hhmm && ` às ${hhmm}`}
      </span>
    );
  }

  if (state === 'servidor') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 ${className}`}
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Rascunho salvo no servidor{hhmm && ` às ${hhmm}`}
      </span>
    );
  }

  if (state === 'dirty') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800 ${className}`}
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Alterações não salvas{hhmm && ` (último save: ${hhmm})`}
      </span>
    );
  }

  if (state === 'salvando') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700 ${className}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }

  // erro
  return (
    <span
      role="alert"
      className={`inline-flex items-center gap-2 rounded-md bg-red-50 px-2.5 py-1 text-xs text-red-800 ${className}`}
    >
      <XCircle className="h-3.5 w-3.5" aria-hidden />
      Erro ao salvar — verificar conexão
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-1 h-6 px-2 text-xs text-red-800 hover:bg-red-100"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      )}
    </span>
  );
}
