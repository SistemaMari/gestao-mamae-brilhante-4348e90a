import { describe, expect, it } from "vitest";
import { calcularPeriodo, formatarPeriodoCurto, periodoAnterior } from "./periodo";

const HOJE = new Date(2026, 9, 14); // 14/out/2026 (local)

describe("calcularPeriodo", () => {
  it("presets relativos a hoje", () => {
    expect(calcularPeriodo("7d", undefined, HOJE)).toEqual({ inicio: "2026-10-07", fim: "2026-10-14" });
    expect(calcularPeriodo("30d", undefined, HOJE)).toEqual({ inicio: "2026-09-14", fim: "2026-10-14" });
    expect(calcularPeriodo("90d", undefined, HOJE)).toEqual({ inicio: "2026-07-16", fim: "2026-10-14" });
    expect(calcularPeriodo("12m", undefined, HOJE)).toEqual({ inicio: "2025-10-14", fim: "2026-10-14" });
    expect(calcularPeriodo("ano", undefined, HOJE)).toEqual({ inicio: "2026-01-01", fim: "2026-10-14" });
  });

  it("custom usa o intervalo escolhido; sem intervalo cai nos 30 dias", () => {
    expect(
      calcularPeriodo("custom", { from: new Date(2026, 0, 5), to: new Date(2026, 1, 10) }, HOJE),
    ).toEqual({ inicio: "2026-01-05", fim: "2026-02-10" });
    expect(calcularPeriodo("custom", undefined, HOJE)).toEqual({ inicio: "2026-09-14", fim: "2026-10-14" });
  });
});

describe("periodoAnterior", () => {
  it("mesmo tamanho, imediatamente antes (inclusive nas pontas)", () => {
    // 14/set–14/out = 31 dias → 14/ago–13/set
    expect(periodoAnterior({ inicio: "2026-09-14", fim: "2026-10-14" })).toEqual({
      inicio: "2026-08-14",
      fim: "2026-09-13",
    });
    // 1 dia
    expect(periodoAnterior({ inicio: "2026-03-01", fim: "2026-03-01" })).toEqual({
      inicio: "2026-02-28",
      fim: "2026-02-28",
    });
  });

  it("inválido → null", () => {
    expect(periodoAnterior({ inicio: "2026-10-14", fim: "2026-10-01" })).toBeNull();
    expect(periodoAnterior({ inicio: "", fim: "2026-10-01" })).toBeNull();
  });
});

describe("formatarPeriodoCurto", () => {
  it("formata dd/MM/yy", () => {
    expect(formatarPeriodoCurto({ inicio: "2026-09-14", fim: "2026-10-14" })).toBe("14/09/26 – 14/10/26");
    expect(formatarPeriodoCurto(null)).toBe("");
  });
});
