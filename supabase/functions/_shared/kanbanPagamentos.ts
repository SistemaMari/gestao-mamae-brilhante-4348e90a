// Kanban de pagamentos e renovações do admin (planos de consultório).
//
// Cada conta cai em UMA coluna, pela situação que pede ação primeiro:
//   encerrado → atraso → renovar (≤ 60 dias) → vence_em_breve (≤ 5 dias, Pix/
//   boleto) → quitado → em_dia.
// O cartão mostra o mês do ano (1 a 12) e as parcelas da compra atual.
//
// Funções puras (app + testes em src/lib/kanbanPagamentos.test.ts). As parcelas
// vêm do Asaas já no formato de pagamentosConta.ts.

import type { PagamentoConta } from "./pagamentosConta.ts";
import {
  DIAS_AVISO_RENOVACAO, diasParaVencer, fimDoCiclo, inicioDoCiclo, mesDeUso,
} from "./renovacao.ts";

export type ColunaKanban = "em_dia" | "vence_em_breve" | "atraso" | "quitado" | "renovar" | "encerrado";

export const COLUNAS_KANBAN: ColunaKanban[] = [
  "em_dia", "vence_em_breve", "atraso", "quitado", "renovar", "encerrado",
];

/** Parcela de Pix/boleto que vence em até N dias entra em "vence em breve". */
export const DIAS_VENCE_EM_BREVE = 5;

export type MotivoEncerrado = "cancelado" | "revogado" | "vencido";

export interface ContaKanban {
  plano_status: string | null;
  acesso_revogado?: boolean | null;
  asaas_subscription_id?: string | null;
  asaas_compra_id?: string | null;
  data_inicio_assinatura?: string | null;
  proxima_renovacao?: string | null;
  /** Tem pedido aberto de "não quero renovar". */
  pedido_nao_renovar?: boolean;
}

export interface ParcelaKanban {
  numero: number;
  vencimento: string | null;
  situacao: PagamentoConta["situacao"];
  valor: number;
}

export interface SituacaoKanban {
  coluna: ColunaKanban;
  motivoEncerrado: MotivoEncerrado | null;
  /** Mês do ano pago (1 a 12). */
  mes: number | null;
  diasParaVencer: number | null;
  fimDoCiclo: string | null;
  /** CREDIT_CARD | PIX | BOLETO | UNDEFINED */
  forma: string | null;
  parcelas: ParcelaKanban[];
  pagas: number;
  /** Parcela vencida mais antiga: dias de atraso. */
  diasAtraso: number | null;
  /** Próxima parcela em aberto (AAAA-MM-DD). */
  proximoVencimento: string | null;
  /** Sem cobranças do Asaas para a compra atual (ex.: conta criada pelo admin). */
  semCobrancas: boolean;
  pedidoNaoRenovar: boolean;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const dia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime();
const diffDias = (de: string, ate: string) => Math.round((dia(ate) - dia(de)) / MS_DIA);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Cobranças da compra atual. Compra anual parcelada: todas as parcelas têm o
 * mesmo `compra` (= asaas_compra_id). À vista: a própria cobrança. Mensalidade
 * antiga (assinatura): as cobranças que vencem dentro do ano atual.
 */
export function cobrancasDaCompraAtual(
  conta: ContaKanban,
  pagamentos: ReadonlyArray<PagamentoConta>,
): PagamentoConta[] {
  const validas = pagamentos.filter((p) => p.situacao !== "estornado");
  const compra = conta.asaas_compra_id;
  if (compra && !conta.asaas_subscription_id) {
    const parcelas = validas.filter((p) => p.compra === compra);
    if (parcelas.length) return parcelas;
    const avulsa = validas.filter((p) => p.id === compra);
    if (avulsa.length) return avulsa;
  }
  const inicio = iso(inicioDoCiclo(conta));
  const fim = iso(fimDoCiclo(conta));
  if (!inicio || !fim) return [];
  return validas.filter((p) => p.vencimento && p.vencimento >= inicio && p.vencimento < fim);
}

export function situacaoKanban(
  conta: ContaKanban,
  pagamentos: ReadonlyArray<PagamentoConta>,
  hoje: string,
): SituacaoKanban {
  const agora = new Date(`${hoje}T12:00:00Z`);
  const cobrancas = cobrancasDaCompraAtual(conta, pagamentos).sort((a, b) =>
    `${a.vencimento ?? ""}#${String(a.parcela ?? 0).padStart(3, "0")}`
      .localeCompare(`${b.vencimento ?? ""}#${String(b.parcela ?? 0).padStart(3, "0")}`));

  const parcelas: ParcelaKanban[] = cobrancas.map((p, i) => ({
    numero: p.parcela ?? i + 1,
    vencimento: p.vencimento,
    situacao: p.situacao,
    valor: p.valor,
  }));
  const pagas = parcelas.filter((p) => p.situacao === "pago").length;
  const vencidas = parcelas.filter((p) => p.situacao === "vencido" && p.vencimento);
  const diasAtraso = vencidas.length ? Math.max(...vencidas.map((p) => diffDias(p.vencimento!, hoje))) : null;
  const proxima = parcelas.find((p) => p.situacao === "a_vencer" && p.vencimento) ?? null;
  const formaPaga = [...cobrancas].reverse().find((p) => p.situacao === "pago")?.forma;
  const forma = formaPaga ?? cobrancas[0]?.forma ?? null;
  const quitado = parcelas.length > 0 && pagas === parcelas.length;

  const dias = diasParaVencer(conta, agora);
  const fim = fimDoCiclo(conta);
  const base = {
    mes: mesDeUso(conta, agora),
    diasParaVencer: dias,
    fimDoCiclo: iso(fim),
    forma,
    parcelas,
    pagas,
    diasAtraso,
    proximoVencimento: proxima?.vencimento ?? null,
    semCobrancas: parcelas.length === 0,
    pedidoNaoRenovar: !!conta.pedido_nao_renovar,
  };
  const em = (coluna: ColunaKanban, motivoEncerrado: MotivoEncerrado | null = null): SituacaoKanban =>
    ({ coluna, motivoEncerrado, ...base });

  if (conta.plano_status === "cancelado") return em("encerrado", "cancelado");
  if (conta.acesso_revogado) return em("encerrado", "revogado");
  if (dias !== null && dias < 0) return em("encerrado", "vencido");

  if (vencidas.length || conta.plano_status === "inadimplente") return em("atraso");

  // Quem pediu para não renovar segue na coluna do pagamento até o ano acabar.
  if (!conta.pedido_nao_renovar && dias !== null && dias <= DIAS_AVISO_RENOVACAO) return em("renovar");

  const automatico = forma === "CREDIT_CARD";
  if (proxima?.vencimento && !automatico && diffDias(hoje, proxima.vencimento) <= DIAS_VENCE_EM_BREVE) {
    return em("vence_em_breve");
  }
  if (quitado) return em("quitado");
  return em("em_dia");
}
