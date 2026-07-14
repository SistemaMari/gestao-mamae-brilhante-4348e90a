import { useEffect, useMemo, useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Loader2, Info, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import { mockMetricasDiagnosticos } from "@/lib/mockMetricasDiagnosticos";
import { useAdminFiltros } from "@/contexts/AdminFiltrosContext";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GrupoEscopo } from "@/components/admin/GrupoEscopo";

// =============================================================================
// Tipos espelhando o JSON da função public.metricas_diagnosticos_admin().
// =============================================================================

interface Metricas {
  resumo: {
    total_gestantes: number;
    dmg: number;
    overt: number;
    dmg_overt_total: number;
    taxa_controle_global: number;
    taxa_controle_inadequado?: number;
    mev_base?: number;
  };
  evolucao_mensal: Array<{ mes: string; gestantes: number; diagnosticos: number }>;
  momento_diagnostico: {
    retorno1: number;
    gtt_janela: number;
    gtt_tardio: number;
    ig_retorno1: number | null;
    ig_gtt_janela: number | null;
    ig_gtt_tardio: number | null;
  };
  historico_dmg: {
    pacientes_com_historico: number;
    dmg_entre_com_historico: number;
  };
  tratamento: {
    so_dieta: number;
    insulina_inicial_ok: number;
    cenario7: number;
  };
  funil: Array<{ etapa: string; valor: number }>;
  desfechos: {
    partos_total: number;
    via_vaginal: number;
    via_cesarea: number;
    rn_aig: number;
    rn_gig: number;
    rn_pig: number;
    peso_medio_g: number | null;
    ig_parto_media: number | null;
    interc_maternas: number;
    interc_neonatais: number;
  } | null;
  regional: {
    por_estado: Array<{ estado: string; gestantes: number; dmg: number; taxa_dmg: number }>;
    por_cidade: Array<{ cidade: string; estado: string; gestantes: number; dmg: number; taxa_dmg: number }>;
    por_unidade: Array<{ unidade: string; estado: string; cidade: string; gestantes: number; dmg: number; taxa_dmg: number }>;
  };
}

// =============================================================================
// Paleta semântica conforme Prompt 24, Seção 3.8.
// (Cores fixas em hex porque são parte do espec clínico, não do tema do app.)
// =============================================================================
interface Encerramentos {
  ativas: number;
  encerradas: number;
  por_motivo: {
    parto: number;
    aborto: number;
    insulinizacao: number;
    nao_retornou: number;
    outro: number;
  };
  taxa_nao_retornou: number;
  ig_ao_endocrino: number | null;
  laudos_mensais: Array<{ mes: string; qtd: number }>;
}

const COR_VERDE = "#22C55E";
const COR_LARANJA = "#F59E0B";
const COR_VERMELHO = "#EF4444";
const COR_LILAS = "#7C4DBA";
const COR_ROXO = "#7C4DBA";
const COR_CINZA = "#94A3B8";

const FONT_TITULO = "Sora, sans-serif";
const FONT_CORPO = "Plus Jakarta Sans, sans-serif";

// =============================================================================
// Componentes auxiliares.
// =============================================================================

function NotaLgpd() {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-lg border p-4 text-sm"
      style={{
        background: "#F1F0FB",
        borderColor: "#D6BCFA",
        color: "#475569",
        fontFamily: FONT_CORPO,
      }}
    >
      <strong style={{ color: "#7E69AB" }}>{t("admin.diagnosticos.lgpdLabel")}</strong>{" "}
      {t("admin.diagnosticos.lgpdText")}
    </div>
  );
}

interface MetricaCardProps {
  label: string;
  valor: string | number;
  sublabel?: string;
  cor?: string;
  destaque?: boolean;
  tooltip?: string;
}
function MetricaCard({ label, valor, sublabel, cor, destaque, tooltip }: MetricaCardProps) {
  return (
    <div
      className="rounded-xl border bg-white p-3 shadow-sm h-full flex flex-col"
      style={{
        borderColor: destaque ? cor ?? "#E2E8F0" : "#E2E8F0",
        borderWidth: destaque ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="text-xs" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {label}
        </div>
        {tooltip && (
          <TooltipProvider delayDuration={150}>
            <UiTooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 shrink-0" style={{ color: COR_CINZA }} />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        )}
      </div>
      <div
        className="text-[24px] leading-none font-bold"
        style={{ color: cor ?? "#1E293B", fontFamily: FONT_TITULO }}
      >
        {valor}
      </div>
      {sublabel && (
        <div className="mt-auto pt-2 text-[11px] leading-tight" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-lg font-semibold"
      style={{ color: "#1E293B", fontFamily: FONT_TITULO }}
    >
      {children}
    </h3>
  );
}

function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "#E2E8F0" }}
    >
      {children}
    </div>
  );
}

function BarrasMotivo({
  itens,
  total,
}: {
  itens: Array<{ nome: string; valor: number; cor: string }>;
  total: number;
}) {
  const { t } = useTranslation();
  if (!total) {
    return (
      <div
        className="rounded-lg border border-dashed p-6 text-center text-sm"
        style={{ borderColor: "#E2E8F0", color: COR_CINZA, fontFamily: FONT_CORPO }}
      >
        {t("admin.diagnosticos.noClosuresYet")}
      </div>
    );
  }
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div className="flex flex-col gap-3">
      {itens.map((i) => {
        const pct = total > 0 ? Math.round((i.valor / total) * 100) : 0;
        const larguraBar = (i.valor / max) * 100;
        return (
          <div key={i.nome}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: i.cor }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: "#1E293B", fontFamily: FONT_CORPO }}
                >
                  {i.nome}
                </span>
              </div>
              <div
                className="text-sm tabular-nums"
                style={{ color: "#475569", fontFamily: FONT_CORPO }}
              >
                <span className="font-semibold" style={{ color: "#1E293B" }}>
                  {i.valor}
                </span>
                <span className="mx-1.5" style={{ color: COR_CINZA }}>·</span>
                <span>{pct}%</span>
              </div>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ background: "#F1F5F9" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(larguraBar, i.valor > 0 ? 6 : 0)}%`,
                  background: i.cor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Pizza({
  data,
  cores,
  vazioMsg,
}: {
  data: Array<{ name: string; value: number }>;
  cores: string[];
  vazioMsg: string;
}) {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex h-[240px] items-center justify-center text-sm"
        style={{ color: COR_CINZA, fontFamily: FONT_CORPO }}
      >
        {vazioMsg}
      </div>
    );
  }
  const renderPctLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;

    const pct = (value / total) * 100;
    if (pct < 4) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#FFFFFF"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: FONT_CORPO, fontSize: 13, fontWeight: 700 }}
      >
        {pct.toFixed(0)}%
      </text>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={95}
            labelLine={false}
            label={renderPctLabel}
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={cores[i % cores.length]} stroke="#FFFFFF" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v} (${((v / total) * 100).toFixed(1)}%)`, t("admin.diagnosticos.patients")]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col items-center gap-2 pt-1">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: "#94A3B8", fontFamily: FONT_CORPO }}>
          {t("admin.diagnosticos.pizzaCaption", { total })}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {data.map((d, i) => {
            const pct = ((d.value / total) * 100).toFixed(0);
            const cor = cores[i % cores.length];
            return (
              <div
                key={d.name}
                className="flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur transition-all hover:shadow-md"
                style={{ borderColor: `${cor}33`, fontFamily: FONT_CORPO }}
                title={t("admin.diagnosticos.pizzaItemTitle", { count: d.value, pct, rota: d.name })}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cor, boxShadow: `0 0 0 3px ${cor}22` }}
                />
                <span className="text-[13px] font-medium" style={{ color: "#1F1B2E" }}>
                  {d.name}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{ backgroundColor: `${cor}1A`, color: cor }}
                >
                  {t("admin.diagnosticos.pizzaItemBadge", { count: d.value, pct })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}



function FunilTratamento({ funil }: { funil: Metricas["funil"] }) {
  const { t } = useTranslation();
  // Insulina não é mais manejada pela MARI (insulinização encerra o
  // acompanhamento → endócrino). Ocultamos as etapas de insulina do funil.
  const ETAPAS_OCULTAS = new Set(["Insulina iniciada", "Insulina suficiente"]);
  const etapas = funil.filter((f) => !ETAPAS_OCULTAS.has(f.etapa));

  // Cor por etapa (não por índice — assim não desalinha ao ocultar passos).
  const CORES_ETAPA: Record<string, string> = {
    "Total gestantes": "#16A34A",
    "DMG confirmado": "#22C55E",
    "Só dieta": "#5EEAD4",
    "Associar endócrino": COR_LARANJA,
  };
  // Rótulo traduzido por etapa (a chave crua vem do backend e é usada na lógica).
  const LABEL_ETAPA: Record<string, string> = {
    "Total gestantes": t("admin.diagnosticos.funilTotalGestantes"),
    "DMG confirmado": t("admin.diagnosticos.funilDmgConfirmado"),
    "Só dieta": t("admin.diagnosticos.funilSoDieta"),
    "Associar endócrino": t("admin.diagnosticos.funilAssociarEndocrino"),
  };
  const max = Math.max(...etapas.map((f) => f.valor), 1);
  return (
    <div className="space-y-3">
      {etapas.map((etapa) => {
        const pct = (etapa.valor / max) * 100;
        return (
          <div key={etapa.etapa}>
            <div className="mb-1 flex items-center justify-between text-sm" style={{ fontFamily: FONT_CORPO }}>
              <span style={{ color: "#1E293B" }}>{LABEL_ETAPA[etapa.etapa] ?? etapa.etapa}</span>
              <span style={{ color: "#64748B" }}>{etapa.valor}</span>
            </div>
            <div className="h-6 w-full rounded-md" style={{ background: "#F1F5F9" }}>
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: CORES_ETAPA[etapa.etapa] ?? COR_LILAS,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Coluna = {
  key: string;
  label: string;
  numerica?: boolean;
  format?: (v: unknown, row: Record<string, unknown>) => React.ReactNode;
};

function TabelaOrdenavel({
  titulo,
  colunas,
  linhas,
  vazioMsg,
  expandivel,
  renderDetalhe,
}: {
  titulo: string;
  colunas: Coluna[];
  linhas: Array<Record<string, unknown>>;
  vazioMsg: string;
  expandivel?: boolean;
  renderDetalhe?: (row: Record<string, unknown>) => React.ReactNode;
}) {
  const { i18n } = useTranslation();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<number | null>(null);

  const sorted = useMemo(() => {
    if (!sortKey) return linhas;
    return [...linhas].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb), i18n.language)
        : String(vb).localeCompare(String(va), i18n.language);
    });
  }, [linhas, sortKey, sortDir, i18n.language]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <CardContainer>
      <h4
        className="mb-3 text-base font-semibold"
        style={{ color: "#1E293B", fontFamily: FONT_TITULO }}
      >
        {titulo}
      </h4>
      {sorted.length === 0 ? (
        <p className="text-sm" style={{ color: COR_CINZA, fontFamily: FONT_CORPO }}>
          {vazioMsg}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: FONT_CORPO }}>
            <thead>
              <tr style={{ background: "#5B2C9C" }}>
                {expandivel && <th className="w-8 px-2 py-2" />}
                {colunas.map((c) => {
                  const ativo = sortKey === c.key;
                  const Icone = !ativo ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide hover:bg-[#6B3CB0]"
                      style={{ color: "#FFFFFF" }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        <Icone className="h-3 w-3 opacity-80" />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((linha, idx) => {
                const isOpen = expanded === idx;
                return (
                  <Fragment key={idx}>
                    <tr
                      onClick={() => expandivel && setExpanded(isOpen ? null : idx)}
                      style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                      className={expandivel ? "cursor-pointer hover:bg-[#F1F0FB]" : ""}
                    >
                      {expandivel && (
                        <td className="px-2 py-2" style={{ borderTop: "1px solid #E2E8F0" }}>
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" style={{ color: COR_LILAS }} />
                          ) : (
                            <ChevronRight className="h-4 w-4" style={{ color: COR_CINZA }} />
                          )}
                        </td>
                      )}
                      {colunas.map((c) => (
                        <td
                          key={c.key}
                          className="px-3 py-2"
                          style={{ color: "#1E293B", borderTop: "1px solid #E2E8F0" }}
                        >
                          {c.format ? c.format(linha[c.key], linha) : String(linha[c.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                    {expandivel && isOpen && renderDetalhe && (
                      <tr style={{ background: "#F1F0FB" }}>
                        <td colSpan={colunas.length + 1} className="px-4 py-3" style={{ borderTop: "1px solid #D6BCFA" }}>
                          {renderDetalhe(linha)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CardContainer>
  );
}

// =============================================================================
// Página.
// =============================================================================

export default function DiagnosticosPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/vitrine");

  const [dados, setDados] = useState<Metricas | null>(null);
  const [encerr, setEncerr] = useState<Encerramentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { filtros } = useAdminFiltros();

  useEffect(() => {
    let cancelado = false;

    // Vitrine pública: usa dados de demonstração e nem chama a RPC.
    if (isPreview) {
      setDados(mockMetricasDiagnosticos as unknown as Metricas);
      setLoading(false);
      return;
    }

    (async () => {
      const [diag, enc] = await Promise.all([
        supabase.rpc("metricas_diagnosticos_admin"),
        supabase.rpc("metricas_encerramentos_admin"),
      ]);
      if (cancelado) return;
      if (diag.error) {
        setErro(diag.error.message ?? t("admin.diagnosticos.loadFail"));
      } else {
        setDados(diag.data as unknown as Metricas);
      }
      // Encerramentos: não bloqueia a tela se falhar (seção some).
      if (!enc.error) setEncerr(enc.data as unknown as Encerramentos);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [isPreview]);

  const fEstado = filtros.estado === "todos" ? null : filtros.estado;
  const fCidade = filtros.cidade === "todos" ? null : filtros.cidade;
  const regionalFiltrado = useMemo(() => {
    const r = dados?.regional;
    if (!r) return { por_estado: [], por_cidade: [], por_unidade: [] };
    return {
      por_estado: r.por_estado.filter((x) => !fEstado || x.estado === fEstado),
      por_cidade: r.por_cidade.filter(
        (x) => (!fEstado || x.estado === fEstado) && (!fCidade || x.cidade === fCidade),
      ),
      por_unidade: r.por_unidade.filter(
        (x) => (!fEstado || x.estado === fEstado) && (!fCidade || x.cidade === fCidade),
      ),
    };
  }, [dados, fEstado, fCidade]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: COR_LILAS }} />
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="rounded-lg border p-6" style={{ borderColor: "#FEE2E2", background: "#FEF2F2" }}>
        <p style={{ color: "#DC2626", fontFamily: FONT_CORPO }}>
          {t("admin.diagnosticos.loadError", { erro: erro ?? t("admin.diagnosticos.emptyResponse") })}
        </p>
      </div>
    );
  }

  const { resumo, evolucao_mensal, momento_diagnostico, historico_dmg, tratamento, funil, desfechos } = dados;
  const totalDmg = resumo.dmg || 1; // evita divisão por zero em %.
  const pct = (n: number) => `${Math.round((n / totalDmg) * 100)}%`;
  const pctSobreTotal = (n: number) =>
    resumo.total_gestantes === 0 ? "—" : `${Math.round((n / resumo.total_gestantes) * 100)}%`;

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ color: "#1E293B", fontFamily: FONT_TITULO }}
        >
          {t("admin.diagnosticos.title")}
        </h2>
        <p className="text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {t("admin.diagnosticos.subtitle")}
        </p>
      </div>

      <BarraFiltrosGlobais />

      <NotaLgpd />

      {/* 1. Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <div className="relative h-full">
          <MetricaCard
            label={t("admin.diagnosticos.cardTotalGestantes")}
            valor={resumo.total_gestantes}
            tooltip={t("admin.diagnosticos.cardTotalGestantesTip")}
          />
          <span aria-hidden className="hidden lg:block absolute top-2 bottom-2 -right-[7px] w-[2px] bg-slate-300 rounded-full" />
        </div>
        <div className="h-full">
          <MetricaCard
            label="DMG afastado"
            valor={Math.max(0, resumo.total_gestantes - resumo.dmg_overt_total)}
            sublabel={t("admin.diagnosticos.ofTotal", {
              pct: pctSobreTotal(Math.max(0, resumo.total_gestantes - resumo.dmg_overt_total)),
            })}
            cor={COR_VERDE}
            tooltip="Gestantes rastreadas cujo resultado afastou DMG e Overt DM."
          />
        </div>
        <div className="relative h-full">
          <MetricaCard
            label={t("admin.diagnosticos.cardDmg")}
            valor={resumo.dmg}
            sublabel={t("admin.diagnosticos.ofTotal", { pct: pctSobreTotal(resumo.dmg) })}
            cor={COR_LARANJA}
            tooltip={t("admin.diagnosticos.cardDmgTip")}
          />
          <span aria-hidden className="hidden lg:block absolute top-2 bottom-2 -right-[7px] w-[2px] bg-slate-300 rounded-full" />
        </div>
        <div className="h-full">
          <MetricaCard
            label="OVERT DM"
            valor={resumo.overt}
            sublabel={t("admin.diagnosticos.ofTotal", { pct: pctSobreTotal(resumo.overt) })}
            cor={COR_VERMELHO}
            tooltip={t("admin.diagnosticos.cardOvertTip")}
          />
        </div>
        <div className="relative h-full">
          <MetricaCard
            label={t("admin.diagnosticos.cardDmgOvert")}
            valor={resumo.dmg_overt_total}
            sublabel={t("admin.diagnosticos.ofTotal", { pct: pctSobreTotal(resumo.dmg_overt_total) })}
            cor={COR_ROXO}
            destaque
            tooltip={t("admin.diagnosticos.cardDmgOvertTip")}
          />
          <span aria-hidden className="hidden lg:block absolute top-2 bottom-2 -right-[7px] w-[2px] bg-slate-300 rounded-full" />
        </div>
        <div className="h-full">
          <MetricaCard
            label="Taxa de controle adequado"
            valor={`${resumo.taxa_controle_global}%`}
            sublabel="Controle por dieta e atividade física"
            cor={COR_VERDE}
            destaque
            tooltip="Percentual de pacientes DMG que atingiram controle adequado apenas com dieta e atividade física. Base: pacientes que iniciaram tratamento em MEV."
          />
        </div>
        <div className="h-full">
          <MetricaCard
            label="Taxa de controle inadequado"
            valor={`${resumo.taxa_controle_inadequado ?? 0}%`}
            sublabel="Necessidade de insulina"
            cor={COR_VERMELHO}
            destaque
            tooltip="Percentual de pacientes DMG que não atingiram controle apenas com dieta e atividade física e precisaram associar insulina. Base: pacientes que iniciaram tratamento em MEV."
          />
        </div>
      </div>



      {/* 2. Evolução mensal */}
      <CardContainer>
        <SecaoTitulo>{t("admin.diagnosticos.evolTitle")}</SecaoTitulo>
        <p className="mb-3 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {t("admin.diagnosticos.evolDesc")}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={evolucao_mensal}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="gestantes" name={t("admin.diagnosticos.seriesGestantes")} stroke={COR_LILAS} strokeWidth={2} />
            <Line type="monotone" dataKey="diagnosticos" name={t("admin.diagnosticos.seriesDiagnosticos")} stroke={COR_LARANJA} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContainer>

      {/* 3. Momento do diagnóstico (pizza) + 4. IG média (3 cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardContainer>
          <SecaoTitulo>{t("admin.diagnosticos.momentoTitle")}</SecaoTitulo>
          <Pizza
            data={[
              { name: t("admin.diagnosticos.retorno1"), value: momento_diagnostico.retorno1 },
              { name: t("admin.diagnosticos.gttJanela"), value: momento_diagnostico.gtt_janela },
              { name: t("admin.diagnosticos.gttTardio"), value: momento_diagnostico.gtt_tardio },
            ]}
            cores={[COR_LILAS, COR_LARANJA, COR_VERMELHO]}
            vazioMsg={t("admin.diagnosticos.noConfirmedYet")}
          />
        </CardContainer>

        <CardContainer>
          <SecaoTitulo>{t("admin.diagnosticos.igMediaTitle")}</SecaoTitulo>
          <p className="mb-4 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
            {t("admin.diagnosticos.igMediaDesc")}
          </p>
          <div className="flex flex-col divide-y" style={{ borderColor: "#EEF2F7" }}>
            {[
              { label: t("admin.diagnosticos.retorno1"), valor: momento_diagnostico.ig_retorno1, cor: COR_LILAS, hint: t("admin.diagnosticos.hintJejumAlterada") },
              { label: t("admin.diagnosticos.gttJanelaShort"), valor: momento_diagnostico.ig_gtt_janela, cor: COR_LARANJA, hint: t("admin.diagnosticos.hint2428") },
              { label: t("admin.diagnosticos.gttTardio"), valor: momento_diagnostico.ig_gtt_tardio, cor: COR_VERMELHO, hint: t("admin.diagnosticos.hintApos28") },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${row.cor}1A` }}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.cor }} />
                  </span>
                  <div className="min-w-0">
                    <div
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "#1F1B2E", fontFamily: FONT_CORPO }}
                    >
                      {row.label}
                    </div>
                    <div className="text-[11px]" style={{ color: "#94A3B8", fontFamily: FONT_CORPO }}>
                      {row.hint}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span
                    className="text-3xl font-bold tabular-nums"
                    style={{ color: row.valor != null ? "#1F1B2E" : "#CBD5E1", fontFamily: FONT_TITULO }}
                  >
                    {row.valor != null ? row.valor : "—"}
                  </span>
                  {row.valor != null && (
                    <span className="text-xs font-medium" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
                      {t("admin.diagnosticos.weeksAbbr")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContainer>

      </div>

      {/* 5. Histórico de DMG anterior */}
      <CardContainer>
        <SecaoTitulo>{t("admin.diagnosticos.historicoTitle")}</SecaoTitulo>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricaCard
            label={t("admin.diagnosticos.patientsWithHistory")}
            valor={historico_dmg.pacientes_com_historico}
            sublabel={t("admin.diagnosticos.ofTotal", { pct: pctSobreTotal(historico_dmg.pacientes_com_historico) })}
            tooltip={t("admin.diagnosticos.patientsWithHistoryTip")}
          />
          <MetricaCard
            label={t("admin.diagnosticos.dmgAgain")}
            valor={historico_dmg.dmg_entre_com_historico}
            tooltip={t("admin.diagnosticos.dmgAgainTip")}
          />
          <MetricaCard
            label={t("admin.diagnosticos.recurrenceRate")}
            valor={
              historico_dmg.pacientes_com_historico === 0
                ? "—"
                : `${Math.round(
                    (historico_dmg.dmg_entre_com_historico / historico_dmg.pacientes_com_historico) * 100
                  )}%`
            }
            cor={COR_LARANJA}
            tooltip={t("admin.diagnosticos.recurrenceRateTip")}
          />
        </div>
      </CardContainer>

      {/* 5b. Encerramentos e adesão (novas métricas) */}
      {encerr && (
        <CardContainer>
          <SecaoTitulo>{t("admin.diagnosticos.encerramentosTitle")}</SecaoTitulo>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricaCard
              label={t("admin.diagnosticos.emAcompanhamento")}
              valor={encerr.ativas}
              sublabel={t("admin.diagnosticos.emAcompanhamentoSub")}
              cor={COR_VERDE}
              tooltip={t("admin.diagnosticos.emAcompanhamentoTip")}
            />
            <MetricaCard
              label={t("admin.diagnosticos.encerrados")}
              valor={encerr.encerradas}
              sublabel={t("admin.diagnosticos.encerradosSub")}
              tooltip={t("admin.diagnosticos.encerradosTip")}
            />
            <MetricaCard
              label={t("admin.diagnosticos.naoRetornaram")}
              valor={`${encerr.taxa_nao_retornou}%`}
              sublabel={t("admin.diagnosticos.naoRetornaramSub", { count: encerr.por_motivo.nao_retornou, total: encerr.encerradas })}
              cor={COR_LARANJA}
              tooltip={t("admin.diagnosticos.naoRetornaramTip")}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-baseline justify-between mb-4">
                <SecaoTitulo>{t("admin.diagnosticos.encerramentosPorMotivo")}</SecaoTitulo>
                <span className="text-xs" style={{ color: COR_CINZA, fontFamily: FONT_CORPO }}>
                  {t("admin.diagnosticos.encerramentosTotalCount", { count: encerr.encerradas })}
                </span>
              </div>
              <BarrasMotivo
                total={encerr.encerradas}
                itens={[
                  { nome: t("admin.diagnosticos.motivoParto"), valor: encerr.por_motivo.parto, cor: COR_VERDE },
                  { nome: t("admin.diagnosticos.motivoAborto"), valor: encerr.por_motivo.aborto, cor: COR_VERMELHO },
                  { nome: t("admin.diagnosticos.motivoInsulinizacao"), valor: encerr.por_motivo.insulinizacao, cor: COR_LARANJA },
                  { nome: t("admin.diagnosticos.motivoNaoRetornou"), valor: encerr.por_motivo.nao_retornou, cor: "#94A3B8" },
                  { nome: t("admin.diagnosticos.motivoOutro"), valor: encerr.por_motivo.outro, cor: COR_LILAS },
                ]}
              />
            </div>
            <div className="flex flex-col gap-4">
              <MetricaCard
                label={t("admin.diagnosticos.igEncaminhamento")}
                valor={encerr.ig_ao_endocrino != null ? t("admin.diagnosticos.weeksValue", { count: encerr.ig_ao_endocrino }) : "—"}
                sublabel={t("admin.diagnosticos.soonerBetter")}
                cor={COR_LARANJA}
                tooltip={t("admin.diagnosticos.igEncaminhamentoTip")}
              />
            </div>

          </div>
        </CardContainer>
      )}

      {/* 6. Funil */}
      <CardContainer>
        <SecaoTitulo>{t("admin.diagnosticos.funilTitle")}</SecaoTitulo>
        <p className="mb-4 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {t("admin.diagnosticos.funilDesc")}
        </p>
        <FunilTratamento funil={funil} />
      </CardContainer>

      {/* 7. Desfecho do tratamento — controle com dieta vs. encaminhamento ao endócrino.
             (Insulina não é mais manejada pela MARI → cards de insulina removidos.) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricaCard
          label={t("admin.diagnosticos.controlOnlyDiet")}
          valor={tratamento.so_dieta}
          sublabel={t("admin.diagnosticos.ofDmgPatients", { pct: pct(tratamento.so_dieta) })}
          cor={COR_VERDE}
          tooltip={t("admin.diagnosticos.controlOnlyDietTip")}
        />
        <MetricaCard
          label={t("admin.diagnosticos.needEndocrino")}
          valor={tratamento.cenario7}
          sublabel={t("admin.diagnosticos.needEndocrinoSub", { pct: pct(tratamento.cenario7) })}
          cor={COR_LARANJA}
          destaque
          tooltip={t("admin.diagnosticos.needEndocrinoTip")}
        />
      </div>

      {/* Volume de laudos — série mensal full-width */}
      {encerr && (
        <CardContainer>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <SecaoTitulo>{t("admin.diagnosticos.laudosVolumeTitle")}</SecaoTitulo>
            <span className="text-xs" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
              {t("admin.diagnosticos.laudosVolumeMeta")}
            </span>
          </div>
          <p className="mt-1 mb-4 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
            {t("admin.diagnosticos.laudosVolumeDesc")}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={encerr.laudos_mensais} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="qtd" name={t("admin.diagnosticos.laudosBarName")} fill={COR_LILAS} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </CardContainer>
      )}

      {/* Desfechos perinatais — ocultado do ADMIN até o registro de parto voltar. */}



      {/* 13–14. Quebras regionais — agrupadas por escopo (padrão Painel) */}
      <div className="space-y-8">
        <SecaoTitulo>{t("admin.diagnosticos.regionalTitle")}</SecaoTitulo>

        <GrupoEscopo
          escopo="consultorio"
          titulo={t("admin.diagnosticos.consultorioGroupTitle")}
          descricao={t("admin.diagnosticos.consultorioGroupDesc")}
        >
          <TabelaOrdenavel
            titulo={t("admin.diagnosticos.dmgByState")}
            colunas={[
              { key: "estado", label: t("patient.state") },
              { key: "gestantes", label: t("admin.diagnosticos.colGestantes"), numerica: true },
              { key: "dmg", label: "DMG", numerica: true },
              { key: "taxa_dmg", label: t("admin.diagnosticos.colDmgRate"), numerica: true, format: (v) => `${v}%` },
            ]}
            linhas={regionalFiltrado.por_estado as unknown as Array<Record<string, unknown>>}
            vazioMsg={t("admin.diagnosticos.noConsultorioPatients")}
          />
          <TabelaOrdenavel
            titulo={t("admin.diagnosticos.dmgByCity")}
            colunas={[
              { key: "cidade", label: t("patient.city") },
              { key: "estado", label: t("patient.state") },
              { key: "gestantes", label: t("admin.diagnosticos.colGestantes"), numerica: true },
              { key: "dmg", label: "DMG", numerica: true },
              { key: "taxa_dmg", label: t("admin.diagnosticos.colDmgRate"), numerica: true, format: (v) => `${v}%` },
            ]}
            linhas={
              regionalFiltrado.por_cidade
                .slice(0, 20) as unknown as Array<Record<string, unknown>>
            }
            vazioMsg={t("admin.diagnosticos.noConsultorioPatients")}
          />
        </GrupoEscopo>

        <GrupoEscopo
          escopo="institucional"
          titulo={t("admin.diagnosticos.institucionalGroupTitle")}
          descricao={t("admin.diagnosticos.institucionalGroupDesc")}
        >
          <TabelaOrdenavel
            titulo={t("admin.diagnosticos.metricsByUnit")}
            colunas={[
              { key: "unidade", label: t("admin.diagnosticos.colUnit") },
              { key: "cidade", label: t("patient.city") },
              { key: "estado", label: t("patient.state") },
              { key: "gestantes", label: t("admin.diagnosticos.colGestantes"), numerica: true },
              { key: "dmg", label: "DMG", numerica: true },
              { key: "taxa_dmg", label: t("admin.diagnosticos.colDmgRate"), numerica: true, format: (v) => `${v}%` },
            ]}
            linhas={regionalFiltrado.por_unidade as unknown as Array<Record<string, unknown>>}
            vazioMsg={t("admin.diagnosticos.noUnitPatients")}
            expandivel
            renderDetalhe={(row) => {
              const r = row as { unidade: string; cidade: string; estado: string; gestantes: number; dmg: number; taxa_dmg: number };
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm" style={{ fontFamily: FONT_CORPO, color: "#475569" }}>
                  <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">{t("admin.diagnosticos.detailLocation")}</span>{r.cidade} / {r.estado}</div>
                  <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">{t("admin.diagnosticos.colGestantes")}</span>{r.gestantes}</div>
                  <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">DMG</span>{r.dmg} ({r.taxa_dmg}%)</div>
                  <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">{t("admin.diagnosticos.detailNoDmg")}</span>{Math.max(0, r.gestantes - r.dmg)}</div>
                </div>
            );
          }}
        />
        </GrupoEscopo>
      </div>
    </div>
  );
}
