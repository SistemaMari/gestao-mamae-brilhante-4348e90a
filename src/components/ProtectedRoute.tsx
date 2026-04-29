import { Navigate } from 'react-router-dom';
import { useAuth, getRedirectPath, type UserProfile } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({
  children,
  skipProfileCheck = false,
  allowedProfiles,
  skipOnboardingRedirect = false,
}: {
  children: React.ReactNode;
  skipProfileCheck?: boolean;
  allowedProfiles?: UserProfile[];
  skipOnboardingRedirect?: boolean;
}) {
  const { user, loading, profile } = useAuth();
  const { loading: loadingProf, perfilIncompleto } = useProfissionalData();

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

  // Verificar perfil incompleto para profissionais (consultório / institucional)
  if (!skipProfileCheck && (profile === 'consultorio' || profile === 'institucional') && perfilIncompleto) {
    return <Navigate to="/completar-perfil" replace />;
  }

  // Autorização por perfil — silenciosamente redireciona para a home do perfil
  if (allowedProfiles && allowedProfiles.length > 0 && profile && !allowedProfiles.includes(profile)) {
    return <Navigate to={getRedirectPath(profile)} replace />;
  }

  return <>{children}</>;
}
