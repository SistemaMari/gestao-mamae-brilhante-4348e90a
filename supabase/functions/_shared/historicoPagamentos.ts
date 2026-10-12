// Histórico de pagamentos de uma conta, montado a partir dos eventos que o
// webhook do Asaas já grava em asaas_webhook_events (sem tabela nova).
// Função pura, testada em src/lib/historicoPagamentos.test.ts.

export interface EventoAsaasGravado {
  event_type: string;
  created_at: string;
  payload: { payment?: Record<string, any> } | null;
}

export interface LinhaPagamento {
  id: string;
  /** Data do pagamento; na falta dela, o vencimento. AAAA-MM-DD. */
  data: string | null;
  valor: number;
  /** CREDIT_CARD | PIX | BOLETO | UNDEFINED … (billingType do Asaas) */
  forma: string | null;
  parcela: number | null;
  /** PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED … (status do Asaas) */
  status: string;
  link: string | null;
}

/** Uma linha por cobrança, com o estado do evento mais recente. Mais recentes primeiro. */
export function montarHistoricoPagamentos(
  eventos: ReadonlyArray<EventoAsaasGravado>,
): LinhaPagamento[] {
  const porCobranca = new Map<string, { em: string; linha: LinhaPagamento }>();

  for (const ev of eventos) {
    const p = ev.payload?.payment;
    if (!p?.id) continue;
    const anterior = porCobranca.get(p.id);
    if (anterior && anterior.em > ev.created_at) continue;
    porCobranca.set(p.id, {
      em: ev.created_at,
      linha: {
        id: String(p.id),
        data: p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? p.dueDate ?? null,
        valor: Number(p.value ?? 0),
        forma: p.billingType ?? null,
        parcela: p.installmentNumber != null ? Number(p.installmentNumber) : null,
        status: String(p.status ?? ev.event_type.replace(/^PAYMENT_/, "")),
        link: p.invoiceUrl ?? p.transactionReceiptUrl ?? null,
      },
    });
  }

  const ordem = (l: LinhaPagamento) => `${l.data ?? ""}#${String(l.parcela ?? 0).padStart(3, "0")}`;
  return [...porCobranca.values()]
    .map((v) => v.linha)
    .sort((a, b) => ordem(b).localeCompare(ordem(a)));
}
