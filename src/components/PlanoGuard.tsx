import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import UpgradeRequired from './UpgradeRequired';

interface PlanoGuardProps {
  /** Slugs de planos que liberam o recurso. Ex.: ['profissional']. */
  planosPermitidos: string[];
  /** Nome amigável do menor plano permitido (mostrado no bloqueio). */
  nomePlanoNecessario: string;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
}

/**
 * Guarda rotas por plano do profissional.
 * - Carregando: spinner.
 * - Plano permitido: renderiza o conteúdo.
 * - Plano insuficiente: renderiza UpgradeRequired em página cheia.
 *
 * Observação: Acesso aos DADOS é protegido pelas RLS policies do Supabase.
 * Este guard cuida da UX da rota — quem força a URL vê tela de upgrade.
 */
export default function PlanoGuard({
  planosPermitidos,
  nomePlanoNecessario,
  titulo,
  descricao,
  children,
}: PlanoGuardProps) {
  const { profissionalData, loading } = useProfissionalData();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const planoAtual = profissionalData?.plano ?? 'inicial';
  if (!planosPermitidos.includes(planoAtual)) {
    return (
      <UpgradeRequired
        planoNecessario={nomePlanoNecessario}
        titulo={titulo}
        descricao={descricao}
      />
    );
  }

  return <>{children}</>;
}
