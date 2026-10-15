// Renovação do plano de consultório. A MARI é vendida como ANUIDADE (link do
// Asaas: Pix à vista ou cartão em até 12×) e NÃO renova sozinha: no fim do ano
// a profissional renova pelo app (Meu perfil → Meu plano) ou o acesso termina.
// "Não quero renovar" não interrompe o ano já contratado: parcelas e acesso
// seguem até o fim do ciclo.
//
// Funções puras, usadas pelo app e pelas edge functions; testadas em
// src/lib/renovacao.test.ts.

export const MESES_ANUIDADE = 12;
/** A partir de quantos dias antes do fim do ano o app e o e-mail avisam. */
export const DIAS_AVISO_RENOVACAO = 60;
/** Direito de arrependimento (CDC art. 49): reembolso integral até 7 dias da compra. */
export const DIAS_GARANTIA = 7;

const MS_DIA = 24 * 60 * 60 * 1000;

export interface CicloPlano {
  data_inicio_assinatura?: string | null;
  proxima_renovacao?: string | null;
  /** Mensalidade antiga criada pelo app (12 cobranças). Vazio = compra anual pelo link. */
  asaas_subscription_id?: string | null;
}

function somarMesesData(data: Date, meses: number): Date {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/**
 * Fim do ano pago. Compra anual pelo link: proxima_renovacao. Mensalidade
 * antiga: proxima_renovacao anda de mês em mês, então o fim do ano é o início
 * do ciclo + 12 meses.
 */
export function fimDoCiclo(c: CicloPlano): Date | null {
  if (c.asaas_subscription_id) {
    return c.data_inicio_assinatura
      ? somarMesesData(new Date(c.data_inicio_assinatura), MESES_ANUIDADE)
      : null;
  }
  return c.proxima_renovacao ? new Date(c.proxima_renovacao) : null;
}

/** Início do ano atual (fim − 12 meses). */
export function inicioDoCiclo(c: CicloPlano): Date | null {
  const fim = fimDoCiclo(c);
  return fim ? somarMesesData(fim, -MESES_ANUIDADE) : null;
}

/** Em que mês do ano a profissional está (1 a 12). */
export function mesDeUso(c: CicloPlano, agora: Date = new Date()): number | null {
  const inicio = inicioDoCiclo(c);
  if (!inicio) return null;
  let meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth());
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  return Math.min(MESES_ANUIDADE, Math.max(1, meses + 1));
}

/** Dias até o fim do ano pago (negativo = já venceu). */
export function diasParaVencer(c: CicloPlano, agora: Date = new Date()): number | null {
  const fim = fimDoCiclo(c);
  return fim ? Math.ceil((fim.getTime() - agora.getTime()) / MS_DIA) : null;
}

/** Dentro do aviso de renovação (de 60 dias antes até o dia do vencimento). */
export function emJanelaDeRenovacao(c: CicloPlano, agora: Date = new Date()): boolean {
  const dias = diasParaVencer(c, agora);
  return dias !== null && dias >= 0 && dias <= DIAS_AVISO_RENOVACAO;
}

/**
 * Até 7 dias da compra. data_inicio_assinatura é a data em que a compra foi
 * confirmada (o webhook grava a cada compra nova).
 */
export function dentroDaGarantia(c: CicloPlano, agora: Date = new Date()): boolean {
  if (!c.data_inicio_assinatura) return false;
  return agora.getTime() - new Date(c.data_inicio_assinatura).getTime() <= DIAS_GARANTIA * MS_DIA;
}

/**
 * De onde conta o ano novo de uma compra anual. Quem renova ANTES de vencer não
 * perde os meses que ainda tinha: o ano novo começa no fim do atual. Vencido
 * (ou conta não ativa), começa hoje.
 */
export function inicioDaRenovacao(
  proximaRenovacaoAtual: string | null | undefined,
  planoStatus: string | null | undefined,
  agora: Date = new Date(),
): Date {
  if (planoStatus !== "ativo" || !proximaRenovacaoAtual) return agora;
  const fimAtual = new Date(proximaRenovacaoAtual);
  return fimAtual.getTime() > agora.getTime() ? fimAtual : agora;
}
