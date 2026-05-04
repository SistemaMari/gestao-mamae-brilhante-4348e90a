import { Link } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  Moon,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import type { TipoAlerta } from "@/lib/adminMetrics";

export interface AlertaConfig {
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  cor: string;
  icone: LucideIcon;
}

// Mapa fixo dos 5 alertas v3 (sem teste_expirando), na ordem de exibição.
export const ALERTAS_CONFIG: AlertaConfig[] = [
  {
    tipo: "profissional_inativo_30d",
    titulo: "Plano Profissional sem uso há 30+ dias",
    descricao: "Profissionais do plano Profissional inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
  },
  {
    tipo: "intermediaria_inativo_30d",
    titulo: "Plano Intermediária sem uso há 30+ dias",
    descricao: "Profissionais do plano Intermediária inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
  },
  {
    tipo: "inicial_inativo_30d",
    titulo: "Plano Inicial sem uso há 30+ dias",
    descricao: "Profissionais do plano Inicial inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
  },
  {
    tipo: "unidade_dormente",
    titulo: "Unidades sem profissionais ativos no mês",
    descricao: "Unidades sem nenhum profissional com atividade nos últimos 30 dias",
    cor: "#94A3B8",
    icone: Moon,
  },
  {
    tipo: "onboarding_travado",
    titulo: "Cadastros há 7+ dias sem completar perfil",
    descricao: "Profissionais cadastrados há mais de 7 dias com perfil incompleto",
    cor: "#EF4444",
    icone: Hourglass,
  },
];

interface AlertaOperacionalCardProps {
  config: AlertaConfig;
  total: number;
}

export function AlertaOperacionalCard({ config, total }: AlertaOperacionalCardProps) {
  const Icone = config.icone ?? AlertCircle;
  return (
    <div
      className="rounded-lg bg-white p-4 flex flex-col gap-2 h-full"
      style={{
        borderLeft: `4px solid ${config.cor}`,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Icone size={20} style={{ color: config.cor }} />
        <span
          style={{
            fontFamily: "Sora, sans-serif",
            fontWeight: 700,
            fontSize: 28,
            color: "#1E293B",
            lineHeight: 1,
          }}
        >
          {total.toLocaleString("pt-BR")}
        </span>
      </div>
      <div
        style={{
          fontFamily: "Sora, sans-serif",
          fontWeight: 600,
          fontSize: 14,
          color: "#1E293B",
          lineHeight: 1.3,
        }}
      >
        {config.titulo}
      </div>
      <div
        style={{
          fontFamily: "Plus Jakarta Sans, sans-serif",
          fontSize: 12,
          color: "#64748B",
        }}
      >
        {config.descricao}
      </div>
      {/* TODO Prompt 25 — destino real de "Ver detalhes" */}
      <Link
        to="#"
        className="mt-auto inline-block text-[12px] font-semibold"
        style={{ color: "#7E69AB", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        Ver detalhes →
      </Link>
    </div>
  );
}

export default AlertaOperacionalCard;
