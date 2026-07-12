import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  AlertCircle,
  Moon,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import type { TipoAlerta } from "@/lib/adminMetrics";

export type EscopoAlerta = "consultorio" | "institucional" | "ambos";

export interface AlertaConfig {
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  cor: string;
  icone: LucideIcon;
  escopo: EscopoAlerta;
}

// Mapa fixo dos 5 alertas v3 (sem teste_expirando), na ordem de exibição.
export const ALERTAS_CONFIG: AlertaConfig[] = [
  {
    tipo: "profissional_inativo_30d",
    titulo: "Plano Profissional sem uso há 30+ dias",
    descricao: "Profissionais do plano Profissional inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
    escopo: "consultorio",
  },
  {
    tipo: "intermediaria_inativo_30d",
    titulo: "Plano Intermediária sem uso há 30+ dias",
    descricao: "Profissionais do plano Intermediária inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
    escopo: "consultorio",
  },
  {
    tipo: "inicial_inativo_30d",
    titulo: "Plano Inicial sem uso há 30+ dias",
    descricao: "Profissionais do plano Inicial inativos no último mês",
    cor: "#F59E0B",
    icone: AlertTriangle,
    escopo: "consultorio",
  },
  {
    tipo: "unidade_dormente",
    titulo: "Unidades sem profissionais ativos no mês",
    descricao: "Unidades sem nenhum profissional com atividade nos últimos 30 dias",
    cor: "#94A3B8",
    icone: Moon,
    escopo: "institucional",
  },
  {
    tipo: "onboarding_travado",
    titulo: "Cadastros há 7+ dias sem completar perfil",
    descricao: "Profissionais cadastrados há mais de 7 dias com perfil incompleto",
    cor: "#EF4444",
    icone: Hourglass,
    escopo: "ambos",
  },
];

const ESCOPO_STYLES: Record<EscopoAlerta, { bg: string; fg: string; border: string }> = {
  consultorio: { bg: "#EDE9FE", fg: "#6D28D9", border: "#DDD6FE" },
  institucional: { bg: "#CCFBF1", fg: "#0F766E", border: "#99F6E4" },
  ambos: { bg: "#F1F5F9", fg: "#334155", border: "#E2E8F0" },
};

interface AlertaOperacionalCardProps {
  config: AlertaConfig;
  total: number;
}

export function AlertaOperacionalCard({ config, total }: AlertaOperacionalCardProps) {
  const { t, i18n } = useTranslation();
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
          {total.toLocaleString(i18n.language)}
        </span>
      </div>
      {(() => {
        const s = ESCOPO_STYLES[config.escopo];
        const label = t(`admin.scope.${config.escopo}`);
        return (
          <span
            className="inline-flex items-center self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: s.bg,
              color: s.fg,
              border: `1px solid ${s.border}`,
              fontFamily: "Plus Jakarta Sans, sans-serif",
              letterSpacing: "0.04em",
            }}
            title={t("admin.alerts.appliesTo", { escopo: label })}
          >
            {label}
          </span>
        );
      })()}
      <div
        style={{
          fontFamily: "Sora, sans-serif",
          fontWeight: 600,
          fontSize: 14,
          color: "#1E293B",
          lineHeight: 1.3,
        }}
      >
        {t(`admin.alerts.${config.tipo}.titulo`, { defaultValue: config.titulo })}
      </div>
      <div
        style={{
          fontFamily: "Plus Jakarta Sans, sans-serif",
          fontSize: 12,
          color: "#64748B",
        }}
      >
        {t(`admin.alerts.${config.tipo}.descricao`, { defaultValue: config.descricao })}
      </div>
      {/* TODO Prompt 25 — destino real de "Ver detalhes" */}
      <Link
        to="#"
        className="mt-auto inline-block text-[12px] font-semibold"
        style={{ color: "#7E69AB", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        {t("admin.alerts.viewDetails")}
      </Link>
    </div>
  );
}

export default AlertaOperacionalCard;
