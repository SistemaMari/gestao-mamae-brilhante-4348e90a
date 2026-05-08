import { useEffect, useMemo, useState, Fragment } from "react";
import { useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { Loader2, Info, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mockMetricasDiagnosticos } from "@/lib/mockMetricasDiagnosticos";
import { useAdminFiltros } from "@/contexts/AdminFiltrosContext";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      <strong style={{ color: "#7E69AB" }}>Nota LGPD.</strong>{" "}
      Todas as métricas exibidas são agregadas e anonimizadas — não há nome, CPF,
      prontuário, valores individuais de glicemia ou laudos. Dados estatísticos
      agregados se enquadram no Art. 12 da LGPD (dados anonimizados não são
      considerados dados pessoais para os fins desta lei).
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
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{
        borderColor: destaque ? cor ?? "#E2E8F0" : "#E2E8F0",
        borderWidth: destaque ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          {label}
        </div>
        {tooltip && (
          <TooltipProvider delayDuration={150}>
            <UiTooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5" style={{ color: COR_CINZA }} />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </UiTooltip>
          </TooltipProvider>
        )}
      </div>
      <div
        className="text-[32px] leading-none font-bold"
        style={{ color: cor ?? "#1E293B", fontFamily: FONT_TITULO }}
      >
        {valor}
      </div>
      {sublabel && (
        <div className="mt-2 text-xs" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
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

function Pizza({
  data,
  cores,
  vazioMsg,
}: {
  data: Array<{ name: string; value: number }>;
  cores: string[];
  vazioMsg: string;
}) {
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
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
          {data.map((_, i) => (
            <Cell key={i} fill={cores[i % cores.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function FunilTratamento({ funil }: { funil: Metricas["funil"] }) {
  // Gradiente de cores: verde → laranja, conforme Prompt 24 Seção 3.8.
  const cores = [
    "#16A34A", // total gestantes
    "#22C55E", // DMG
    "#5EEAD4", // só dieta
    COR_LILAS, // insulina iniciada
    "#7E69AB", // insulina suficiente
    COR_LARANJA, // associar endócrino
  ];
  const max = Math.max(...funil.map((f) => f.valor), 1);
  return (
    <div className="space-y-3">
      {funil.map((etapa, i) => {
        const pct = (etapa.valor / max) * 100;
        return (
          <div key={etapa.etapa}>
            <div className="mb-1 flex items-center justify-between text-sm" style={{ fontFamily: FONT_CORPO }}>
              <span style={{ color: "#1E293B" }}>{etapa.etapa}</span>
              <span style={{ color: "#64748B" }}>{etapa.valor}</span>
            </div>
            <div className="h-6 w-full rounded-md" style={{ background: "#F1F5F9" }}>
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: cores[i % cores.length],
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
        ? String(va).localeCompare(String(vb), "pt-BR")
        : String(vb).localeCompare(String(va), "pt-BR");
    });
  }, [linhas, sortKey, sortDir]);

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
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/vitrine");

  const [dados, setDados] = useState<Metricas | null>(null);
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
      const { data, error } = await supabase.rpc("metricas_diagnosticos_admin");
      if (cancelado) return;
      if (error) {
        setErro(error.message ?? "Falha ao carregar métricas.");
      } else {
        setDados(data as unknown as Metricas);
      }
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
          Não foi possível carregar as métricas: {erro ?? "resposta vazia"}.
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
          Diagnósticos
        </h2>
        <p className="text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          Métricas epidemiológicas agregadas — DMG, Overt Diabete, tratamento e desfechos.
        </p>
      </div>

      <NotaLgpd />

      {/* 1. Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricaCard label="Total de gestantes" valor={resumo.total_gestantes} />
        <MetricaCard
          label="DMG confirmado"
          valor={resumo.dmg}
          sublabel={pctSobreTotal(resumo.dmg) + " do total"}
          cor={COR_LARANJA}
        />
        <MetricaCard
          label="Overt Diabete"
          valor={resumo.overt}
          sublabel={pctSobreTotal(resumo.overt) + " do total"}
          cor={COR_VERMELHO}
        />
        <MetricaCard
          label="DMG + Overt combinados"
          valor={resumo.dmg_overt_total}
          sublabel={pctSobreTotal(resumo.dmg_overt_total) + " do total"}
          cor={COR_ROXO}
          destaque
          tooltip="Soma automática de pacientes com DMG ou Overt Diabete."
        />
        <MetricaCard
          label="Taxa de controle adequado"
          valor={`${resumo.taxa_controle_global}%`}
          sublabel="Dieta + insulina suficiente / DMG"
          cor={COR_VERDE}
          destaque
        />
      </div>

      {/* 2. Evolução mensal */}
      <CardContainer>
        <SecaoTitulo>Evolução mensal</SecaoTitulo>
        <p className="mb-3 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          Últimos 12 meses — gestantes cadastradas e diagnósticos confirmados.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={evolucao_mensal}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="gestantes" name="Gestantes" stroke={COR_LILAS} strokeWidth={2} />
            <Line type="monotone" dataKey="diagnosticos" name="Diagnósticos" stroke={COR_LARANJA} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContainer>

      {/* 3. Momento do diagnóstico (pizza) + 4. IG média (3 cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardContainer>
          <SecaoTitulo>Momento do diagnóstico</SecaoTitulo>
          <Pizza
            data={[
              { name: "Retorno 1", value: momento_diagnostico.retorno1 },
              { name: "GTT 24-28 sem", value: momento_diagnostico.gtt_janela },
              { name: "GTT tardio", value: momento_diagnostico.gtt_tardio },
            ]}
            cores={[COR_LILAS, COR_LARANJA, COR_VERMELHO]}
            vazioMsg="Sem diagnósticos confirmados ainda."
          />
        </CardContainer>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricaCard
            label="IG média — Retorno 1"
            valor={momento_diagnostico.ig_retorno1 != null ? `${momento_diagnostico.ig_retorno1} sem` : "—"}
          />
          <MetricaCard
            label="IG média — GTT janela"
            valor={momento_diagnostico.ig_gtt_janela != null ? `${momento_diagnostico.ig_gtt_janela} sem` : "—"}
          />
          <MetricaCard
            label="IG média — GTT tardio"
            valor={momento_diagnostico.ig_gtt_tardio != null ? `${momento_diagnostico.ig_gtt_tardio} sem` : "—"}
          />
        </div>
      </div>

      {/* 5. Histórico de DMG anterior */}
      <CardContainer>
        <SecaoTitulo>Histórico de DMG em gestação anterior</SecaoTitulo>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricaCard
            label="Pacientes com histórico"
            valor={historico_dmg.pacientes_com_historico}
            sublabel={pctSobreTotal(historico_dmg.pacientes_com_historico) + " do total"}
          />
          <MetricaCard
            label="Tiveram DMG novamente"
            valor={historico_dmg.dmg_entre_com_historico}
          />
          <MetricaCard
            label="Taxa de recorrência"
            valor={
              historico_dmg.pacientes_com_historico === 0
                ? "—"
                : `${Math.round(
                    (historico_dmg.dmg_entre_com_historico / historico_dmg.pacientes_com_historico) * 100
                  )}%`
            }
            cor={COR_LARANJA}
          />
        </div>
      </CardContainer>

      {/* 6. Funil */}
      <CardContainer>
        <SecaoTitulo>Funil de tratamento</SecaoTitulo>
        <p className="mb-4 text-sm" style={{ color: "#64748B", fontFamily: FONT_CORPO }}>
          Total → DMG → Só dieta → Insulina iniciada → Insulina suficiente → Associar endócrino.
        </p>
        <FunilTratamento funil={funil} />
      </CardContainer>

      {/* 7. Tratamento — dieta vs insulina inicial OK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetricaCard
          label="Controle só com dieta + exercício"
          valor={tratamento.so_dieta}
          sublabel={pct(tratamento.so_dieta) + " das pacientes com DMG"}
          cor={COR_VERDE}
        />
        <MetricaCard
          label="Dose inicial de insulina suficiente"
          valor={tratamento.insulina_inicial_ok}
          sublabel={pct(tratamento.insulina_inicial_ok) + " das pacientes com DMG"}
          cor={COR_LILAS}
        />
      </div>

      {/* 8. Cenário 7 */}
      <MetricaCard
        label="Cenário 7 — necessidade de associar endócrino"
        valor={tratamento.cenario7}
        sublabel={
          pct(tratamento.cenario7) +
          " das pacientes com DMG · GO permanece protagonista do pré-natal e da insulinoterapia."
        }
        cor={COR_LARANJA}
        destaque
      />

      {/* 9–11. Pizzas de desfechos perinatais */}
      <CardContainer>
        <SecaoTitulo>Desfechos perinatais</SecaoTitulo>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4
              className="mb-2 text-base font-medium"
              style={{ color: "#475569", fontFamily: FONT_TITULO }}
            >
              Via de parto
            </h4>
            <Pizza
              data={[
                { name: "Vaginal", value: desfechos?.via_vaginal ?? 0 },
                { name: "Cesárea", value: desfechos?.via_cesarea ?? 0 },
              ]}
              cores={[COR_VERDE, COR_LILAS]}
              vazioMsg="Sem partos registrados ainda."
            />
          </div>
          <div>
            <h4
              className="mb-2 text-base font-medium"
              style={{ color: "#475569", fontFamily: FONT_TITULO }}
            >
              Classificação do RN
            </h4>
            <Pizza
              data={[
                { name: "AIG", value: desfechos?.rn_aig ?? 0 },
                { name: "GIG", value: desfechos?.rn_gig ?? 0 },
                { name: "PIG", value: desfechos?.rn_pig ?? 0 },
              ]}
              cores={[COR_VERDE, COR_LARANJA, COR_VERMELHO]}
              vazioMsg="Sem partos registrados ainda."
            />
          </div>
        </div>

        {/* 12. Cards de desfecho */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricaCard
            label="Partos registrados"
            valor={desfechos?.partos_total ?? 0}
          />
          <MetricaCard
            label="IG média no parto"
            valor={
              desfechos?.ig_parto_media
                ? `${desfechos.ig_parto_media.toFixed(1)} sem`
                : "—"
            }
          />
          <MetricaCard
            label="Peso médio do RN"
            valor={desfechos?.peso_medio_g ? `${desfechos.peso_medio_g} g` : "—"}
          />
          <MetricaCard
            label="Intercorrências (mãe / RN)"
            valor={`${desfechos?.interc_maternas ?? 0} / ${desfechos?.interc_neonatais ?? 0}`}
          />
        </div>
      </CardContainer>

      {/* 13–14. Quebras regionais */}
      <div className="space-y-6">
        <SecaoTitulo>Quebra por região</SecaoTitulo>
        <TabelaOrdenavel
          titulo="Taxa de DMG por estado"
          colunas={[
            { key: "estado", label: "Estado" },
            { key: "gestantes", label: "Gestantes", numerica: true },
            { key: "dmg", label: "DMG", numerica: true },
            { key: "taxa_dmg", label: "Taxa de DMG", numerica: true, format: (v) => `${v}%` },
          ]}
          linhas={regionalFiltrado.por_estado as unknown as Array<Record<string, unknown>>}
          vazioMsg="Sem dados regionais ainda."
        />
        <TabelaOrdenavel
          titulo="Top 20 cidades (mín. 10 pacientes)"
          colunas={[
            { key: "cidade", label: "Cidade" },
            { key: "estado", label: "Estado" },
            { key: "gestantes", label: "Gestantes", numerica: true },
            { key: "dmg", label: "DMG", numerica: true },
            { key: "taxa_dmg", label: "Taxa de DMG", numerica: true, format: (v) => `${v}%` },
          ]}
          linhas={
            regionalFiltrado.por_cidade
              .filter((c) => c.gestantes >= 10)
              .slice(0, 20) as unknown as Array<Record<string, unknown>>
          }
          vazioMsg="Sem cidades com 10+ pacientes ainda."
        />
        <TabelaOrdenavel
          titulo="Métricas por unidade"
          colunas={[
            { key: "unidade", label: "Unidade" },
            { key: "cidade", label: "Cidade" },
            { key: "estado", label: "Estado" },
            { key: "gestantes", label: "Gestantes", numerica: true },
            { key: "dmg", label: "DMG", numerica: true },
            { key: "taxa_dmg", label: "Taxa de DMG", numerica: true, format: (v) => `${v}%` },
          ]}
          linhas={regionalFiltrado.por_unidade as unknown as Array<Record<string, unknown>>}
          vazioMsg="Nenhuma unidade com pacientes vinculadas."
          expandivel
          renderDetalhe={(row) => {
            const r = row as { unidade: string; cidade: string; estado: string; gestantes: number; dmg: number; taxa_dmg: number };
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm" style={{ fontFamily: FONT_CORPO, color: "#475569" }}>
                <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">Localização</span>{r.cidade} / {r.estado}</div>
                <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">Gestantes</span>{r.gestantes}</div>
                <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">DMG</span>{r.dmg} ({r.taxa_dmg}%)</div>
                <div><span className="block text-xs uppercase tracking-wide text-[#7E69AB]">Sem DMG</span>{Math.max(0, r.gestantes - r.dmg)}</div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
