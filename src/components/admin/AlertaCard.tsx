import { AlertTriangle, AlertCircle, Info, CheckCircle, type LucideIcon } from "lucide-react";

export type AlertaTipo = "critico" | "atencao" | "info" | "sucesso";

interface AlertaCardProps {
  tipo: AlertaTipo;
  titulo: string;
  numero: number;
  descricao: string;
  linkVerDetalhes?: () => void;
}

const CONFIG: Record<AlertaTipo, { cor: string; icone: LucideIcon }> = {
  critico: { cor: "#DC2626", icone: AlertTriangle },
  atencao: { cor: "#F59E0B", icone: AlertCircle },
  info: { cor: "#3B82F6", icone: Info },
  sucesso: { cor: "#16A34A", icone: CheckCircle },
};

export function AlertaCard({ tipo, titulo, numero, descricao, linkVerDetalhes }: AlertaCardProps) {
  const { cor, icone: Icone } = CONFIG[tipo];

  return (
    <div
      className="relative flex gap-3 rounded-lg bg-white p-4 shadow-sm"
      style={{ borderLeft: `4px solid ${cor}` }}
    >
      <div className="shrink-0 pt-0.5">
        <Icone size={22} style={{ color: cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-bold"
          style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
        >
          {titulo}
        </div>
        <div
          className="mt-1 text-[28px] font-bold leading-tight"
          style={{ fontFamily: "Sora, sans-serif", color: cor }}
        >
          {numero}
        </div>
        <div
          className="mt-1 text-[13px] leading-snug"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B" }}
        >
          {descricao}
        </div>
        {linkVerDetalhes && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={linkVerDetalhes}
              className="text-[12px] font-medium hover:underline"
              style={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                color: "#7C4DBA",
              }}
            >
              Ver detalhes →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertaCard;
