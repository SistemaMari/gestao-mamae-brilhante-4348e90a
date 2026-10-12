import { describe, it, expect } from 'vitest';
import { montarHistoricoPagamentos } from '../../supabase/functions/_shared/historicoPagamentos.ts';

const ev = (event_type: string, created_at: string, payment: Record<string, unknown>) =>
  ({ event_type, created_at, payload: { payment } });

describe('montarHistoricoPagamentos', () => {
  it('uma linha por cobrança, com o estado mais recente', () => {
    const linhas = montarHistoricoPagamentos([
      ev('PAYMENT_CONFIRMED', '2026-10-12T10:00:00Z', { id: 'pay_1', value: 41.18, billingType: 'CREDIT_CARD', installmentNumber: 1, status: 'CONFIRMED', dueDate: '2026-10-12', invoiceUrl: 'https://x/1' }),
      ev('PAYMENT_RECEIVED', '2026-11-12T10:00:00Z', { id: 'pay_1', value: 41.18, billingType: 'CREDIT_CARD', installmentNumber: 1, status: 'RECEIVED', paymentDate: '2026-11-12', invoiceUrl: 'https://x/1' }),
      ev('PAYMENT_CONFIRMED', '2026-10-12T10:00:01Z', { id: 'pay_2', value: 41.18, billingType: 'CREDIT_CARD', installmentNumber: 2, status: 'CONFIRMED', dueDate: '2026-11-12' }),
    ]);
    expect(linhas).toHaveLength(2);
    const p1 = linhas.find((l) => l.id === 'pay_1')!;
    expect(p1).toMatchObject({ status: 'RECEIVED', data: '2026-11-12', valor: 41.18, forma: 'CREDIT_CARD', parcela: 1, link: 'https://x/1' });
  });
  it('evento fora de ordem não sobrescreve o mais recente', () => {
    const [l] = montarHistoricoPagamentos([
      ev('PAYMENT_REFUNDED', '2026-10-14T10:00:00Z', { id: 'pay_9', value: 474, status: 'REFUNDED' }),
      ev('PAYMENT_RECEIVED', '2026-10-12T10:00:00Z', { id: 'pay_9', value: 474, status: 'RECEIVED' }),
    ]);
    expect(l.status).toBe('REFUNDED');
  });
  it('mais recentes primeiro; ignora evento sem cobrança', () => {
    const linhas = montarHistoricoPagamentos([
      ev('PAYMENT_CONFIRMED', '2026-10-12T10:00:00Z', { id: 'a', value: 1, dueDate: '2026-10-12', installmentNumber: 1 }),
      ev('PAYMENT_CONFIRMED', '2026-10-12T10:00:00Z', { id: 'b', value: 1, dueDate: '2026-11-12', installmentNumber: 2 }),
      { event_type: 'PAYMENT_CONFIRMED', created_at: '2026-10-12T10:00:00Z', payload: {} },
    ]);
    expect(linhas.map((l) => l.id)).toEqual(['b', 'a']);
  });
  it('sem status no payload, usa o tipo do evento', () => {
    const [l] = montarHistoricoPagamentos([ev('PAYMENT_OVERDUE', '2026-10-12T10:00:00Z', { id: 'c', value: 79 })]);
    expect(l.status).toBe('OVERDUE');
  });
});
