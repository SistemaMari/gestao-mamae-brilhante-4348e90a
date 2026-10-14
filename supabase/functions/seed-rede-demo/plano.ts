// Planejador da Rede de Demonstração: gera, de forma DETERMINÍSTICA (mesma
// semente → mesmos dados), a jornada de cada gestante — datas, glicemias,
// perfis glicêmicos — e o desfecho de cada consulta calculado pelas regras do
// sistema (regras.ts). Não toca no banco: o index.ts executa este plano
// gravando as mesmas linhas que as fichas gravam e chamando o gerar-laudo.

import {
  aplicarRegrasFichaA,
  calcularIntervaloRetornoDias,
  diagnosticoGtt,
  diagnosticoRetorno1,
  fetaisAplicaveis,
  percentualNaMeta4Pontos,
  PONTOS_4,
  type ChecklistInput,
  type DecisaoResultado,
  type Ponto4,
} from './regras.ts';
import { UNIDADES, type Jornada, type UnidadeSpec } from '../_shared/redeDemo.ts';

// ── datas (strings 'YYYY-MM-DD', aritmética em UTC) ─────────────────────────
export function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}
export interface IG { semanas: number; dias: number }
export function igNaData(dum: string, data: string): IG {
  const d = diffDias(data, dum);
  return { semanas: Math.floor(d / 7), dias: d % 7 };
}
const dataNaIg = (dum: string, semanas: number, dias = 0) => addDias(dum, semanas * 7 + dias);

// ── PRNG determinístico (mulberry32) ────────────────────────────────────────
export function criarRng(semente: string) {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) {
    h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    entre: ([min, max]: [number, number]) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
  };
}
type Rng = ReturnType<typeof criarRng>;

// ── eventos ─────────────────────────────────────────────────────────────────
export type Grid4 = Array<Partial<Record<Ponto4, number>>>;

export type Evento =
  | { tipo: 'caso_novo'; data: string; ig: IG }
  | { tipo: 'retorno_1'; data: string; ig: IG; gj: number; cenario: string | null; statusFicha: string }
  | {
      tipo: 'gtt'; data: string; ig: IG; jejum: number; h1: number; h2: number;
      cenario: string | null; statusFicha: string;
    }
  | {
      tipo: 'ficha_ac'; data: string; ig: IG; fichaTipo: 'ficha_a' | 'ficha_c';
      dataInicio: string; dataFim: string; janela: '1h'; grid: Grid4;
      total: number; naMeta: number; percentual: number; cenario: '2' | '3';
      decisaoPerfil: 'controle_adequado' | 'controle_inadequado';
      checklist: ChecklistInput; decisao: DecisaoResultado;
      iniciaInsulina: boolean; proximoRetorno: string | null;
    }
  | { tipo: 'encerramento'; data: string; motivo: 'parto' | 'aborto' | 'nao_retornou' };

export interface PlanoPaciente {
  unidade: string;
  indice: number;
  nome: string;
  identificacao: string;
  profissional: string;
  jornada: Jornada;
  dataNascimento: string;
  dum: string;
  dmgAnterior: boolean;
  /** Hora local (BRT) usada nos carimbos de data/hora deste paciente. */
  hora: number;
  eventos: Evento[];
}

/** Estado final da paciente, aplicando os updates de `pacientes` que cada ficha faz. */
export interface EstadoFinal {
  status_ficha: string;
  motivo_encerramento: string | null;
  data_encerramento: string | null;
  data_ultima_consulta: string | null;
  data_proximo_retorno: string | null;
}

export function estadoFinal(p: PlanoPaciente): EstadoFinal {
  const s: EstadoFinal = {
    status_ficha: 'aguardando_gj', motivo_encerramento: null, data_encerramento: null,
    data_ultima_consulta: null, data_proximo_retorno: null,
  };
  for (const e of p.eventos) {
    if (e.tipo === 'caso_novo') s.data_ultima_consulta = e.data;
    else if (e.tipo === 'retorno_1' || e.tipo === 'gtt') {
      s.status_ficha = e.statusFicha;
      s.data_ultima_consulta = e.data;
    } else if (e.tipo === 'ficha_ac') {
      s.status_ficha = e.iniciaInsulina ? 'encerrada_insulinizacao' : 'dmg_confirmado';
      if (e.iniciaInsulina) {
        s.motivo_encerramento = 'insulinizacao';
        s.data_encerramento = e.data;
      }
      s.data_ultima_consulta = e.data;
      s.data_proximo_retorno = e.proximoRetorno;
    } else if (e.tipo === 'encerramento') {
      // Encerramento manual (FichaPacientePage.handleEncerrar): só motivo + data.
      s.motivo_encerramento = e.motivo;
      s.data_encerramento = e.data;
    }
  }
  return s;
}

/** Eventos que viram laudo (cenário que o gerar-laudo aceita). */
export function eventosComLaudo(p: PlanoPaciente) {
  return p.eventos.filter(
    (e): e is Extract<Evento, { tipo: 'retorno_1' | 'gtt' | 'ficha_ac' }> =>
      (e.tipo === 'retorno_1' || e.tipo === 'gtt' || e.tipo === 'ficha_ac') && e.cenario != null,
  );
}

// ── geradores de valores ────────────────────────────────────────────────────
function gjNormal(r: Rng) { return r.int(72, 89); }
function gjDmg(r: Rng) { return r.int(93, 118); }
function gjOvert(r: Rng) { return r.int(128, 152); }

function gttNormal(r: Rng) {
  return { jejum: r.int(72, 88), h1: r.int(118, 172), h2: r.int(96, 146) };
}
function gttAlterado(r: Rng) {
  const v = gttNormal(r);
  const qual = r.int(0, 2);
  if (qual === 0) v.jejum = r.int(92, 104);
  if (qual === 1) v.h1 = r.int(182, 214);
  if (qual === 2) v.h2 = r.int(155, 186);
  return v;
}

function gerarGrid(r: Rng, dias: number, pNaMeta: number): Grid4 {
  const grid: Grid4 = [];
  for (let d = 0; d < 15; d++) {
    const row: Partial<Record<Ponto4, number>> = {};
    if (d < dias) {
      for (const p of PONTOS_4) {
        const naMeta = r.chance(pNaMeta);
        row[p] = p === 'jejum'
          ? (naMeta ? r.int(76, 93) : r.int(97, 121))
          : (naMeta ? r.int(98, 136) : r.int(142, 181));
      }
    }
    grid.push(row);
  }
  return grid;
}

function gerarFicha(
  r: Rng, dum: string, data: string, modo: 'manter' | 'insulina', primeiroPerfil: boolean,
): Extract<Evento, { tipo: 'ficha_ac' }> {
  const ig = igNaData(dum, data);
  const dias = r.int(9, 14);
  const janela = '1h' as const;
  let grid: Grid4;
  let calc: ReturnType<typeof percentualNaMeta4Pontos>;
  // Sorteia medições até o % cair na faixa da jornada (o desfecho sai da regra).
  for (;;) {
    grid = gerarGrid(r, dias, modo === 'manter' ? 0.8 + r.next() * 0.15 : 0.4 + r.next() * 0.22);
    calc = percentualNaMeta4Pontos(grid, janela);
    const pct = calc.percentual ?? 0;
    if (modo === 'manter' ? pct >= 75 : pct >= 35 && pct < 66) break;
  }
  const pct = calc.percentual!;
  const fetal = fetaisAplicaveis(ig.semanas) ? 'sim' as const : null;
  const checklist: ChecklistInput = {
    checklist_dieta: true, checklist_exercicio: true, checklist_ganho_peso: true,
    checklist_pfe_us: fetal, checklist_ca: fetal, checklist_la: fetal,
    memoria_glicosimetro: null, pactuacao_adesao: null,
  };
  const decisao = aplicarRegrasFichaA(checklist, pct, null, ig.semanas, 0);
  const iniciaInsulina =
    decisao.proxima_ficha_recomendada === 'ficha_b' || decisao.proxima_ficha_recomendada === 'ficha_d';
  const adequado = pct >= 70;
  const retornoDias = calcularIntervaloRetornoDias({
    ehFichaE: false, ehPrimeiroPerfil: primeiroPerfil, igSemanas: ig.semanas,
    regraAplicada: decisao.regra_aplicada,
  });
  return {
    tipo: 'ficha_ac', data, ig,
    fichaTipo: ig.semanas > 30 ? 'ficha_c' : 'ficha_a',
    dataInicio: addDias(data, -dias), dataFim: addDias(data, -1), janela, grid,
    total: calc.total, naMeta: calc.ok, percentual: pct,
    cenario: adequado ? '2' : '3',
    decisaoPerfil: adequado ? 'controle_adequado' : 'controle_inadequado',
    checklist, decisao, iniciaInsulina,
    proximoRetorno: iniciaInsulina ? null : addDias(data, retornoDias),
  };
}

// ── jornadas ────────────────────────────────────────────────────────────────
interface Ctx {
  r: Rng;
  hoje: string;
  /** Data mais recente que um evento pode ter (hoje, ou bem antes p/ "sem uso recente"). */
  limite: string;
  /** Início da janela de histórico (≈ 6 meses). */
  inicio: string;
  perfil: UnidadeSpec['perfil'];
}

class Invalida extends Error {}
const exigir = (cond: boolean) => { if (!cond) throw new Invalida(); };

function casoNovo(ctx: Ctx, dataCN: string, igSemanas: number) {
  const dum = addDias(dataCN, -(igSemanas * 7 + ctx.r.int(0, 6)));
  return { dum, ev: { tipo: 'caso_novo', data: dataCN, ig: igNaData(dum, dataCN) } as Evento };
}
function retorno1(dum: string, data: string, gj: number): Evento {
  const d = diagnosticoRetorno1(gj);
  return { tipo: 'retorno_1', data, ig: igNaData(dum, data), gj, cenario: d.cenario, statusFicha: d.statusFicha };
}
function gtt(dum: string, data: string, v: { jejum: number; h1: number; h2: number }): Evento {
  const ig = igNaData(dum, data);
  const d = diagnosticoGtt(v.jejum, v.h1, v.h2, ig.semanas);
  return { tipo: 'gtt', data, ig, ...v, cenario: d.cenario, statusFicha: d.statusFicha };
}

/** Sequência de perfis glicêmicos a partir de `primeira`, até `ate` (inclusive). */
function fichas(
  ctx: Ctx, dum: string, primeira: string, ate: string, modo: 'manter' | 'insulina', max: number,
): Evento[] {
  const out: Evento[] = [];
  let data = primeira;
  while (out.length < max && data <= ate && igNaData(dum, data).semanas < 39) {
    const f = gerarFicha(ctx.r, dum, data, modo, out.length === 0);
    out.push(f);
    if (f.iniciaInsulina || !f.proximoRetorno) break;
    data = addDias(f.proximoRetorno, ctx.r.int(0, 2));
  }
  return out;
}

function montar(j: Jornada, ctx: Ctx): { dum: string; eventos: Evento[] } {
  const { r, hoje, perfil } = ctx;
  const gap = () => r.entre(perfil.gapRetorno1);
  const ev: Evento[] = [];
  let dum: string;

  const inicioGj = (igMin: number, igMax: number, diasAtrasMin: number, diasAtrasMax: number) => {
    const cn = casoNovo(ctx, addDias(hoje, -r.int(diasAtrasMin, diasAtrasMax)), r.int(igMin, igMax));
    ev.push(cn.ev);
    return cn.dum;
  };
  // Caso Novo → Retorno 1 normal → GTT, com os intervalos do perfil da unidade.
  // Ancorado pelo GTT (sorteado até `gttAntesDe`); a IG no GTT tem de cair na
  // janela 24–27 sem (ou 29–31 sem quando a unidade diagnostica tarde → 6B).
  const viaGtt = (alterado: boolean, gttAntesDe: string, janelaDias = 80) => {
    const gttData = addDias(gttAntesDe, -r.int(0, janelaDias));
    const r1Data = addDias(gttData, -r.entre(perfil.gapGtt));
    const cnData = addDias(r1Data, -gap());
    const igCN = r.entre(perfil.igCasoNovoGtt);
    const d = addDias(cnData, -(igCN * 7 + r.int(0, 6)));
    const igG = igNaData(d, gttData).semanas;
    exigir(perfil.gttTardio ? igG >= 29 && igG <= 31 : igG >= 24 && igG <= 27);
    ev.push({ tipo: 'caso_novo', data: cnData, ig: igNaData(d, cnData) });
    ev.push(retorno1(d, r1Data, gjNormal(r)));
    ev.push(gtt(d, gttData, alterado ? gttAlterado(r) : gttNormal(r)));
    return d;
  };

  switch (j) {
    case 'aguardando_gj': {
      dum = inicioGj(8, 22, 1, 12);
      break;
    }
    case 'aguardando_gtt': {
      dum = inicioGj(8, 14, 25, 85);
      const r1 = addDias(ev[0].data, gap());
      exigir(r1 < hoje);
      ev.push(retorno1(dum, r1, gjNormal(r)));
      const igHoje = igNaData(dum, hoje).semanas;
      exigir(igHoje >= 14 && igHoje <= 27);
      break;
    }
    case 'gtt_atrasado': {
      dum = inicioGj(10, 18, 70, 150);
      const r1 = addDias(ev[0].data, gap());
      ev.push(retorno1(dum, r1, gjNormal(r)));
      const igHoje = igNaData(dum, hoje).semanas;
      exigir(igHoje >= 29 && igHoje <= 33);
      break;
    }
    case 'afastado': {
      dum = inicioGj(8, 16, 45, 178);
      const r1 = addDias(ev[0].data, gap());
      const g = dataNaIg(dum, r.int(24, 27), r.int(0, 6));
      exigir(diffDias(g, r1) >= 3);
      ev.push(retorno1(dum, r1, gjNormal(r)));
      ev.push(gtt(dum, g, gttNormal(r)));
      break;
    }
    case 'dmg_recente': {
      const r1 = addDias(hoje, -r.int(2, 9));
      const cn = casoNovo(ctx, addDias(r1, -gap()), r.int(10, 22));
      dum = cn.dum;
      ev.push(cn.ev, retorno1(dum, r1, gjDmg(r)));
      break;
    }
    case 'dmg_tratamento':
    case 'dmg_insulina':
    case 'dmg_parto': {
      const parto = j === 'dmg_parto';
      dum = parto ? inicioGj(10, 14, 150, 178) : inicioGj(10, 20, 35, 85);
      const r1 = addDias(ev[0].data, gap());
      ev.push(retorno1(dum, r1, gjDmg(r)));
      const dataParto = parto ? dataNaIg(dum, r.int(38, 39), r.int(0, 6)) : null;
      if (parto) exigir(dataParto! <= addDias(hoje, -3));
      const ate = parto ? addDias(dataParto!, -3) : hoje;
      const fs = fichas(ctx, dum, addDias(r1, r.int(14, 18)), ate, j === 'dmg_insulina' ? 'insulina' : 'manter', parto ? 5 : 4);
      exigir(fs.length >= 1);
      ev.push(...fs);
      if (parto) ev.push({ tipo: 'encerramento', data: dataParto!, motivo: 'parto' });
      break;
    }
    case 'dmg_gtt_tratamento':
    case 'dmg_gtt_insulina':
    case 'dmg_gtt_parto': {
      const parto = j === 'dmg_gtt_parto';
      dum = parto ? viaGtt(true, addDias(hoje, -50), 115) : viaGtt(true, addDias(hoje, -20));
      const g = ev[ev.length - 1];
      const dataParto = parto ? dataNaIg(dum, r.int(38, 39), r.int(0, 6)) : null;
      if (parto) exigir(dataParto! <= addDias(hoje, -3));
      const ate = parto ? addDias(dataParto!, -3) : hoje;
      const fs = fichas(ctx, dum, addDias(g.data, r.int(14, 18)), ate, j === 'dmg_gtt_insulina' ? 'insulina' : 'manter', parto ? 5 : 4);
      exigir(fs.length >= 1);
      ev.push(...fs);
      if (parto) ev.push({ tipo: 'encerramento', data: dataParto!, motivo: 'parto' });
      break;
    }
    case 'overt': {
      dum = inicioGj(10, 20, 20, 100);
      ev.push(retorno1(dum, addDias(ev[0].data, gap()), gjOvert(r)));
      break;
    }
    case 'nao_retornou': {
      dum = inicioGj(8, 16, 80, 178);
      const r1 = addDias(ev[0].data, gap());
      ev.push(retorno1(dum, r1, gjNormal(r)));
      ev.push({ tipo: 'encerramento', data: addDias(r1, r.int(45, 70)), motivo: 'nao_retornou' });
      break;
    }
    case 'aborto': {
      dum = inicioGj(7, 9, 30, 170);
      ev.push({ tipo: 'encerramento', data: addDias(ev[0].data, r.int(10, 28)), motivo: 'aborto' });
      break;
    }
    default:
      throw new Error(`jornada desconhecida: ${j}`);
  }

  // Restrições comuns: tudo dentro da janela e nada no futuro (nem depois do limite).
  for (const e of ev) {
    exigir(e.data <= ctx.limite);
    exigir(e.data >= ctx.inicio);
  }
  return { dum: dum!, eventos: ev };
}

// ── nomes fictícios ─────────────────────────────────────────────────────────
const PRIMEIROS = [
  'Ana', 'Bruna', 'Carla', 'Daniela', 'Elisa', 'Fabiana', 'Gabriela', 'Heloísa', 'Isabela', 'Joana',
  'Karina', 'Larissa', 'Mariana', 'Natália', 'Olívia', 'Priscila', 'Quésia', 'Rafaela', 'Sabrina', 'Tatiane',
  'Úrsula', 'Vanessa', 'Wanda', 'Yasmin', 'Zélia', 'Alice', 'Bianca', 'Cecília', 'Débora', 'Eduarda',
  'Flávia', 'Giovana', 'Helena', 'Ingrid', 'Jéssica', 'Kelly', 'Letícia', 'Melissa', 'Nayara', 'Paula',
];
const SOBRENOMES = ['Exemplo', 'Demonstração', 'Modelo', 'Fictícia', 'Amostra', 'Simulada'];
export function nomeFicticio(n: number): string {
  return `${PRIMEIROS[n % PRIMEIROS.length]} ${SOBRENOMES[Math.floor(n / PRIMEIROS.length) % SOBRENOMES.length]}`;
}

// ── plano da rede ───────────────────────────────────────────────────────────
const JANELA_HISTORICO_DIAS = 182;
const SEM_USO_RECENTE_DIAS = 70;

export function planejarUnidade(u: UnidadeSpec, hoje: string, offsetNome: number): PlanoPaciente[] {
  const r = criarRng(`rede-demo:${u.chave}`);
  const inicio = addDias(hoje, -JANELA_HISTORICO_DIAS);

  // Expande a composição em ordem fixa e embaralha de forma determinística.
  const jornadas: Jornada[] = [];
  for (const [j, n] of Object.entries(u.composicao) as [Jornada, number][]) {
    for (let i = 0; i < n; i++) jornadas.push(j);
  }
  for (let i = jornadas.length - 1; i > 0; i--) {
    const k = r.int(0, i);
    [jornadas[i], jornadas[k]] = [jornadas[k], jornadas[i]];
  }

  // O profissional "sem uso recente" fica com até 3 gestantes antigas
  // (afastado / não retornou), todas sem nenhum evento nos últimos 70 dias.
  const semUso = u.profissionais.find((p) => p.semUsoRecente);
  const ativos = u.profissionais.filter((p) => !p.semUsoRecente);
  const doSemUso = new Set<number>();
  if (semUso) {
    jornadas.forEach((j, i) => {
      if (doSemUso.size < 3 && (j === 'afastado' || j === 'nao_retornou')) doSemUso.add(i);
    });
  }

  let rr = 0;
  return jornadas.map((j, i) => {
    const profissional = doSemUso.has(i) ? semUso!.chave : ativos[rr++ % ativos.length].chave;
    const limite = doSemUso.has(i) ? addDias(hoje, -SEM_USO_RECENTE_DIAS) : addDias(hoje, -1);
    const ctx: Ctx = { r, hoje, limite, inicio, perfil: u.perfil };
    let montado: { dum: string; eventos: Evento[] } | null = null;
    for (let t = 0; t < 400 && !montado; t++) {
      try {
        montado = montar(j, ctx);
      } catch (e) {
        if (!(e instanceof Invalida)) throw e;
      }
    }
    if (!montado) throw new Error(`não foi possível montar jornada ${j} em ${u.nome}`);
    const n = offsetNome + i;
    const ano = r.int(1986, 2005);
    return {
      unidade: u.chave,
      indice: i,
      nome: nomeFicticio(n),
      identificacao: `DEMO-${String(n + 1).padStart(4, '0')}`,
      profissional,
      jornada: j,
      dataNascimento: `${ano}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`,
      dum: montado.dum,
      dmgAnterior: j.startsWith('dmg') || j === 'overt' ? r.chance(0.35) : r.chance(0.08),
      hora: r.int(8, 16),
      eventos: montado.eventos,
    };
  });
}

export function planejarRede(hoje: string): Record<string, PlanoPaciente[]> {
  const out: Record<string, PlanoPaciente[]> = {};
  let offset = 0;
  for (const u of UNIDADES) {
    out[u.chave] = planejarUnidade(u, hoje, offset);
    offset += out[u.chave].length;
  }
  return out;
}
