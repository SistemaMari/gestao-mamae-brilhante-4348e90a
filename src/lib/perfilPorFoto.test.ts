import { describe, it, expect } from 'vitest';
import { aplicarLeituraNaGrade, chaveCelula, type ResultadoExtracao } from './perfilPorFoto';

const PONTOS = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'];

const gradeVazia = (dias = 5) =>
  Array.from({ length: dias }, () => Object.fromEntries(PONTOS.map((p) => [p, ''])));

// Período de 5 dias começando em 21/08/2026, como a coluna Data exibe.
const DATAS = ['21/08/2026', '22/08/2026', '23/08/2026', '24/08/2026', '25/08/2026'];

const resultado = (over: Partial<ResultadoExtracao> = {}): ResultadoExtracao => ({
  leituras: [], incertos: [], observacoes: [], ...over,
});

describe('aplicarLeituraNaGrade — encaixe por data', () => {
  it('coloca cada dia lido na linha da data correspondente', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [
        { data: '2026-08-23', jejum: 96, pos_cafe: 112, pos_almoco: 120, pos_jantar: 125 },
      ],
    }), PONTOS);

    expect(r.grid[2].jejum).toBe('96');
    expect(r.grid[2].pos_jantar).toBe('125');
    expect(r.grid[0].jejum).toBe('');
  });

  it('não depende da ordem em que o papel foi lido', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [
        { data: '2026-08-25', jejum: 90 },
        { data: '2026-08-21', jejum: 92 },
      ],
    }), PONTOS);

    expect(r.grid[0].jejum).toBe('92');
    expect(r.grid[4].jejum).toBe('90');
  });

  it('descarta dias fora do período e conta quantos foram', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [
        { data: '2026-08-19', jejum: 88 },   // antes do período
        { data: '2026-08-22', jejum: 92 },
        { data: '2026-09-02', jejum: 91 },   // depois do período
      ],
    }), PONTOS);

    expect(r.relatorio.foraDoPeriodo).toBe(2);
    expect(r.grid[1].jejum).toBe('92');
  });

  it('linha sem data (fora do período monitorado) não recebe nada', () => {
    const datas = ['21/08/2026', '22/08/2026', '', '', ''];
    const r = aplicarLeituraNaGrade(gradeVazia(), datas, resultado({
      leituras: [{ data: '2026-08-23', jejum: 96 }],
    }), PONTOS);

    expect(r.relatorio.foraDoPeriodo).toBe(1);
    expect(r.grid[2].jejum).toBe('');
  });
});

describe('aplicarLeituraNaGrade — o que foi digitado à mão prevalece', () => {
  it('não sobrescreve célula já preenchida pelo profissional', () => {
    const grade = gradeVazia();
    grade[0].jejum = '88';

    const r = aplicarLeituraNaGrade(grade, DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: 92, pos_cafe: 112 }],
    }), PONTOS);

    expect(r.grid[0].jejum).toBe('88');        // preservado
    expect(r.grid[0].pos_cafe).toBe('112');    // vazio, preenchido
    expect(r.relatorio.preservadas).toBe(1);
  });

  it('não altera a grade original (retorna cópia)', () => {
    const grade = gradeVazia();
    aplicarLeituraNaGrade(grade, DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: 92 }],
    }), PONTOS);
    expect(grade[0].jejum).toBe('');
  });
});

describe('aplicarLeituraNaGrade — células que o serviço não leu', () => {
  it('marca como incerta a célula que veio em incertos', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [{ data: '2026-08-22', jejum: null, pos_cafe: 114 }],
      incertos: [{ data: '2026-08-22', ponto: 'jejum', motivo: 'rasura sobre o número' }],
    }), PONTOS);

    expect(r.relatorio.incertas).toEqual([chaveCelula(1, 'jejum')]);
    expect(r.grid[1].jejum).toBe('');
    expect(r.grid[1].pos_cafe).toBe('114');
  });

  it('valor null não preenche e não conta como vindo da foto', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: null, pos_cafe: 112 }],
    }), PONTOS);

    expect(r.relatorio.daFoto).toEqual([chaveCelula(0, 'pos_cafe')]);
  });

  it('incerto de ponto que esta ficha não coleta é ignorado', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      incertos: [{ data: '2026-08-21', ponto: 'pre_almoco', motivo: 'x' }],
    }), PONTOS);

    expect(r.relatorio.incertas).toEqual([]);
  });

  it('incerto em célula que o profissional já preencheu não vira alarme', () => {
    const grade = gradeVazia();
    grade[0].jejum = '88';
    const r = aplicarLeituraNaGrade(grade, DATAS, resultado({
      incertos: [{ data: '2026-08-21', ponto: 'jejum', motivo: 'borrado' }],
    }), PONTOS);

    expect(r.relatorio.incertas).toEqual([]);
  });
});

describe('aplicarLeituraNaGrade — proteções', () => {
  it('ignora ponto que esta ficha não coleta (papel de 6 pontos em ficha de 4)', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: 92, pre_almoco: 88, pre_jantar: 90 }],
    }), PONTOS);

    expect(r.grid[0].jejum).toBe('92');
    expect(r.grid[0].pre_almoco).toBeUndefined();
    expect(r.relatorio.daFoto).toEqual([chaveCelula(0, 'jejum')]);
  });

  it('valor não numérico é descartado em silêncio', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: Number.NaN, pos_cafe: 112 }],
    }), PONTOS);

    expect(r.grid[0].jejum).toBe('');
    expect(r.grid[0].pos_cafe).toBe('112');
  });

  it('arredonda valor decimal', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      leituras: [{ data: '2026-08-21', jejum: 92.4 }],
    }), PONTOS);
    expect(r.grid[0].jejum).toBe('92');
  });

  it('repassa as observações do serviço', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado({
      observacoes: ['O papel registra pós-prandial de 2h; a ficha está pactuada em 1h.'],
    }), PONTOS);
    expect(r.relatorio.observacoes).toHaveLength(1);
  });

  it('leitura vazia não quebra nada', () => {
    const r = aplicarLeituraNaGrade(gradeVazia(), DATAS, resultado(), PONTOS);
    expect(r.relatorio.daFoto).toEqual([]);
    expect(r.relatorio.preservadas).toBe(0);
  });
});
