import { differenceInCalendarDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function fmtNum(v: number | null | undefined, frac = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

export function fmtPct(v: number | null | undefined, frac = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(frac)}%`;
}

export function fmtVarPct(v: number | null | undefined): { text: string; tone: "up" | "down" | "neutral" } {
  if (v === null || v === undefined || Number.isNaN(v)) return { text: "—", tone: "neutral" };
  if (v === 0) return { text: "0%", tone: "neutral" };
  const sign = v > 0 ? "+" : "";
  return { text: `${sign}${v.toFixed(1)}%`, tone: v > 0 ? "up" : "down" };
}

export function fmtVarPp(v: number | null | undefined): { text: string; tone: "up" | "down" | "neutral" } {
  if (v === null || v === undefined || Number.isNaN(v)) return { text: "—", tone: "neutral" };
  if (v === 0) return { text: "0 p.p.", tone: "neutral" };
  const sign = v > 0 ? "+" : "";
  return { text: `${sign}${v.toFixed(1)} p.p.`, tone: v > 0 ? "up" : "down" };
}

export function humanizeUltimaAtividade(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  try {
    const d = typeof iso === "string" ? parseISO(iso) : iso;
    const diff = differenceInCalendarDays(new Date(), d);
    if (diff <= 0) return "hoje";
    if (diff === 1) return "ontem";
    return `há ${formatDistanceToNowStrict(d, { locale: ptBR })}`;
  } catch {
    return "—";
  }
}
