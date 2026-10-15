// Pagamentos da própria conta (aba Pagamentos da profissional), a partir das
// cobranças do Asaas (GET /payments?customer=...). Funções puras, testadas em
// src/lib/pagamentosConta.test.ts.

export type SituacaoPagamento = "pago" | "a_vencer" | "vencido" | "estornado" | "em_analise";

export interface PagamentoConta {
  id: string;
  /** AAAA-MM-DD */
  vencimento: string | null;
  /** AAAA-MM-DD */
  pagoEm: string | null;
  valor: number;
  /** CREDIT_CARD | PIX | BOLETO | UNDEFINED (a cliente escolhe na fatura) */
  forma: string | null;
  parcela: number | null;
  /** Compra parcelada a que a cobrança pertence (todas as parcelas compartilham). */
  compra: string | null;
  situacao: SituacaoPagamento;
  /** Página da fatura no Asaas (paga por boleto, Pix ou cartão). */
  linkFatura: string | null;
  linkBoleto: string | null;
  linkComprovante: string | null;
  /** Em aberto e pagável por Pix: dá para gerar o copia e cola. */
  pixDisponivel: boolean;
}

const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const ESTORNADO = new Set([
  "REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS",
  "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL",
]);

export function situacaoDoPagamento(status: string, vencimento: string | null, hoje: string): SituacaoPagamento {
  if (PAGO.has(status)) return "pago";
  if (ESTORNADO.has(status)) return "estornado";
  if (status === "AWAITING_RISK_ANALYSIS") return "em_analise";
  if (status === "OVERDUE") return "vencido";
  if (vencimento && vencimento < hoje) return "vencido";
  return "a_vencer";
}

// deno-lint-ignore no-explicit-any
export function mapearPagamento(p: Record<string, any>, hoje: string): PagamentoConta {
  const vencimento = p.dueDate ?? null;
  const situacao = situacaoDoPagamento(String(p.status ?? ""), vencimento, hoje);
  const aberto = situacao === "a_vencer" || situacao === "vencido";
  const forma = p.billingType ?? null;
  return {
    id: String(p.id),
    vencimento,
    pagoEm: p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? null,
    valor: Number(p.value ?? 0),
    forma,
    parcela: p.installmentNumber != null ? Number(p.installmentNumber) : null,
    compra: p.installment ?? null,
    situacao,
    linkFatura: p.invoiceUrl ?? null,
    linkBoleto: aberto && (forma === "BOLETO" || forma === "UNDEFINED") ? (p.bankSlipUrl ?? null) : null,
    linkComprovante: situacao === "pago" ? (p.transactionReceiptUrl ?? null) : null,
    pixDisponivel: aberto && (forma === "PIX" || forma === "UNDEFINED" || forma === "BOLETO"),
  };
}

/** Cobranças da conta, sem as excluídas; mais antigas primeiro (ordem das parcelas). */
// deno-lint-ignore no-explicit-any
export function montarPagamentosConta(cobrancas: ReadonlyArray<Record<string, any>>, hoje: string): PagamentoConta[] {
  return cobrancas
    .filter((p) => p?.id && !p.deleted)
    .map((p) => mapearPagamento(p, hoje))
    .sort((a, b) =>
      `${a.vencimento ?? ""}#${String(a.parcela ?? 0).padStart(3, "0")}`
        .localeCompare(`${b.vencimento ?? ""}#${String(b.parcela ?? 0).padStart(3, "0")}`));
}
