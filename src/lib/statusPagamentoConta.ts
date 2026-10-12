// Status de pagamento de uma conta de consultório, na lista do admin.
// A compra anual pelo link do Asaas não cria assinatura: o que prova o
// pagamento é asaas_compra_id (parcelamento ou pagamento à vista).

export type StatusPagamentoConta = 'ativo' | 'atrasado' | 'cancelado' | 'sem';

export function statusPagamentoConta(p: {
  plano_status: string | null;
  asaas_subscription_id?: string | null;
  asaas_compra_id?: string | null;
}): StatusPagamentoConta {
  if (p.plano_status === 'inadimplente') return 'atrasado';
  if (p.plano_status === 'cancelado') return 'cancelado';
  if (p.asaas_subscription_id || p.asaas_compra_id) return 'ativo';
  return 'sem';
}
