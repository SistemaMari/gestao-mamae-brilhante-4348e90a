import { describe, it, expect } from 'vitest';
import {
  idadeNaData,
  faixaEtaria,
  perfilGestantes,
  controleGlicemico,
  extrairPartos,
  desfechosParto,
  engajamento,
  type PacienteMetrica,
  type ConsultaMetrica,
} from './dashboardConsultorioMetricas';

const pac = (id: string, extra: Partial<PacienteMetrica> = {}): PacienteMetrica => ({
  id,
  created_at: '2026-06-01T12:00:00Z',
  ...extra,
});

describe('idade e faixa etária', () => {
  it('calcula idade completa e descarta datas absurdas', () => {
    expect(idadeNaData('1990-06-02', new Date(2026, 5, 1))).toBe(35);
    expect(idadeNaData('1990-06-01', new Date(2026, 5, 1))).toBe(36);
    expect(idadeNaData('2024-01-01', new Date(2026, 5, 1))).toBeNull();
    expect(idadeNaData(null, new Date())).toBeNull();
  });
  it('agrupa nas faixas', () => {
    expect(faixaEtaria(24)).toBe('<25');
    expect(faixaEtaria(30)).toBe('30–34');
    expect(faixaEtaria(41)).toBe('≥40');
  });
});

describe('perfilGestantes', () => {
  const pacientes = [
    pac('a', { data_nascimento: '1994-01-01', dmg_gestacao_anterior: true }), // 32
    pac('b', { data_nascimento: '1993-01-01' }), // 33
    pac('c', { data_nascimento: '2004-01-01' }), // 22
    pac('d', { data_nascimento: '2003-01-01' }), // 23
    pac('e', { data_nascimento: '1985-01-01', dmg_gestacao_anterior: true }), // 41 — sozinha na faixa
  ];
  const dmg = new Set(['a', 'b', 'c', 'e']);
  const consultas: ConsultaMetrica[] = [
    { id: '1', paciente_id: 'a', tipo: 'retorno_1', cenario_clinico: '1', data: '2026-06-10', ig_semanas: 12, ig_dias: 0 },
    { id: '2', paciente_id: 'b', tipo: 'gtt', cenario_clinico: '6', data: '2026-07-10', ig_semanas: 26, ig_dias: 0 },
    { id: '3', paciente_id: 'b', tipo: 'ficha_a', cenario_clinico: '2', data: '2026-07-20', ig_semanas: 28, ig_dias: 0 },
  ];
  const r = perfilGestantes(pacientes, (p) => dmg.has(p.id), consultas);

  it('faixa de maior prevalência ignora faixa com 1 gestante só', () => {
    expect(r.faixaMaiorPrevalencia?.faixa).toBe('30–34');
    expect(r.faixaMaiorPrevalencia?.dmg).toBe(2);
  });
  it('DMG em gestação anterior entre as DMG', () => {
    expect(r.dmgComAnterior.map((p) => p.id)).toEqual(['a', 'e']);
    expect(r.comDmgAnterior).toHaveLength(2);
  });
  it('IG média no diagnóstico usa só a consulta diagnóstica', () => {
    expect(r.igMediaDiagnostico).toBe(19);
    expect(r.comIgDiagnostico).toBe(2);
  });
});

describe('controleGlicemico', () => {
  it('separa dieta × insulina, pega o último perfil e os dias até a insulina', () => {
    const dmg = [pac('a'), pac('b', { data_encerramento: '2026-07-30' })];
    const r = controleGlicemico(
      dmg,
      new Set(['b']),
      [
        { paciente_id: 'a', percentual_meta: 50, data_inicio: '2026-06-10', created_at: '2026-06-10' },
        { paciente_id: 'a', percentual_meta: 90, data_inicio: '2026-06-24', created_at: '2026-06-24' },
        { paciente_id: 'b', percentual_meta: 40, data_inicio: '2026-07-15', created_at: '2026-07-15' },
      ],
      [{ id: '1', paciente_id: 'b', tipo: 'gtt', cenario_clinico: '6B', data: '2026-07-10' }],
    );
    expect(r.soDieta.map((p) => p.id)).toEqual(['a']);
    expect(r.comInsulina.map((p) => p.id)).toEqual(['b']);
    expect(r.mediaNaMeta).toBe(65);
    expect(r.diasAteInsulina).toBe(20);
  });
});

describe('partos', () => {
  const consultas: ConsultaMetrica[] = [
    {
      id: 'p', paciente_id: 'a', tipo: 'registro_parto', cenario_clinico: '5',
      observacoes: JSON.stringify({
        via_parto: 'cesarea', ig_semanas: 36, ig_dias: 2, peso_rn_g: 4100,
        classificacao_rn: 'GIG', intercorrencias_maternas: false, intercorrencias_neonatais: true,
        aleitamento_sala_parto: true,
      }),
    },
    { id: 'x', paciente_id: 'b', tipo: 'registro_parto', cenario_clinico: '5', observacoes: 'texto livre' },
  ];
  const partos = extrairPartos(consultas, [
    { paciente_id: 'a', via_parto: 'vaginal', classificacao_rn: 'AIG', peso_rn_g: 3000, ig_parto_semanas: 39, ig_parto_dias: 0, intercorrencia_materna: false, intercorrencia_neonatal: false },
    { paciente_id: 'c', via_parto: 'vaginal', classificacao_rn: 'AIG', peso_rn_g: 3200, ig_parto_semanas: 39, ig_parto_dias: 0, intercorrencia_materna: true, intercorrencia_neonatal: false },
  ]);

  it('prefere o registro do app e completa com a tabela partos', () => {
    expect(partos).toHaveLength(2);
    expect(partos.find((p) => p.paciente_id === 'a')?.via_parto).toBe('cesarea');
  });
  it('resume os desfechos', () => {
    const d = desfechosParto(partos);
    expect(d.total).toBe(2);
    expect(d.cesarea).toHaveLength(1);
    expect(d.prematuros).toHaveLength(1);
    expect(d.macrossomia).toHaveLength(1);
    expect(d.pesoMedio).toBe(3650);
    expect(d.gig).toHaveLength(1);
    expect(d.intercorrenciaMaterna).toHaveLength(1);
    expect(d.aleitamento).toBe(1);
    expect(d.comAleitamento).toBe(1);
  });
});

describe('engajamento', () => {
  it('conta consultas/perfis do grupo e o tempo médio de acompanhamento', () => {
    const pacientes = [
      pac('a', { created_at: '2026-06-01T12:00:00Z' }),
      pac('b', { created_at: '2026-06-01T12:00:00Z', data_encerramento: '2026-06-15' }),
    ];
    const r = engajamento(
      pacientes,
      [
        { id: '1', paciente_id: 'a', tipo: 'consulta_1', cenario_clinico: null },
        { id: '2', paciente_id: 'b', tipo: 'consulta_1', cenario_clinico: null },
        { id: '3', paciente_id: 'z', tipo: 'consulta_1', cenario_clinico: null },
      ],
      [{ paciente_id: 'a', percentual_meta: 80, created_at: '2026-06-10' }],
      1,
      (p) => p.id === 'b',
      new Date('2026-06-29T12:00:00Z'),
    );
    expect(r.consultas).toBe(2);
    expect(r.consultasPorGestante).toBe(1);
    expect(r.perfisPorDmg).toBe(1);
    expect(r.semanasAcompanhamento).toBeCloseTo(3, 0);
  });
});
