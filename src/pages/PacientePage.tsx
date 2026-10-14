import Consulta1Form from '@/components/Consulta1Form';
import FichaPacientePage from '@/pages/FichaPacientePage';
import { Navigate, useLocation, useParams } from 'react-router-dom';

export default function PacientePage() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const isNew = id === 'nova' || !id;

  if (isNew) {
    // Gestor de unidade não atende: /gestao/fichas/nova abria o Caso Novo e
    // permitia cadastrar gestante digitando o endereço. Volta para a lista.
    if (pathname.startsWith('/gestao') || pathname.startsWith('/vitrine/gestao')) {
      return <Navigate to={pathname.startsWith('/vitrine') ? '/vitrine/gestao/fichas' : '/gestao/fichas'} replace />;
    }
    return <Consulta1Form />;
  }

  return <FichaPacientePage />;
}
