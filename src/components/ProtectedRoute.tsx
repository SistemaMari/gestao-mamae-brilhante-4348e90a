import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Loader2 } from 'lucide-react';

type AllowedProfile = 'consultorio' | 'institucional' | 'gestor' | 'gestor_geral' | 'admin';

export default function ProtectedRoute({
  children,
  skipProfileCheck = false,
  allowedProfiles,
  skipOnboardingRedirect = false,
}: {
  children: React.ReactNode;
  skipProfileCheck?: boolean;
  allowedProfiles?: AllowedProfile[];
  skipOnboardingRedirect?: boolean;
}) {
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

  // Usuário autenticado mas sem perfil → onboarding
  if (profile === null && !skipOnboardingRedirect) {
    return <Navigate to="/onboarding" replace />;
  }

  // Server-side role enforcement: redirect users whose profile is not allowed for this route
  if (allowedProfiles && profile && !allowedProfiles.includes(profile as AllowedProfile)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Verificar perfil incompleto para profissionais (consultório / institucional)
  if (!skipProfileCheck && (profile === 'consultorio' || profile === 'institucional') && perfilIncompleto) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
}
