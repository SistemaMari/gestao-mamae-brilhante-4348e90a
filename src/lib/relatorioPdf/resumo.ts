// Frases do "Resumo do período" na capa do relatório (unidade e rede).
// Lógica pura: só monta texto a partir dos números já calculados no banco.
import type { LinhaCuidadoBloco } from "@/lib/linhaCuidado";
import { resumoMetas, type MetasRede } from "@/lib/metas";
import { leituraFaixa, num, pct, plural } from "./formatos";

export interface GargalosContagem {
  sem_gj_primeira_consulta: number;
  atrasadas_gtt: number;
  confirmadas_sem_retorno: number;
}

function fraseGargalos(g: GargalosContagem, onde: string): string | null {
  const total = g.sem_gj_primeira_consulta + g.atrasadas_gtt + g.confirmadas_sem_retorno;
  if (total === 0) return `Hoje não há gestantes paradas em nenhuma das 3 pendências acompanhadas ${onde}.`;
  const partes: string[] = [];
  if (g.sem_gj_primeira_consulta > 0) partes.push(`${num(g.sem_gj_primeira_consulta)} sem glicemia de jejum`);
  if (g.atrasadas_gtt > 0) partes.push(`${num(g.atrasadas_gtt)} com a curva glicêmica (GTT) em atraso`);
  if (g.confirmadas_sem_retorno > 0) partes.push(`${num(g.confirmadas_sem_retorno)} com diabetes e sem retorno`);
  return `Pendências de hoje ${onde}: ${partes.join(", ")}.`;
}

function frasesLinhaCuidado(lc: LinhaCuidadoBloco, metas: MetasRede | null | undefined, faixa: [number, number]): string[] {
  const f: string[] = [];
  const { funil, adesao, tempos } = lc;
  f.push(
    `${num(funil.rastreadas)} ${plural(funil.rastreadas, "gestante foi rastreada", "gestantes foram rastreadas")} no período e ` +
      `${num(funil.diagnosticadas)} ${plural(funil.diagnosticadas, "teve", "tiveram")} diabetes confirmado (DMG ou diabetes prévio): ` +
      `taxa de diagnóstico de ${pct(funil.taxa_diagnostico_pct)}${funil.taxa_diagnostico_pct != null ? `, ${leituraFaixa(funil.taxa_diagnostico_pct, faixa[0], faixa[1])}` : ""}.`,
  );
  if (funil.diagnosticadas > 0) {
    const nr = funil.encerradas?.nao_retornou ?? 0;
    f.push(
      nr > 0
        ? `${num(nr)} de ${num(funil.diagnosticadas)} gestantes com diabetes pararam de vir (perda de seguimento de ${pct(funil.perda_seguimento_pct)}).`
        : `Nenhuma gestante com diabetes deixou de voltar (perda de seguimento de 0%).`,
    );
    f.push(
      `${num(adesao.com_perfil_completo)} de ${num(adesao.diagnosticadas)} entregaram o perfil glicêmico completo (${pct(adesao.perfil_completo_pct)})` +
        (adesao.com_perfil > 0
          ? `; das que entregaram algum perfil, ${pct(adesao.ultimo_na_meta_pct)} estavam com a glicemia controlada no mais recente.`
          : "."),
    );
    if (tempos.diag_com_ig > 0) {
      f.push(`${pct(tempos.diag_antes_28s_pct)} dos diagnósticos aconteceram antes de 28 semanas de gestação.`);
    }
  }
  const m = resumoMetas(lc, metas);
  if (m.definidas > 0) {
    f.push(
      m.avaliadas > 0
        ? `Metas da rede: ${num(m.atingidas)} de ${num(m.avaliadas)} ${plural(m.avaliadas, "meta avaliada", "metas avaliadas")} ${plural(m.atingidas, "foi atingida", "foram atingidas")}` +
            (m.definidas > m.avaliadas ? ` (${num(m.definidas - m.avaliadas)} com poucos dados para avaliar).` : ".")
        : "Metas da rede: ainda há poucos dados no período para avaliar.",
    );
  }
  return f;
}

export function resumoUnidade(input: {
  unidadeNome: string;
  gestantesAtivas: number;
  laudosPeriodo: number;
  linhaCuidado: LinhaCuidadoBloco | null;
  metas: MetasRede | null | undefined;
  gargalos: GargalosContagem;
  faixa: [number, number];
}): string[] {
  const f: string[] = [
    `A unidade ${input.unidadeNome} acompanha hoje ${num(input.gestantesAtivas)} ${plural(input.gestantesAtivas, "gestante ativa", "gestantes ativas")} e emitiu ${num(input.laudosPeriodo)} ${plural(input.laudosPeriodo, "laudo", "laudos")} no período.`,
  ];
  if (input.linhaCuidado) f.push(...frasesLinhaCuidado(input.linhaCuidado, input.metas, input.faixa));
  const g = fraseGargalos(input.gargalos, "na unidade");
  if (g) f.push(g);
  return f;
}

export function resumoRede(input: {
  redeNome: string;
  totalUnidades: number;
  gestantesAtivas: number;
  laudosPeriodo: number;
  linhaCuidado: LinhaCuidadoBloco | null;
  metas: MetasRede | null | undefined;
  gargalos: GargalosContagem;
  maisDiagnostica?: { unidade_nome: string; diagnosticos: number } | null;
  alertas: number;
  faixa: [number, number];
}): string[] {
  const f: string[] = [
    `A rede ${input.redeNome} (${num(input.totalUnidades)} ${plural(input.totalUnidades, "unidade", "unidades")}) acompanha hoje ${num(input.gestantesAtivas)} ${plural(input.gestantesAtivas, "gestante ativa", "gestantes ativas")} e emitiu ${num(input.laudosPeriodo)} ${plural(input.laudosPeriodo, "laudo", "laudos")} no período.`,
  ];
  if (input.linhaCuidado) f.push(...frasesLinhaCuidado(input.linhaCuidado, input.metas, input.faixa));
  if (input.maisDiagnostica && input.maisDiagnostica.diagnosticos > 0) {
    f.push(
      `A unidade que mais diagnosticou foi ${input.maisDiagnostica.unidade_nome} (${num(input.maisDiagnostica.diagnosticos)} ${plural(input.maisDiagnostica.diagnosticos, "diagnóstico", "diagnósticos")}).`,
    );
  }
  const g = fraseGargalos(input.gargalos, "na rede");
  if (g) f.push(g);
  if (input.alertas > 0) {
    f.push(`${num(input.alertas)} ${plural(input.alertas, "alerta operacional pede", "alertas operacionais pedem")} atenção (detalhes na seção de alertas).`);
  }
  return f;
}
