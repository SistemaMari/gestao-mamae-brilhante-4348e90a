// Testes da carga da Rede de Demonstração (supabase/functions/seed-rede-demo).
// 1) A cópia do motor da Ficha A usada pela carga é IDÊNTICA ao motor do app.
// 2) O plano gerado cumpre o que a rede precisa mostrar nos painéis, medido
//    com as mesmas definições das funções do painel do gestor.
import { describe, expect, it } from 'vitest';
import { aplicarRegrasFichaA as original, type ChecklistInput } from '@/lib/fichaADecisao';
import { calcularIntervaloRetornoDias as intervaloOriginal } from '@/lib/retornoInterval';
import { metaPosPrandial as metaOriginal } from '@/lib/posPrandial';
import { janelaDaIg } from '@/lib/janelaCrescimentoFetal';
import {
  aplicarRegrasFichaA as copia,
  calcularIntervaloRetornoDias as intervaloCopia,
  fetaisAplicaveis,
  metaPosPrandial as metaCopia,
} from '../../supabase/functions/seed-rede-demo/regras.ts';
import {
  addDias,
  diffDias,
  estadoFinal,
  eventosComLaudo,
  planejarRede,
  type PlanoPaciente,
} from '../../supabase/functions/seed-rede-demo/plano.ts';
import { UNIDADES } from '../../supabase/functions/_shared/redeDemo.ts';

const HOJE = '2026-10-13';
const DMG = new Set(['1', '6', '6B']);

describe('regras copiadas = regras do app', () => {
  it('aplicarRegrasFichaA: mesma saída em todas as combinações', () => {
    const bools = [true, false, null];
    const fetais = ['sim', 'nao', 'sem_info', null] as const;
    const memorias = ['confirma', 'nao_confirma', null] as const;
    const pactuacoes = ['aceita', 'recusa', null] as const;
    let casos = 0;
    for (const dieta of bools) for (const ex of bools) for (const peso of [true, false]) {
      for (const f of fetais) for (const mem of memorias) for (const pac of pactuacoes) {
        for (const pct of [40, 69.9, 70, 95]) for (const ig of [null, 26, 30, 31, 36]) {
          for (const previas of [0, 1]) {
            const d: ChecklistInput = {
              checklist_dieta: dieta, checklist_exercicio: ex, checklist_ganho_peso: peso,
              checklist_pfe_us: f, checklist_ca: 'sim', checklist_la: 'sim',
              memoria_glicosimetro: mem, pactuacao_adesao: pac,
            };
            expect(copia(d, pct, 70, ig, previas)).toEqual(original(d, pct, 70, ig, previas));
            casos++;
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(1000);
  });

  it('intervalo de retorno, meta pós-prandial e janela fetal', () => {
    for (const ehFichaE of [true, false]) for (const ehPrimeiroPerfil of [true, false]) {
      for (const igSemanas of [null, 20, 30, 31]) for (const regraAplicada of ['regra_2', 'regra_3', null]) {
        const p = { ehFichaE, ehPrimeiroPerfil, igSemanas, regraAplicada };
        expect(intervaloCopia(p)).toBe(intervaloOriginal(p));
      }
    }
    expect(metaCopia('1h')).toBe(metaOriginal('1h'));
    expect(metaCopia('2h')).toBe(metaOriginal('2h'));
    for (let ig = 0; ig <= 42; ig++) expect(fetaisAplicaveis(ig)).toBe(janelaDaIg(ig) != null);
  });
});

// ── métricas do plano, com as definições dos painéis ─────────────────────
function primeiraConsulta(p: PlanoPaciente) { return p.eventos[0].data; }
function ativa(p: PlanoPaciente) { return p.dum >= addDias(HOJE, -280); }
function temLaudoDmg(p: PlanoPaciente) { return eventosComLaudo(p).some((e) => DMG.has(e.cenario!)); }

function metricasUnidade(ps: PlanoPaciente[]) {
  const ativas = ps.filter(ativa);
  const prevalencia = (ativas.filter(temLaudoDmg).length / ativas.length) * 100;
  // GestaoEquipePage: 1º laudo nos últimos 90 dias − 1ª consulta.
  const deltas = ps
    .map((p) => ({ p, l: eventosComLaudo(p)[0] }))
    .filter(({ l }) => l && l.data >= addDias(HOJE, -90))
    .map(({ p, l }) => diffDias(l!.data, primeiraConsulta(p)));
  const tempo = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return { total: ps.length, ativas: ativas.length, prevalencia, tempo, nTempo: deltas.length };
}

describe('plano da Rede Demonstração', () => {
  const rede = planejarRede(HOJE);
  const todos = Object.values(rede).flat();
  const m = Object.fromEntries(Object.entries(rede).map(([k, ps]) => [k, metricasUnidade(ps)]));

  it('imprime o resumo por unidade', () => {
    console.table(m);
    expect(todos.length).toBeGreaterThan(0);
  });

  it('≈120 gestantes, distribuídas de forma desigual', () => {
    expect(todos.length).toBeGreaterThanOrEqual(110);
    expect(todos.length).toBeLessThanOrEqual(130);
    const tamanhos = Object.values(rede).map((ps) => ps.length);
    expect(new Set(tamanhos).size).toBeGreaterThan(3);
  });

  it('é determinístico', () => {
    expect(planejarRede(HOJE)).toEqual(rede);
  });

  it('nomes fictícios únicos, sem CPF', () => {
    expect(new Set(todos.map((p) => p.nome)).size).toBe(todos.length);
    for (const p of todos) expect(p.identificacao).toMatch(/^DEMO-\d{4}$/);
  });

  it('datas: últimos ~6 meses, nada no futuro, em ordem, IG coerente', () => {
    for (const p of todos) {
      let anterior = '0000-00-00';
      for (const e of p.eventos) {
        expect(e.data <= addDias(HOJE, -1)).toBe(true);
        expect(e.data >= addDias(HOJE, -182)).toBe(true);
        expect(e.data >= anterior).toBe(true);
        anterior = e.data;
        expect(diffDias(e.data, p.dum)).toBeGreaterThan(0);
      }
      expect(p.eventos[0].tipo).toBe('caso_novo');
    }
  });

  it('cobre todas as etapas', () => {
    const status = new Set(todos.map((p) => {
      const s = estadoFinal(p);
      return s.motivo_encerramento ? `encerrada:${s.motivo_encerramento}` : s.status_ficha;
    }));
    for (const s of ['aguardando_gj', 'aguardando_gtt', 'dmg_confirmado', 'dmg_afastado',
      'encerrada:insulinizacao', 'encerrada:parto', 'encerrada:nao_retornou', 'encerrada:aborto']) {
      expect(status, s).toContain(s);
    }
    // em tratamento = DMG confirmado com pelo menos um perfil glicêmico
    expect(todos.some((p) => estadoFinal(p).status_ficha === 'dmg_confirmado'
      && !estadoFinal(p).motivo_encerramento && p.eventos.some((e) => e.tipo === 'ficha_ac'))).toBe(true);
  });

  it('jornadas de insulina saem da regra (regra_3 → ficha B/D) e as de MEV mantêm', () => {
    for (const p of todos) {
      for (const e of p.eventos) {
        if (e.tipo !== 'ficha_ac') continue;
        if (p.jornada.includes('insulina')) expect(e.decisao.regra_aplicada).toBe('regra_3');
        else expect(e.decisao.regra_aplicada).toBe('regra_manter');
      }
    }
  });

  it('Centro: tempo até o 1º laudo ≤ 14 dias (melhor da rede)', () => {
    expect(m.centro.tempo).not.toBeNull();
    expect(m.centro.tempo!).toBeLessThanOrEqual(14);
    for (const k of ['norte', 'sul', 'leste', 'oeste']) {
      if (m[k].tempo != null) expect(m.centro.tempo!).toBeLessThan(m[k].tempo!);
    }
  });

  it('Sul: tempo até o 1º laudo > 30 dias e diagnóstico tardio (6B)', () => {
    expect(m.sul.tempo!).toBeGreaterThan(30);
    expect(rede.sul.some((p) => eventosComLaudo(p).some((e) => e.cenario === '6B'))).toBe(true);
  });

  it('Leste: prevalência bem abaixo da faixa 7–18%; demais dentro dela', () => {
    expect(m.leste.prevalencia).toBeLessThan(5);
    for (const k of ['centro', 'norte', 'sul', 'oeste']) {
      expect(m[k].prevalencia, k).toBeGreaterThanOrEqual(7);
      expect(m[k].prevalencia, k).toBeLessThanOrEqual(18);
    }
  });

  it('profissional sem uso recente: nada nos últimos 60 dias', () => {
    const semUso = UNIDADES.flatMap((u) => u.profissionais.filter((p) => p.semUsoRecente));
    expect(semUso.length).toBe(1);
    const dele = todos.filter((p) => p.profissional === semUso[0].chave);
    expect(dele.length).toBeGreaterThan(0);
    for (const p of dele) for (const e of p.eventos) expect(e.data < addDias(HOJE, -60)).toBe(true);
  });

  it('Norte sem endocrinologista; demais com', () => {
    for (const u of UNIDADES) {
      const temEndo = u.profissionais.some((p) => /endocrin/i.test(p.especialidade));
      expect(temEndo, u.nome).toBe(u.chave !== 'norte');
    }
  });

  it('histórico: laudos espalhados pelos últimos 6 meses', () => {
    const meses = new Set(todos.flatMap((p) => eventosComLaudo(p).map((e) => e.data.slice(0, 7))));
    expect(meses.size).toBeGreaterThanOrEqual(6);
  });
});
