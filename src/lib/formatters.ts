export interface IgObj {
  semanas: number;
  dias: number;
  total_dias: number;
}

export function formatIg(v: IgObj | null | undefined): string {
  if (!v) return "—";
  return `${v.semanas} sem ${v.dias}d`;
}

export function formatPctOrDash(v: number | null | undefined, frac = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(frac)}%`;
}

export function formatDias(v: number | null | undefined, frac = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(frac)} dias`;
}

export function formatNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR");
}

export interface DeltaResult {
  text: string;
  tone: "up" | "down" | "neutral";
}

export function formatDeltaPct(v: number | null | undefined): DeltaResult {
  if (v === null || v === undefined || Number.isNaN(v)) return { text: "—", tone: "neutral" };
  if (v === 0) return { text: "0%", tone: "neutral" };
  const sign = v > 0 ? "+" : "";
  return { text: `${sign}${v.toFixed(1)}%`, tone: v > 0 ? "up" : "down" };
}

export function formatDeltaPp(v: number | null | undefined): DeltaResult {
  if (v === null || v === undefined || Number.isNaN(v)) return { text: "—", tone: "neutral" };
  if (v === 0) return { text: "0 p.p.", tone: "neutral" };
  const sign = v > 0 ? "+" : "";
  return { text: `${sign}${v.toFixed(1)} p.p.`, tone: v > 0 ? "up" : "down" };
}
