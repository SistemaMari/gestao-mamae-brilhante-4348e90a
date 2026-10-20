// Dados da vitrine do kanban de pagamentos (/vitrine/admin/pagamentos).
// Datas relativas a hoje, para a demonstração sempre parecer atual: uma conta
// em cada situação do kanban.
import type { ProfissionalConsultorio } from '@/components/admin/profissionais/DrawerProfissional';
import type { PagamentoConta } from '../../supabase/functions/_shared/pagamentosConta';

const hoje = new Date();
const isoDia = (d: Date) => d.toLocaleDateString('en-CA');
export const PREVIEW_KANBAN_HOJE = isoDia(hoje);

const diasAtras = (n: number) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d; };
const somarMeses = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

function conta(id: string, nome: string, plano: string, inicio: Date, compra: string, telefone: string | null): ProfissionalConsultorio {
  return {
    id, nome, email: `${id}@exemplo.com.br`, crm: null, especialidade: null, telefone,
    plano_id: plano.toLowerCase(), plano_nome: plano, plano_preco: null, plano_status: 'ativo', plano_expira_em: null,
    laudos_limite: 0, laudos_usados: 0, pacientes_max: null, pacientes_usados: 0,
    asaas_subscription_id: null, asaas_customer_id: `cus_${id}`, asaas_compra_id: compra,
    data_inicio_assinatura: inicio.toISOString(), proxima_renovacao: somarMeses(inicio, 12).toISOString(),
    acesso_revogado: false, convite_pendente: false, ultimo_login: null, ultimo_laudo: null,
    laudos_ultimos_30d: 0, created_at: inicio.toISOString(),
  };
}

/** Parcelas mensais a partir do início: vencidas = pagas, salvo as indicadas como atrasadas. */
function parcelas(compra: string, inicio: Date, total: number, forma: string, valor: number, atrasadas: number[] = []): PagamentoConta[] {
  return Array.from({ length: total }, (_, i) => {
    const venc = isoDia(somarMeses(inicio, i));
    const atrasada = atrasadas.includes(i + 1);
    const situacao: PagamentoConta['situacao'] = atrasada ? 'vencido' : venc <= PREVIEW_KANBAN_HOJE ? 'pago' : 'a_vencer';
    return {
      id: `${compra}_${i + 1}`, vencimento: venc, pagoEm: situacao === 'pago' ? venc : null, valor, forma,
      parcela: total > 1 ? i + 1 : null, compra: total > 1 ? compra : null, situacao,
      linkFatura: null, linkBoleto: null, linkComprovante: null, pixDisponivel: false,
    };
  });
}

const inicios = {
  ana: diasAtras(125), paulo: diasAtras(212), bia: somarMeses(diasAtras(-3), -2), caio: diasAtras(100),
  lia: diasAtras(130), rui: diasAtras(245), eva: diasAtras(326), gil: diasAtras(310), ivo: diasAtras(383),
};

export const previewKanbanProfissionais: ProfissionalConsultorio[] = [
  conta('ana', 'Dra. Ana Lima', 'Intermediária', inicios.ana, 'ins_ana', '11988887777'),
  conta('paulo', 'Dr. Paulo Reis', 'Inicial', inicios.paulo, 'ins_paulo', null),
  conta('bia', 'Dra. Bia Souza', 'Profissional', inicios.bia, 'ins_bia', '21977776666'),
  conta('caio', 'Dr. Caio Mendes', 'Intermediária', inicios.caio, 'ins_caio', '31966665555'),
  conta('lia', 'Dra. Lia Prado', 'Profissional', inicios.lia, 'pay_lia', null),
  conta('rui', 'Dr. Rui Alves', 'Inicial', inicios.rui, 'ins_rui', null),
  conta('eva', 'Dra. Eva Rocha', 'Intermediária', inicios.eva, 'ins_eva', '41955554444'),
  conta('gil', 'Dr. Gil Matos', 'Profissional', inicios.gil, 'ins_gil', '51944443333'),
  conta('ivo', 'Dr. Ivo Nunes', 'Inicial', inicios.ivo, 'pay_ivo', null),
];

export const previewKanbanPagamentos: Record<string, PagamentoConta[]> = {
  ana: parcelas('ins_ana', inicios.ana, 12, 'PIX', 139),
  paulo: parcelas('ins_paulo', inicios.paulo, 12, 'CREDIT_CARD', 79),
  bia: parcelas('ins_bia', inicios.bia, 5, 'BOLETO', 717),
  caio: parcelas('ins_caio', inicios.caio, 12, 'PIX', 139, [4]),
  lia: parcelas('pay_lia', inicios.lia, 1, 'PIX', 2990).map((p) => ({ ...p, id: 'pay_lia' })),
  rui: parcelas('ins_rui', inicios.rui, 5, 'CREDIT_CARD', 190),
  eva: parcelas('ins_eva', inicios.eva, 12, 'CREDIT_CARD', 139),
  gil: parcelas('ins_gil', inicios.gil, 12, 'PIX', 299, [11]),
  ivo: parcelas('pay_ivo', inicios.ivo, 1, 'PIX', 790).map((p) => ({ ...p, id: 'pay_ivo' })),
};
