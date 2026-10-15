import { describe, it, expect } from 'vitest';
import {
  situacaoDoPagamento, mapearPagamento, montarPagamentosConta,
} from '../../supabase/functions/_shared/pagamentosConta.ts';

const HOJE = '2026-10-15';

describe('situacaoDoPagamento', () => {
  it('pago, estornado, em análise', () => {
    expect(situacaoDoPagamento('RECEIVED', '2026-09-01', HOJE)).toBe('pago');
    expect(situacaoDoPagamento('CONFIRMED', '2026-12-01', HOJE)).toBe('pago');
    expect(situacaoDoPagamento('REFUNDED', '2026-09-01', HOJE)).toBe('estornado');
    expect(situacaoDoPagamento('AWAITING_RISK_ANALYSIS', '2026-12-01', HOJE)).toBe('em_analise');
  });
  it('pendente vira vencido depois do vencimento', () => {
    expect(situacaoDoPagamento('PENDING', '2026-11-01', HOJE)).toBe('a_vencer');
    expect(situacaoDoPagamento('PENDING', '2026-10-01', HOJE)).toBe('vencido');
    expect(situacaoDoPagamento('OVERDUE', '2026-11-01', HOJE)).toBe('vencido');
  });
});

describe('mapearPagamento', () => {
  const base = {
    id: 'pay_1', value: 474, dueDate: '2026-11-01', invoiceUrl: 'https://asaas/i/1',
    bankSlipUrl: 'https://asaas/b/1', transactionReceiptUrl: 'https://asaas/r/1',
  };
  it('boleto em aberto: boleto, Pix e fatura; sem comprovante', () => {
    const l = mapearPagamento({ ...base, status: 'PENDING', billingType: 'BOLETO' }, HOJE);
    expect(l.linkBoleto).toBe('https://asaas/b/1');
    expect(l.pixDisponivel).toBe(true);
    expect(l.linkFatura).toBe('https://asaas/i/1');
    expect(l.linkComprovante).toBeNull();
  });
  it('cartão pago: só comprovante', () => {
    const l = mapearPagamento({ ...base, status: 'CONFIRMED', billingType: 'CREDIT_CARD', installmentNumber: 3, installment: 'ins_1' }, HOJE);
    expect(l.situacao).toBe('pago');
    expect(l.linkComprovante).toBe('https://asaas/r/1');
    expect(l.linkBoleto).toBeNull();
    expect(l.pixDisponivel).toBe(false);
    expect(l.parcela).toBe(3);
    expect(l.compra).toBe('ins_1');
  });
  it('cartão em aberto: sem boleto nem Pix (paga pela fatura)', () => {
    const l = mapearPagamento({ ...base, status: 'PENDING', billingType: 'CREDIT_CARD' }, HOJE);
    expect(l.linkBoleto).toBeNull();
    expect(l.pixDisponivel).toBe(false);
  });
});

describe('montarPagamentosConta', () => {
  it('tira as excluídas e ordena por vencimento e parcela', () => {
    const r = montarPagamentosConta([
      { id: 'b', status: 'PENDING', dueDate: '2026-12-01', installmentNumber: 2 },
      { id: 'x', status: 'PENDING', dueDate: '2026-10-01', deleted: true },
      { id: 'a', status: 'RECEIVED', dueDate: '2026-11-01', installmentNumber: 1 },
    ], HOJE);
    expect(r.map((l) => l.id)).toEqual(['a', 'b']);
  });
});
