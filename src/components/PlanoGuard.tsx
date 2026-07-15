import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import UpgradeRequired from './UpgradeRequired';

interface PlanoGuardProps {
  /** Nome amigável do plano atual, mostrado no bloqueio quando a feature está desligada. */
  nomePlanoNecessario: string;
  titulo?: string;
  descricao?: string;
  children: ReactNode;
}

/**
 * Guarda a rota de métricas pela flag planos.metricas_habilitado.
 * - Carregando: spinner.
 * - Feature habilitada no plano do profissional: renderiza o conteúdo.
 * - Feature desabilitada (admin desligou para o plano): renderiza UpgradeRequired em página cheia.
 *
 * Observação: Acesso aos DADOS é protegido pelas RLS policies do Supabase.
 * Este guard cuida da UX da rota — quem força a URL vê tela de bloqueio.
 */
export default function PlanoGuard({
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

  const habilitado = profissionalData?.planos?.metricas_habilitado ?? false;
  if (!habilitado) {
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
