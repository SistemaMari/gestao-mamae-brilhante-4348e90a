import { describe, expect, it } from "vitest";
import {
  compararIndicador,
  faixaDaIdade,
  faixasComPct,
  formatarComSinal,
  linhasFunil,
  textoVariacao,
} from "./linhaCuidado";

describe("compararIndicador", () => {
  it("contagem: delta absoluto e relativo; tom pelo sentido", () => {
    const v = compararIndicador(15, 12, "contagem", "bom_subir");
    expect(v).toEqual({ direcao: "subiu", delta: 3, deltaPct: 25, tom: "bom" });
    expect(compararIndicador(9, 12, "contagem", "bom_subir").tom).toBe("ruim");
  });

  it("mais perda de seguimento é ruim; menos é bom", () => {
    expect(compararIndicador(20, 10, "pct", "ruim_subir")).toMatchObject({ direcao: "subiu", delta: 10, tom: "ruim" });
    expect(compararIndicador(5, 10, "pct", "ruim_subir")).toMatchObject({ direcao: "caiu", delta: -5, tom: "bom" });
  });

  it("mais diagnósticos é neutro (nem bom nem ruim)", () => {
    expect(compararIndicador(8, 4, "contagem", "neutro")).toMatchObject({ direcao: "subiu", tom: "neutro" });
  });

  it("sem base quando algum lado é nulo; anterior 0 não gera %", () => {
    expect(compararIndicador(null, 3, "pct", "bom_subir")).toEqual({ direcao: "sem_base", delta: null, deltaPct: null, tom: "neutro" });
    expect(compararIndicador(3, undefined, "dias", "ruim_subir").direcao).toBe("sem_base");
    expect(compararIndicador(4, 0, "contagem", "bom_subir")).toMatchObject({ delta: 4, deltaPct: null });
  });

  it("igual → neutro; arredonda a 1 casa", () => {
    expect(compararIndicador(10, 10, "contagem", "bom_subir")).toEqual({ direcao: "igual", delta: 0, deltaPct: 0, tom: "neutro" });
    expect(compararIndicador(33.33, 30, "pct", "bom_subir").delta).toBe(3.3);
  });
});

describe("textoVariacao", () => {
  it("formata por unidade", () => {
    expect(textoVariacao(compararIndicador(15, 12, "contagem", "neutro"), "contagem")).toBe("+3 (+25%)");
    expect(textoVariacao(compararIndicador(4, 0, "contagem", "neutro"), "contagem")).toBe("+4");
    expect(textoVariacao(compararIndicador(12.5, 15, "pct", "neutro"), "pct")).toBe("−2,5 p.p.");
    expect(textoVariacao(compararIndicador(20, 24, "dias", "ruim_subir"), "dias")).toBe("−4");
    expect(textoVariacao(compararIndicador(null, 24, "dias", "ruim_subir"), "dias")).toBe("");
    expect(textoVariacao(compararIndicador(12.5, 15, "pct", "neutro"), "pct", "en-US")).toBe("−2.5 p.p.");
  });

  it("formatarComSinal", () => {
    expect(formatarComSinal(0)).toBe("0");
    expect(formatarComSinal(1234.56)).toBe("+1.234,6");
  });
});

describe("faixas de idade", () => {
  it("bordas das faixas", () => {
    expect(faixaDaIdade(19)).toBe("menos_20");
    expect(faixaDaIdade(20)).toBe("de_20_34");
    expect(faixaDaIdade(34)).toBe("de_20_34");
    expect(faixaDaIdade(35)).toBe("de_35_39");
    expect(faixaDaIdade(39)).toBe("de_35_39");
    expect(faixaDaIdade(40)).toBe("mais_40");
    expect(faixaDaIdade(null)).toBe("sem_info");
  });

  it("percentual sobre o total (inclui sem data de nascimento)", () => {
    const r = faixasComPct({ menos_20: 1, de_20_34: 4, de_35_39: 1, mais_40: 1, sem_info: 2 });
    expect(r.map((x) => x.pct)).toEqual([11.1, 44.4, 11.1, 11.1, 22.2]);
    expect(faixasComPct(undefined).every((x) => x.n === 0 && x.pct === 0)).toBe(true);
  });
});

describe("linhasFunil", () => {
  it("etapas e desfechos com % do topo e das diagnosticadas", () => {
    const l = linhasFunil({
      rastreadas: 8,
      diagnosticadas: 6,
      em_acompanhamento: 1,
      encerradas: { insulinizacao: 2, parto: 0, aborto: 1, nao_retornou: 1, outro: 1 },
      encerradas_total: 5,
      taxa_diagnostico_pct: 75,
      perda_seguimento_pct: 16.7,
    });
    expect(l.map((x) => x.etapa)).toEqual([
      "rastreadas", "diagnosticadas", "em_acompanhamento", "insulinizacao", "parto", "aborto", "nao_retornou", "outro",
    ]);
    expect(l[1]).toMatchObject({ n: 6, pctDoTopo: 75, grupo: "rastreio" });
    expect(l[6]).toMatchObject({ etapa: "nao_retornou", n: 1, pctDasDiagnosticadas: 16.7, grupo: "desfecho" });
  });

  it("sem rastreadas não divide por zero", () => {
    const l = linhasFunil({
      rastreadas: 0, diagnosticadas: 0, em_acompanhamento: 0,
      encerradas: { insulinizacao: 0, parto: 0, aborto: 0, nao_retornou: 0, outro: 0 },
      encerradas_total: 0, taxa_diagnostico_pct: null, perda_seguimento_pct: null,
    });
    expect(l.every((x) => x.pctDoTopo === 0)).toBe(true);
    expect(l[2].pctDasDiagnosticadas).toBeNull();
  });
});
