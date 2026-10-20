import { describe, it, expect } from 'vitest';
import { situacaoKanban, cobrancasDaCompraAtual, type ContaKanban } from '../../supabase/functions/_shared/kanbanPagamentos.ts';
import type { PagamentoConta } from '../../supabase/functions/_shared/pagamentosConta.ts';

const HOJE = '2026-10-20';

// Compra anual em 12x feita em 2026-06-10 (fim do ano: 2027-06-10).
const contaAnual = (extra: Partial<ContaKanban> = {}): ContaKanban => ({
  plano_status: 'ativo',
  asaas_compra_id: 'ins_1',
  asaas_subscription_id: null,
  data_inicio_assinatura: '2026-06-10T12:00:00Z',
  proxima_renovacao: '2027-06-10T12:00:00Z',
  ...extra,
});

const parcela = (n: number, vencimento: string, situacao: PagamentoConta['situacao'], extra: Partial<PagamentoConta> = {}): PagamentoConta => ({
  id: `pay_${n}`, vencimento, pagoEm: situacao === 'pago' ? vencimento : null, valor: 139, forma: 'PIX',
  parcela: n, compra: 'ins_1', situacao, linkFatura: null, linkBoleto: null, linkComprovante: null, pixDisponivel: false,
  ...extra,
});

// 12 parcelas mensais a partir de 10/06; até 10/10 pagas.
const parcelas12 = (sobrescrever: Record<number, PagamentoConta['situacao']> = {}) =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 5 + i, 10)).toISOString().slice(0, 10);
    const padrao = d <= '2026-10-10' ? 'pago' : 'a_vencer';
    return parcela(i + 1, d, sobrescrever[i + 1] ?? padrao);
  });

describe('kanban de pagamentos', () => {
  it('Pix 12x com as parcelas em dia → em dia, mês 5 de 12', () => {
    const s = situacaoKanban(contaAnual(), parcelas12(), HOJE);
    expect(s.coluna).toBe('em_dia');
    expect(s.mes).toBe(5);
    expect(s.pagas).toBe(5);
    expect(s.parcelas).toHaveLength(12);
    expect(s.proximoVencimento).toBe('2026-11-10');
  });

  it('parcela de Pix vencida → atraso, com dias de atraso', () => {
    const s = situacaoKanban(contaAnual(), parcelas12({ 5: 'vencido' }), HOJE);
    expect(s.coluna).toBe('atraso');
    expect(s.diasAtraso).toBe(10);
  });

  it('Pix/boleto vencendo em até 5 dias → vence em breve; cartão não (é automático)', () => {
    const lista = parcelas12();
    const pix = situacaoKanban(contaAnual(), lista, '2026-11-06');
    expect(pix.coluna).toBe('vence_em_breve');
    const cartao = situacaoKanban(contaAnual(), lista.map((p) => ({ ...p, forma: 'CREDIT_CARD' })), '2026-11-06');
    expect(cartao.coluna).toBe('em_dia');
  });

  it('todas as parcelas pagas (ou à vista) → quitado', () => {
    const cinco = ['2026-06-10', '2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10']
      .map((d, i) => parcela(i + 1, d, 'pago'));
    expect(situacaoKanban(contaAnual(), cinco, HOJE).coluna).toBe('quitado');
    const aVista = [parcela(1, '2026-06-10', 'pago', { id: 'pay_unico', compra: null, parcela: null })];
    const s = situacaoKanban(contaAnual({ asaas_compra_id: 'pay_unico' }), aVista, HOJE);
    expect(s.coluna).toBe('quitado');
    expect(s.parcelas).toHaveLength(1);
  });

  it('faltando até 60 dias para o fim do ano → renovar', () => {
    const s = situacaoKanban(contaAnual(), parcelas12(), '2027-04-20');
    expect(s.diasParaVencer).toBe(51);
    expect(s.coluna).toBe('renovar');
  });

  it('atraso vence a renovação; quem pediu para não renovar fica fora de "renovar"', () => {
    const tudoPago = parcelas12(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 'pago'])));
    expect(situacaoKanban(contaAnual(), tudoPago, '2027-04-20').coluna).toBe('renovar');
    const comPedido = situacaoKanban(contaAnual({ pedido_nao_renovar: true }), tudoPago, '2027-04-20');
    expect(comPedido.coluna).toBe('quitado');
    expect(comPedido.pedidoNaoRenovar).toBe(true);
    const atrasada = parcelas12(Object.fromEntries([...Array.from({ length: 11 }, (_, i) => [i + 1, 'pago']), [12, 'vencido']]));
    expect(situacaoKanban(contaAnual(), atrasada, '2027-06-01').coluna).toBe('atraso');
  });

  it('cancelado, revogado ou ano vencido → encerrados', () => {
    expect(situacaoKanban(contaAnual({ plano_status: 'cancelado' }), [], HOJE)).toMatchObject({ coluna: 'encerrado', motivoEncerrado: 'cancelado' });
    expect(situacaoKanban(contaAnual({ acesso_revogado: true }), [], HOJE)).toMatchObject({ coluna: 'encerrado', motivoEncerrado: 'revogado' });
    expect(situacaoKanban(contaAnual(), parcelas12(), '2027-06-15')).toMatchObject({ coluna: 'encerrado', motivoEncerrado: 'vencido' });
  });

  it('ignora parcelas de outra compra e estornos', () => {
    const lista = [
      ...parcelas12(),
      parcela(1, '2025-06-10', 'pago', { id: 'antiga', compra: 'ins_velho' }),
      parcela(2, '2026-07-10', 'estornado', { id: 'est' }),
    ];
    expect(cobrancasDaCompraAtual(contaAnual(), lista)).toHaveLength(12);
  });

  it('conta sem cobranças no Asaas → em dia, marcada como sem cobranças', () => {
    const s = situacaoKanban(contaAnual({ asaas_compra_id: null }), [], HOJE);
    expect(s.coluna).toBe('em_dia');
    expect(s.semCobrancas).toBe(true);
  });
});
