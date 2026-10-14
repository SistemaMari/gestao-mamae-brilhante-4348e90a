import { addDays, differenceInCalendarDays, format, startOfYear, subDays } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";

/**
 * Presets de período dos painéis (gestor geral e gestor de unidade).
 * Lógica pura, sem contexto — o FiltrosGestorGeralContext re-exporta daqui.
 */
export type PresetPeriodo = "7d" | "30d" | "90d" | "12m" | "ano" | "custom";

export const PRESETS_PERIODO: PresetPeriodo[] = ["7d", "30d", "90d", "12m", "ano", "custom"];

/** Período com que o painel da unidade abre (decisão 14/out/2026: 90 dias — com
 *  poucas gestantes por mês, 30 dias fazia a taxa oscilar demais). */
export const PERIODO_PADRAO_PAINEL: PresetPeriodo = "90d";

export interface Periodo {
  inicio: string; // YYYY-MM-DD
  fim: string; // YYYY-MM-DD
}

export function calcularPeriodo(
  preset: PresetPeriodo,
  custom?: { from?: Date; to?: Date },
  hoje: Date = new Date(),
): Periodo {
  const fim = hoje;
  let inicio = subDays(fim, 30);
  switch (preset) {
    case "7d":
      inicio = subDays(fim, 7);
      break;
    case "30d":
      inicio = subDays(fim, 30);
      break;
    case "90d":
      inicio = subDays(fim, 90);
      break;
    case "12m":
      inicio = subDays(fim, 365);
      break;
    case "ano":
      inicio = startOfYear(fim);
      break;
    case "custom":
      if (custom?.from && custom?.to) {
        return {
          inicio: format(custom.from, "yyyy-MM-dd"),
          fim: format(custom.to, "yyyy-MM-dd"),
        };
      }
      break;
  }
  return { inicio: format(inicio, "yyyy-MM-dd"), fim: format(fim, "yyyy-MM-dd") };
}

/**
 * Período anterior do mesmo tamanho, imediatamente antes do início
 * (mesma conta do banco em _linha_cuidado_com_anterior).
 */
export function periodoAnterior(p: Periodo): Periodo | null {
  const ini = parseDateLocal(p.inicio);
  const fim = parseDateLocal(p.fim);
  if (!ini || !fim || ini > fim) return null;
  const dias = differenceInCalendarDays(fim, ini) + 1;
  return {
    inicio: format(addDays(ini, -dias), "yyyy-MM-dd"),
    fim: format(addDays(ini, -1), "yyyy-MM-dd"),
  };
}

/** "dd/MM/yy – dd/MM/yy" para rótulos de período. */
export function formatarPeriodoCurto(p: Periodo | null | undefined): string {
  if (!p) return "";
  const ini = parseDateLocal(p.inicio);
  const fim = parseDateLocal(p.fim);
  if (!ini || !fim) return "";
  return `${format(ini, "dd/MM/yy")} – ${format(fim, "dd/MM/yy")}`;
}
