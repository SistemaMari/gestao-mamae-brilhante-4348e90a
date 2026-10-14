// Especificação da "Rede Demonstração MARI" — organização fictícia, isolada,
// usada só para capturas de tela e apresentações comerciais.
//
// Tudo o que a carga cria é identificado por esta especificação (CNPJ fixo,
// e-mails fixos no domínio DOMINIO_EMAIL, unidades ligadas ao contratante da
// rede). A limpeza (seed-rede-demo-cleanup) usa as MESMAS chaves — nada fora
// delas é lido, alterado ou apagado.

export const DOMINIO_EMAIL = 'demo.mari.health';
const email = (local: string) => `${local}@${DOMINIO_EMAIL}`;

export const CONTRATANTE = {
  nome: 'Rede Demonstração MARI',
  // CNPJ propositalmente inválido/fictício (não pertence a ninguém).
  cnpj: '99.999.999/0001-99',
  razao_social: 'Rede Demonstração MARI (organização fictícia)',
  contato_nome: 'Regina Demonstração',
  contato_email: email('gestora.geral'),
};

export const GESTOR_GERAL = {
  email: email('gestora.geral'),
  nome: 'Regina Demonstração',
};

export type Especialidade =
  | 'Ginecologista-Obstetra'
  | 'Endocrinologista'
  | 'Clínico Geral'
  | 'Médico de Família'
  | 'Enfermeiro(a) Obstétrica';

export interface ProfissionalSpec {
  chave: string;
  nome: string;
  email: string;
  crm: string;
  especialidade: Especialidade;
  perfil_clinico: 'medico' | 'enfermeiro';
  /** Profissional que entrou na rede mas parou de usar (sem atividade há > 60 dias). */
  semUsoRecente?: boolean;
}

export type Jornada =
  | 'aguardando_gj'        // Caso Novo feito, aguardando glicemia de jejum
  | 'aguardando_gtt'       // GJ normal, aguardando GTT 75g (ainda antes de 28 sem)
  | 'gtt_atrasado'         // GJ normal, passou de 28 sem sem GTT (gargalo)
  | 'afastado'             // GJ normal + GTT normal → DMG afastado
  | 'dmg_recente'          // DMG pela GJ, aguardando o 1º perfil glicêmico
  | 'dmg_tratamento'       // DMG pela GJ + perfis com controle adequado (MEV)
  | 'dmg_gtt_tratamento'   // DMG pelo GTT + perfis com controle adequado
  | 'dmg_insulina'         // DMG pela GJ + perfil inadequado → indicação de insulina
  | 'dmg_gtt_insulina'     // DMG pelo GTT + perfil inadequado → indicação de insulina
  | 'dmg_parto'            // DMG pela GJ, tratada com MEV até o parto (encerrada)
  | 'dmg_gtt_parto'        // DMG pelo GTT, tratada com MEV até o parto (encerrada)
  | 'overt'                // GJ ≥ 126 → diabetes prévio (overt)
  | 'nao_retornou'         // GJ normal e a gestante não voltou (encerrada)
  | 'aborto';              // encerrada por aborto

export interface PerfilUnidade {
  /** Dias entre o Caso Novo e o Retorno 1 (resultado da GJ). */
  gapRetorno1: [number, number];
  /** IG (semanas) no Caso Novo das gestantes que fecham diagnóstico pelo GTT. */
  igCasoNovoGtt: [number, number];
  /** Dias entre o Retorno 1 normal e o GTT, para as que fazem GTT. */
  gapGtt: [number, number];
  /** GTT feito depois de 28 semanas (diagnóstico tardio → cenário 6B). */
  gttTardio: boolean;
}

export interface UnidadeSpec {
  chave: string;
  nome: string;
  /** Gestor de unidade: cargo administrativo — não atende gestantes, sem CRM. */
  gestor: { nome: string; email: string };
  profissionais: ProfissionalSpec[];
  /** Convites ainda não aceitos (aparecem como "pendentes" na tela de equipe). */
  convitesPendentes: string[];
  perfil: PerfilUnidade;
  composicao: Partial<Record<Jornada, number>>;
}

const prof = (
  chave: string, nome: string, especialidade: Especialidade, n: number, extra: Partial<ProfissionalSpec> = {},
): ProfissionalSpec => ({
  chave,
  nome,
  email: email(chave),
  crm: especialidade === 'Enfermeiro(a) Obstétrica' ? `COREN DEMO ${n}` : `CRM DEMO ${n}`,
  especialidade,
  perfil_clinico: especialidade === 'Enfermeiro(a) Obstétrica' ? 'enfermeiro' : 'medico',
  ...extra,
});

export const UNIDADES: UnidadeSpec[] = [
  {
    // A melhor da rede: diagnóstico rápido (tempo até o 1º laudo ≤ 14 dias).
    chave: 'centro',
    nome: 'Unidade Centro',
    gestor: { nome: 'Paulo Exemplo', email: email('gestor.centro') },
    profissionais: [
      prof('helena.modelo', 'Dra. Helena Modelo', 'Ginecologista-Obstetra', 1001),
      prof('marcos.amostra', 'Dr. Marcos Amostra', 'Endocrinologista', 1002),
      prof('lucia.ficticia', 'Dra. Lúcia Fictícia', 'Médico de Família', 1003),
      prof('renata.simulada', 'Renata Simulada', 'Enfermeiro(a) Obstétrica', 1004),
    ],
    convitesPendentes: [],
    perfil: { gapRetorno1: [5, 9], igCasoNovoGtt: [23, 24], gapGtt: [4, 6], gttTardio: false },
    composicao: {
      aguardando_gj: 4, aguardando_gtt: 9, afastado: 11, nao_retornou: 2, aborto: 1,
      dmg_recente: 1, dmg_tratamento: 1, dmg_gtt_tratamento: 1, dmg_gtt_parto: 1,
    },
  },
  {
    // Sem endocrinologista na equipe (há um convite pendente para um).
    chave: 'norte',
    nome: 'Unidade Norte',
    gestor: { nome: 'Sandra Exemplo', email: email('gestor.norte') },
    profissionais: [
      prof('beatriz.modelo', 'Dra. Beatriz Modelo', 'Ginecologista-Obstetra', 2001),
      prof('rafael.amostra', 'Dr. Rafael Amostra', 'Clínico Geral', 2002),
      prof('camila.simulada', 'Camila Simulada', 'Enfermeiro(a) Obstétrica', 2003),
    ],
    convitesPendentes: [email('endocrino.convidado.norte')],
    perfil: { gapRetorno1: [12, 18], igCasoNovoGtt: [20, 21], gapGtt: [5, 9], gttTardio: false },
    composicao: {
      aguardando_gj: 3, aguardando_gtt: 6, gtt_atrasado: 1, afastado: 8, nao_retornou: 2, overt: 1,
      dmg_recente: 1, dmg_tratamento: 1, dmg_gtt_insulina: 1, dmg_gtt_parto: 1,
    },
  },
  {
    // Diagnóstico tardio: tempo até o 1º laudo acima de 30 dias, GTT depois de 28 sem.
    chave: 'sul',
    nome: 'Unidade Sul',
    gestor: { nome: 'André Exemplo', email: email('gestor.sul') },
    profissionais: [
      prof('patricia.modelo', 'Dra. Patrícia Modelo', 'Ginecologista-Obstetra', 3001),
      prof('eduardo.amostra', 'Dr. Eduardo Amostra', 'Endocrinologista', 3002),
      prof('fernanda.ficticia', 'Dra. Fernanda Fictícia', 'Médico de Família', 3003),
    ],
    convitesPendentes: [],
    perfil: { gapRetorno1: [34, 46], igCasoNovoGtt: [14, 17], gapGtt: [60, 80], gttTardio: true },
    composicao: {
      aguardando_gj: 2, aguardando_gtt: 5, gtt_atrasado: 2, afastado: 11, nao_retornou: 2, aborto: 1,
      dmg_recente: 1, dmg_gtt_tratamento: 1, dmg_gtt_insulina: 1, dmg_parto: 1,
    },
  },
  {
    // Taxa de diagnóstico bem abaixo da faixa esperada (subnotificação).
    chave: 'leste',
    nome: 'Unidade Leste',
    gestor: { nome: 'Cláudia Exemplo', email: email('gestor.leste') },
    profissionais: [
      prof('roberto.amostra', 'Dr. Roberto Amostra', 'Clínico Geral', 4001),
      prof('juliana.modelo', 'Dra. Juliana Modelo', 'Médico de Família', 4002),
      prof('tiago.ficticio', 'Dr. Tiago Fictício', 'Endocrinologista', 4003),
      prof('aline.simulada', 'Aline Simulada', 'Enfermeiro(a) Obstétrica', 4004),
    ],
    convitesPendentes: [email('enfermagem.convidada.leste')],
    perfil: { gapRetorno1: [10, 16], igCasoNovoGtt: [21, 22], gapGtt: [5, 9], gttTardio: false },
    composicao: {
      aguardando_gj: 4, aguardando_gtt: 9, gtt_atrasado: 2, afastado: 10, nao_retornou: 2, aborto: 1,
      dmg_tratamento: 1,
    },
  },
  {
    // Unidade menor; um profissional sem uso recente.
    chave: 'oeste',
    nome: 'Unidade Oeste',
    gestor: { nome: 'Sérgio Exemplo', email: email('gestor.oeste') },
    profissionais: [
      prof('carla.modelo', 'Dra. Carla Modelo', 'Ginecologista-Obstetra', 5001),
      prof('vinicius.amostra', 'Dr. Vinícius Amostra', 'Endocrinologista', 5002),
      prof('gustavo.ficticio', 'Dr. Gustavo Fictício', 'Médico de Família', 5003, { semUsoRecente: true }),
    ],
    convitesPendentes: [],
    perfil: { gapRetorno1: [12, 20], igCasoNovoGtt: [20, 22], gapGtt: [6, 10], gttTardio: false },
    composicao: {
      aguardando_gj: 2, aguardando_gtt: 3, afastado: 5, nao_retornou: 2,
      dmg_recente: 1, dmg_insulina: 1, dmg_gtt_parto: 1,
    },
  },
];

/** Senha única de todas as contas da rede de demonstração. */
export const SENHA_DEMO = 'RedeDemo#Mari2026';

export function todosEmailsDemo(): string[] {
  const out = [GESTOR_GERAL.email];
  for (const u of UNIDADES) {
    out.push(u.gestor.email);
    for (const p of u.profissionais) out.push(p.email);
  }
  return out;
}
