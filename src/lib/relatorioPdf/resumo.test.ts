import { describe, expect, it } from 'vitest';
import type { LinhaCuidadoBloco } from '@/lib/linhaCuidado';
import { resumoRede, resumoUnidade } from './resumo';
import { dias, ig, pct, periodoTexto, seloMeta, variacao } from './formatos';

const bloco = (over: Partial<LinhaCuidadoBloco['funil']> = {}): LinhaCuidadoBloco => ({
  periodo: { inicio: '2026-07-01', fim: '2026-09-30' },
  criterios: { perfil_min_dias: 7, meta_pct: 70, ig_limite_semanas: 28, provisorio: true },
  funil: {
    rastreadas: 26,
    diagnosticadas: 5,
    em_acompanhamento: 3,
    encerradas: { insulinizacao: 1, parto: 0, aborto: 0, nao_retornou: 1, outro: 0 },
    encerradas_total: 2,
    taxa_diagnostico_pct: 19.2,
    perda_seguimento_pct: 20,
    ...over,
  },
  adesao: { diagnosticadas: 5, com_perfil: 2, com_perfil_completo: 1, perfil_completo_pct: 20, ultimo_na_meta: 1, ultimo_na_meta_pct: 50 },
  tempos: {
    gj_gtt_mediana_dias: 69,
    gj_gtt_n: 16,
    diag_perfil_mediana_dias: 5,
    diag_perfil_n: 1,
    diag_insulina_mediana_dias: 16,
    diag_insulina_n: 1,
    diag_com_ig: 5,
    diag_antes_28s: 5,
    diag_antes_28s_pct: 100,
  },
  perfil_gestantes: { atendidas: 47, faixas_idade: { menos_20: 0, de_20_34: 30, de_35_39: 17, mais_40: 0, sem_info: 0 }, dmg_anterior: 7, dmg_anterior_pct: 14.9 },
});

const gargalos = { sem_gj_primeira_consulta: 15, atrasadas_gtt: 5, confirmadas_sem_retorno: 1 };

describe('resumo do relatório', () => {
  it('unidade: operação, taxa com leitura da faixa, perda de seguimento, adesão e pendências', () => {
    const f = resumoUnidade({ unidadeNome: 'Unidade Norte', gestantesAtivas: 13, laudosPeriodo: 1, linhaCuidado: bloco(), metas: null, gargalos, faixa: [7, 18] });
    expect(f[0]).toBe('A unidade Unidade Norte acompanha hoje 13 gestantes ativas e emitiu 1 laudo no período.');
    expect(f[1]).toContain('taxa de diagnóstico de 19,2%, acima da faixa esperada (7–18%)');
    expect(f[2]).toBe('1 de 5 gestantes com diabetes pararam de vir (perda de seguimento de 20%).');
    expect(f.some((x) => x.startsWith('Pendências de hoje na unidade: 15 sem glicemia de jejum, 5 com a curva glicêmica (GTT) em atraso, 1 com diabetes e sem retorno.'))).toBe(true);
    expect(f.some((x) => x.startsWith('Metas da rede'))).toBe(false);
  });

  it('sem perda de seguimento e sem pendências', () => {
    const f = resumoUnidade({
      unidadeNome: 'U',
      gestantesAtivas: 1,
      laudosPeriodo: 0,
      linhaCuidado: bloco({ perda_seguimento_pct: 0, encerradas: { insulinizacao: 0, parto: 0, aborto: 0, nao_retornou: 0, outro: 0 } }),
      metas: null,
      gargalos: { sem_gj_primeira_consulta: 0, atrasadas_gtt: 0, confirmadas_sem_retorno: 0 },
      faixa: [7, 18],
    });
    expect(f[0]).toContain('1 gestante ativa e emitiu 0 laudos');
    expect(f).toContain('Nenhuma gestante com diabetes deixou de voltar (perda de seguimento de 0%).');
    expect(f[f.length - 1]).toBe('Hoje não há gestantes paradas em nenhuma das 3 pendências acompanhadas na unidade.');
  });

  it('rede: metas avaliadas, quem mais diagnosticou e alertas', () => {
    const f = resumoRede({
      redeNome: 'Rede Demo',
      totalUnidades: 5,
      gestantesAtivas: 62,
      laudosPeriodo: 19,
      linhaCuidado: bloco(),
      metas: { perda_seguimento_pct: 10, gj_gtt_mediana_dias: 70, diag_antes_28s_pct: 90 },
      gargalos,
      maisDiagnostica: { unidade_nome: 'Unidade Oeste', diagnosticos: 2 },
      alertas: 1,
      faixa: [7, 18],
    });
    expect(f[0]).toBe('A rede Rede Demo (5 unidades) acompanha hoje 62 gestantes ativas e emitiu 19 laudos no período.');
    expect(f).toContain('Metas da rede: 2 de 3 metas avaliadas foram atingidas.');
    expect(f).toContain('A unidade que mais diagnosticou foi Unidade Oeste (2 diagnósticos).');
    expect(f[f.length - 1]).toBe('1 alerta operacional pede atenção (detalhes na seção de alertas).');
  });
});

describe('formatos do relatório', () => {
  it('números, dias, IG e período', () => {
    expect(pct(19.25)).toBe('19,3%');
    expect(pct(null)).toBe('—');
    expect(dias(1)).toBe('1 dia');
    expect(dias(69)).toBe('69 dias');
    expect(ig(137)).toBe('19 sem 4 d');
    expect(periodoTexto({ inicio: '2026-07-14', fim: '2026-10-11' })).toBe('14/07/2026 a 11/10/2026');
  });

  it('variação com o tom certo (perda de seguimento subindo é ruim)', () => {
    expect(variacao(20, 10, 'pct', 'ruim_subir')).toEqual({ texto: '+10 p.p. vs. período anterior', tom: 'ruim' });
    expect(variacao(69, 65, 'dias', 'ruim_subir')).toEqual({ texto: '+4 dias vs. período anterior', tom: 'ruim' });
    expect(variacao(5, 5, 'contagem', 'neutro')).toEqual({ texto: 'igual ao período anterior', tom: 'neutro' });
    expect(variacao(null, 5, 'contagem', 'neutro')).toBeNull();
  });

  it('selo da meta: atingida, acima do limite, poucos dados e sem meta', () => {
    const b = bloco();
    expect(seloMeta(b, 'gj_gtt_mediana_dias', { gj_gtt_mediana_dias: 70 })).toEqual({ texto: 'Meta atingida', tom: 'bom', meta: 'Meta: máximo 70 dias' });
    expect(seloMeta(b, 'gj_gtt_mediana_dias', { gj_gtt_mediana_dias: 60 })?.texto).toBe('Acima do limite');
    expect(seloMeta(b, 'ultimo_na_meta_pct', { ultimo_na_meta_pct: 80 })?.texto).toBe('Poucos dados');
    expect(seloMeta(b, 'perfil_completo_pct', {})).toBeNull();
  });
});
