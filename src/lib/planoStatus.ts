export type PlanoSeveridade = 'suspenso' | 'inadimplente' | 'expirado' | 'expirando' | 'ok';

export interface PlanoStatusInfo {
  severidade: PlanoSeveridade;
  diasRestantes: number | null;
  bloqueado: boolean;
  titulo: string;
  descricao: string;
}

const MS_DIA = 1000 * 60 * 60 * 24;

// Aviso antecipado de renovação: 5 dias antes
const DIAS_AVISO = 5;

export function avaliarPlanoStatus(
  plano_status: string | null | undefined,
  plano_expira_em: string | null | undefined,
  proxima_renovacao?: string | null,
): PlanoStatusInfo {
  const status = (plano_status ?? 'ativo').toLowerCase();

  // Plano suspenso / cancelado / inativo
  if (status === 'suspenso' || status === 'cancelado' || status === 'inativo') {
    return {
      severidade: 'suspenso',
      diasRestantes: null,
      bloqueado: true,
      titulo: 'Seu plano está suspenso.',
      descricao: 'A geração de laudos e novas fichas está bloqueada. Atualize o plano para continuar.',
    };
  }

  // Pagamento em atraso (webhook PAYMENT_OVERDUE disparou)
  if (status === 'inadimplente') {
    return {
      severidade: 'inadimplente',
      diasRestantes: null,
      bloqueado: true,
      titulo: 'Pagamento em atraso.',
      descricao: 'Não conseguimos confirmar o pagamento da renovação. Regularize para retomar o acesso completo.',
    };
  }

  // Data de referência: usa plano_expira_em ou proxima_renovacao (o que estiver disponível)
  const dataRef = plano_expira_em || proxima_renovacao;

  if (dataRef) {
    const exp = new Date(dataRef).getTime();
    const agora = Date.now();
    const dias = Math.ceil((exp - agora) / MS_DIA);

    if (dias < 0) {
      return {
        severidade: 'expirado',
        diasRestantes: dias,
        bloqueado: true,
        titulo: 'Renovação vencida.',
        descricao: 'A data de renovação passou sem confirmação de pagamento. Regularize para retomar o acesso.',
      };
    }

    if (dias <= DIAS_AVISO) {
      return {
        severidade: 'expirando',
        diasRestantes: dias,
        bloqueado: false,
        titulo: dias === 0
          ? 'Sua renovação vence hoje!'
          : `Renovação em ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
        descricao: 'Efetue o pagamento para garantir continuidade sem interrupções.',
      };
    }
  }

  return {
    severidade: 'ok',
    diasRestantes: null,
    bloqueado: false,
    titulo: '',
    descricao: '',
  };
}
