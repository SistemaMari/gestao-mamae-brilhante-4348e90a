import { describe, expect, it } from "vitest";
import {
  BASE_MINIMA_META,
  agruparMetas,
  avaliarIndicador,
  avaliarMeta,
  lerValorMeta,
  metasDaSelecao,
  resumoMetas,
  temMetas,
  valorDoIndicador,
} from "./metas";
import type { LinhaCuidadoBloco } from "./linhaCuidado";

function bloco(over: Partial<{ antes: number | null; comIg: number; perda: number | null; diag: number; completo: number | null; comPerfil: number; meta: number | null; gjGtt: number | null; gjGttN: number }> = {}): LinhaCuidadoBloco {
  const o = { antes: 80, comIg: 10, perda: 5, diag: 10, completo: 70, comPerfil: 8, meta: 75, gjGtt: 30, gjGttN: 12, ...over };
  return {
    periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
    criterios: { perfil_min_dias: 7, meta_pct: 70, ig_limite_semanas: 28, provisorio: true },
    funil: {
      rastreadas: 50,
      diagnosticadas: o.diag,
      em_acompanhamento: 0,
      encerradas: { insulinizacao: 0, parto: 0, aborto: 0, nao_retornou: 0, outro: 0 },
      encerradas_total: 0,
      taxa_diagnostico_pct: 20,
      perda_seguimento_pct: o.perda,
    },
    adesao: {
      diagnosticadas: o.diag,
      com_perfil: o.comPerfil,
      com_perfil_completo: 0,
      perfil_completo_pct: o.completo,
      ultimo_na_meta: 0,
      ultimo_na_meta_pct: o.meta,
    },
    tempos: {
      gj_gtt_mediana_dias: o.gjGtt,
      gj_gtt_n: o.gjGttN,
      diag_perfil_mediana_dias: null,
      diag_perfil_n: 0,
      diag_insulina_mediana_dias: null,
      diag_insulina_n: 0,
      diag_com_ig: o.comIg,
      diag_antes_28s: 0,
      diag_antes_28s_pct: o.antes,
    },
    perfil_gestantes: {
      atendidas: 0,
      faixas_idade: { menos_20: 0, de_20_34: 0, de_35_39: 0, mais_40: 0, sem_info: 0 },
      dmg_anterior: 0,
      dmg_anterior_pct: null,
    },
  };
}

describe("avaliarMeta", () => {
  it("mínimo: atinge quando valor ≥ meta (inclusive igual)", () => {
    expect(avaliarMeta(80, 10, 80, "minimo")).toBe("atingida");
    expect(avaliarMeta(90, 10, 80, "minimo")).toBe("atingida");
    expect(avaliarMeta(79.9, 10, 80, "minimo")).toBe("nao_atingida");
  });
  it("máximo: atinge quando valor ≤ meta (inclusive igual)", () => {
    expect(avaliarMeta(10, 10, 10, "maximo")).toBe("atingida");
    expect(avaliarMeta(0, 10, 10, "maximo")).toBe("atingida");
    expect(avaliarMeta(10.1, 10, 10, "maximo")).toBe("nao_atingida");
  });
  it("sem meta → sem selo, mesmo sem dados", () => {
    expect(avaliarMeta(50, 10, null, "minimo")).toBe("sem_meta");
    expect(avaliarMeta(null, 0, undefined, "maximo")).toBe("sem_meta");
  });
  it("sem dados (valor nulo ou base 0)", () => {
    expect(avaliarMeta(null, 10, 50, "minimo")).toBe("sem_dados");
    expect(avaliarMeta(0, 0, 10, "maximo")).toBe("sem_dados");
  });
  it(`poucos dados quando base < ${BASE_MINIMA_META}`, () => {
    expect(avaliarMeta(100, BASE_MINIMA_META - 1, 50, "minimo")).toBe("poucos_dados");
    expect(avaliarMeta(100, BASE_MINIMA_META, 50, "minimo")).toBe("atingida");
    expect(avaliarMeta(0, 1, 10, "maximo")).toBe("poucos_dados");
  });
  it("meta 0 é meta válida", () => {
    expect(avaliarMeta(0, 10, 0, "maximo")).toBe("atingida");
    expect(avaliarMeta(1, 10, 0, "maximo")).toBe("nao_atingida");
  });
  it("aceita números vindos como string do banco", () => {
    expect(avaliarMeta("30.5" as unknown as number, 10, "30" as unknown as number, "maximo")).toBe("nao_atingida");
  });
});

describe("valorDoIndicador / avaliarIndicador", () => {
  it("cada indicador usa a sua base", () => {
    const b = bloco({ comIg: 3, diag: 9, comPerfil: 2, gjGttN: 7 });
    expect(valorDoIndicador(b, "diag_antes_28s_pct")).toEqual({ valor: 80, base: 3 });
    expect(valorDoIndicador(b, "perda_seguimento_pct")).toEqual({ valor: 5, base: 9 });
    expect(valorDoIndicador(b, "perfil_completo_pct")).toEqual({ valor: 70, base: 9 });
    expect(valorDoIndicador(b, "ultimo_na_meta_pct")).toEqual({ valor: 75, base: 2 });
    expect(valorDoIndicador(b, "gj_gtt_mediana_dias")).toEqual({ valor: 30, base: 7 });
  });
  it("aplica o sentido de cada indicador", () => {
    const b = bloco();
    const metas = { perda_seguimento_pct: 4, gj_gtt_mediana_dias: 45, diag_antes_28s_pct: 85 };
    expect(avaliarIndicador(b, "perda_seguimento_pct", metas).situacao).toBe("nao_atingida"); // 5% > teto 4%
    expect(avaliarIndicador(b, "gj_gtt_mediana_dias", metas).situacao).toBe("atingida"); // 30 d ≤ 45 d
    expect(avaliarIndicador(b, "diag_antes_28s_pct", metas).situacao).toBe("nao_atingida"); // 80% < 85%
    expect(avaliarIndicador(b, "perfil_completo_pct", metas)).toMatchObject({ situacao: "sem_meta", meta: null });
    expect(avaliarIndicador(b, "perfil_completo_pct", null).situacao).toBe("sem_meta");
  });
  it("resumoMetas conta só as avaliáveis", () => {
    const b = bloco({ comPerfil: 2 });
    const r = resumoMetas(b, { perda_seguimento_pct: 10, ultimo_na_meta_pct: 50, diag_antes_28s_pct: 90 });
    expect(r).toEqual({ definidas: 3, avaliadas: 2, atingidas: 1 });
    expect(resumoMetas(b, {})).toEqual({ definidas: 0, avaliadas: 0, atingidas: 0 });
  });
});

describe("lerValorMeta", () => {
  it("vazio = sem meta", () => {
    expect(lerValorMeta("  ", "perfil_completo_pct")).toEqual({ valor: null, erro: null });
  });
  it("aceita vírgula e arredonda para 1 casa", () => {
    expect(lerValorMeta("85,25", "perfil_completo_pct")).toEqual({ valor: 85.3, erro: null });
    expect(lerValorMeta("30", "gj_gtt_mediana_dias")).toEqual({ valor: 30, erro: null });
  });
  it("recusa texto, negativo e fora da faixa", () => {
    expect(lerValorMeta("abc", "perfil_completo_pct").erro).toBe("invalido");
    expect(lerValorMeta("-1", "perfil_completo_pct").erro).toBe("invalido");
    expect(lerValorMeta("101", "perfil_completo_pct").erro).toBe("faixa");
    expect(lerValorMeta("366", "gj_gtt_mediana_dias").erro).toBe("faixa");
    expect(lerValorMeta("200", "gj_gtt_mediana_dias").erro).toBe(null);
  });
});

describe("agruparMetas / metasDaSelecao", () => {
  const metas = agruparMetas([
    { contratante_id: "A", indicador: "perda_seguimento_pct", valor: "10" },
    { contratante_id: "A", indicador: "gj_gtt_mediana_dias", valor: 30 },
    { contratante_id: "B", indicador: "perfil_completo_pct", valor: 70 },
    { contratante_id: "B", indicador: "desconhecido", valor: 1 },
  ]);
  it("temMetas", () => {
    expect(temMetas(metas.A)).toBe(true);
    expect(temMetas({})).toBe(false);
    expect(temMetas(null)).toBe(false);
  });
  it("agrupa por rede e converte para número", () => {
    expect(metas).toEqual({ A: { perda_seguimento_pct: 10, gj_gtt_mediana_dias: 30 }, B: { perfil_completo_pct: 70 } });
    expect(agruparMetas(null)).toEqual({});
  });
  const rede = { u1: "A", u2: "A", u3: "B" };
  it("todas as unidades da mesma rede → metas dela", () => {
    expect(metasDaSelecao(["u1", "u2"], rede, metas)).toEqual({ redeId: "A", metas: metas.A, variasRedes: false });
  });
  it("rede sem metas → objeto vazio (sem selo)", () => {
    expect(metasDaSelecao(["u1"], { u1: "C" }, metas)).toEqual({ redeId: "C", metas: {}, variasRedes: false });
  });
  it("redes diferentes → sem metas no consolidado", () => {
    expect(metasDaSelecao(["u1", "u3"], rede, metas)).toEqual({ redeId: null, metas: null, variasRedes: true });
  });
  it("sem unidades / rede desconhecida", () => {
    expect(metasDaSelecao([], rede, metas)).toEqual({ redeId: null, metas: null, variasRedes: false });
  });
});
