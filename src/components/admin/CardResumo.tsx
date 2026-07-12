import { Loader2 } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";

interface CardResumoProps {
  label: string;
  valor: number | null;
  loading?: boolean;
  tooltip?: string;
}

export function CardResumo({ label, valor, loading, tooltip }: CardResumoProps) {
  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "#E2E8F0" }}
    >
      <div className="flex items-center" style={{ minHeight: 44 }}>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#7C4DBA]" />
        ) : (
          <span
            className="text-[32px] leading-none font-bold"
            style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
          >
            {valor ?? 0}
          </span>
        )}
      </div>
      <div
        className="mt-2 flex items-center gap-1.5 text-sm"
        style={{ color: "#64748B", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        <span>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
    </div>
  );
}
