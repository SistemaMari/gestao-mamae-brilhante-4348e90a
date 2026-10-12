import { describe, it, expect } from 'vitest';
import { statusPagamentoConta } from './statusPagamentoConta';

describe('statusPagamentoConta', () => {
  it('compra anual pelo link (sem assinatura) aparece como ativa', () => {
    expect(statusPagamentoConta({ plano_status: 'ativo', asaas_compra_id: 'inst_1' })).toBe('ativo');
  });
  it('mensalidade do app continua ativa', () => {
    expect(statusPagamentoConta({ plano_status: 'ativo', asaas_subscription_id: 'sub_1' })).toBe('ativo');
  });
  it('cadastro manual sem pagamento', () => {
    expect(statusPagamentoConta({ plano_status: 'ativo' })).toBe('sem');
  });
  it('reembolso e atraso', () => {
    expect(statusPagamentoConta({ plano_status: 'cancelado', asaas_compra_id: 'inst_1' })).toBe('cancelado');
    expect(statusPagamentoConta({ plano_status: 'inadimplente', asaas_subscription_id: 'sub_1' })).toBe('atrasado');
  });
});
