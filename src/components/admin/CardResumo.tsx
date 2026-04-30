import { Loader2 } from "lucide-react";

interface CardResumoProps {
  label: string;
  valor: number | null;
  loading?: boolean;
}

export function CardResumo({ label, valor, loading }: CardResumoProps) {
  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "#E2E8F0" }}
    >
      <div className="flex items-center" style={{ minHeight: 44 }}>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#9b87f5]" />
        ) : (
          <span
            className="text-[32px] leading-none font-bold"
            // CORREÇÃO 2 — número grande em #1E293B
            style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
          >
            {valor ?? 0}
          </span>
        )}
      </div>
      <div
        className="mt-2 text-sm"
        style={{ color: "#64748B", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        {label}
      </div>
    </div>
  );
}
