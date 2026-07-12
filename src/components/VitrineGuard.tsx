import { Navigate, Outlet } from 'react-router-dom';

/**
 * Bloqueia rotas /vitrine em domínios comerciais (maridmg.com.br).
 * Vitrine só continua disponível em preview/lovable.app.
 */
const DOMINIOS_BLOQUEADOS = ['maridmg.com.br', 'www.maridmg.com.br'];

export default function VitrineGuard() {
  if (typeof window !== 'undefined' && DOMINIOS_BLOQUEADOS.includes(window.location.hostname)) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
