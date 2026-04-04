import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, skipProfileCheck = false }: { children: React.ReactNode; skipProfileCheck?: boolean }) {
  const { user, loading, profile } = useAuth();
  const { profissionalData, loading: loadingProf, perfilIncompleto } = useProfissionalData();

  if (loading || loadingProf) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-foreground font-heading font-semibold">Perfil não encontrado</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Conta não vinculada a nenhum perfil. Entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  // Verificar perfil incompleto para profissionais (consultório / institucional)
  if (!skipProfileCheck && (profile === 'consultorio' || profile === 'institucional') && perfilIncompleto) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
}
