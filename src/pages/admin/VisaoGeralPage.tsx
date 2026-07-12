import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useOutletContext } from "react-router-dom";
import { Users, Building2 } from "lucide-react";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import { CardResumo } from "@/components/admin/CardResumo";
import { TabelaOrdenavel } from "@/components/admin/TabelaOrdenavel";
import { AlertaOperacionalCard, ALERTAS_CONFIG } from "@/components/admin/AlertaOperacionalCard";
import { BadgeEscopo } from "@/components/admin/BadgeEscopo";
import { GrupoEscopo } from "@/components/admin/GrupoEscopo";
import { GraficoLinhaEvolucao } from "@/components/admin/GraficoLinhaEvolucao";
import { GraficoPizzaPlanos } from "@/components/admin/GraficoPizzaPlanos";
import { GraficoPizzaTiposUnidade } from "@/components/admin/GraficoPizzaTiposUnidade";
import { SecaoBloco } from "@/components/admin/SecaoBloco";
import { supabase } from "@/integrations/supabase/client";
import { mockVisaoGeral } from "@/lib/mockVisaoGeral";
import { useAdminView, useAlertasOperacionais } from "@/hooks/useAdminMetrics";
import { useAdminFiltros } from "@/contexts/AdminFiltrosContext";
import type {
  AlertaRow,
  CidadeRow,
  EvolucaoPlanosRow,
  EvolucaoProfissionaisRow,
  EvolucaoProfissionaisTipoRow,
  GeoRow,
  PlanoRow,
  ResumoGlobalRow,
  UnidadeResumoRow,
} from "@/lib/adminMetrics";

interface Resumo {
  profissionais: number | null;
  unidades: number | null;
  pacientes: number | null;
  laudos: number | null;
}

export default function VisaoGeralPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const fmtMes = (mes: string) =>
    new Date(mes).toLocaleDateString(locale, { month: "short", year: "2-digit" });
  const fmtPct = (v: unknown) => `${(v as number).toLocaleString(locale)}%`;

  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/vitrine");
  const outletCtx = useOutletContext<{ nomeAdmin?: string } | null>();
  const nomeAdmin = outletCtx?.nomeAdmin || t("admin.overview.adminFallback");

  // ----- Cards de resumo do topo (mantidos do código original) -----
  const [resumo, setResumo] = useState<Resumo>({
    profissionais: null,
    unidades: null,
    pacientes: null,
    laudos: null,
  });
  const [loadingResumo, setLoadingResumo] = useState(true);

  useEffect(() => {
    let cancelado = false;
    if (isPreview) {
      setResumo(mockVisaoGeral);
      setLoadingResumo(false);
      return;
    }
    (async () => {
      const [profs, unids, pacs, lauds] = await Promise.all([
        supabase.from("profissionais").select("*", { count: "exact", head: true }),
        supabase.from("unidades").select("*", { count: "exact", head: true }),
        supabase.from("pacientes").select("*", { count: "exact", head: true }),
        supabase.from("laudos").select("*", { count: "exact", head: true }),
      ]);
      if (cancelado) return;
      setResumo({
        profissionais: profs.count ?? 0,
        unidades: unids.count ?? 0,
        pacientes: pacs.count ?? 0,
        laudos: lauds.count ?? 0,
      });
      setLoadingResumo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [isPreview]);

  // ----- Hooks do admin-metrics -----
  const previewMode = isPreview;
  const resumoGlobal = useAdminView<ResumoGlobalRow>("resumo_global", undefined, { previewMode });
  const alertas = useAlertasOperacionais({ previewMode });
  const evolProf = useAdminView<EvolucaoProfissionaisRow>(
    "evolucao_mensal_profissionais",
    undefined,
    { previewMode },
  );
  const evolProfTipo = useAdminView<EvolucaoProfissionaisTipoRow>(
    "evolucao_mensal_profissionais_tipo",
    undefined,
    { previewMode },
  );
  const evolPlanos = useAdminView<EvolucaoPlanosRow>(
    "evolucao_mensal_planos",
    undefined,
    { previewMode },
  );
  const planos = useAdminView<PlanoRow>("profissionais_por_plano", undefined, { previewMode });
  const unidades = useAdminView<UnidadeResumoRow>("unidades_resumo", undefined, { previewMode });
  const distribuicao = useAdminView<GeoRow>("distribuicao_geografica", undefined, { previewMode });
  const topCidades = useAdminView<CidadeRow>("top_cidades", undefined, { previewMode });

  // ----- Filtros globais -----
  const { filtros } = useAdminFiltros();
  const filtroPais = filtros.pais === "todos" ? null : filtros.pais;
  const filtroEstado = filtros.estado === "todos" ? null : filtros.estado;
  const filtroCidade = filtros.cidade === "todos" ? null : filtros.cidade;
  const filtroTipo = filtros.tipo_conta === "todos" ? null : filtros.tipo_conta;
  const filtroUnidade = filtros.unidade_id === "todos" ? null : filtros.unidade_id;

  // ----- Derivações -----
  const r0 = resumoGlobal.data?.[0];

  const alertasMap = useMemo(() => {
    const m = new Map<string, number>();
    (alertas.data ?? []).forEach((a: AlertaRow) => m.set(a.tipo_alerta as string, a.total));
    return m;
  }, [alertas.data]);

  const evolProfDados = useMemo(
    () =>
      (evolProf.data ?? []).map((r) => ({
        mes: fmtMes(r.mes),
        novos: r.novos_profissionais,
        ativos: r.profissionais_ativos,
      })),
    [evolProf.data, locale],
  );

  const dadosPorTipo = (tipo: "consultorio" | "institucional") => {
    const rows = (evolProfTipo.data ?? []).filter((r) => r.tipo_conta === tipo);
    return rows
      .slice()
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        mes: fmtMes(r.mes),
        novos: r.novos_profissionais,
        ativos: r.profissionais_ativos,
      }));
  };
  const evolConsultorio = useMemo(() => dadosPorTipo("consultorio"), [evolProfTipo.data, locale]);
  const evolInstitucional = useMemo(() => dadosPorTipo("institucional"), [evolProfTipo.data, locale]);

  const evolPlanosDados = useMemo(() => {
    const meses = Array.from(new Set((evolPlanos.data ?? []).map((r) => r.mes))).sort();
    return meses.map((m) => {
      const linha: Record<string, string | number> = { mes: fmtMes(m) };
      (evolPlanos.data ?? [])
        .filter((r) => r.mes === m)
        .forEach((r) => {
          linha[r.plano_slug] = r.novos;
        });
      return linha;
    });
  }, [evolPlanos.data, locale]);

  // Nomes de plano ficam como no banco (i18n de nomes de plano = fase futura).
  const seriesPlanos = [
    { chave: "inicial", nome: "Inicial", cor: "#5EEAD4" },
    { chave: "intermediaria", nome: "Intermediária", cor: "#D6BCFA" },
    { chave: "profissional", nome: "Profissional", cor: "#7C4DBA" },
  ];

  // Unidades filtradas por geo + tipo + unidade_id
  const unidadesFiltradas = useMemo(() => {
    return (unidades.data ?? []).filter((u) => {
      if (filtroPais && u.pais !== filtroPais) return false;
      if (filtroEstado && u.estado !== filtroEstado) return false;
      if (filtroCidade && u.cidade !== filtroCidade) return false;
      if (filtroUnidade && u.unidade_id !== filtroUnidade) return false;
      return true;
    });
  }, [unidades.data, filtroPais, filtroEstado, filtroCidade, filtroUnidade]);

  const tiposUnidade = useMemo(() => {
    const m = new Map<string, number>();
    unidadesFiltradas.forEach((u) => {
      const k = u.tipo ?? t("admin.overview.notInformed");
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([tipo, total]) => ({ tipo, total }));
  }, [unidadesFiltradas, locale]);

  // Distribuição filtrada por geo
  const distribuicaoFiltrada = useMemo(() => {
    return (distribuicao.data ?? []).filter((r) => {
      if (filtroPais && r.pais !== filtroPais) return false;
      if (filtroEstado && r.estado !== filtroEstado) return false;
      if (filtroCidade && r.cidade !== filtroCidade) return false;
      return true;
    });
  }, [distribuicao.data, filtroPais, filtroEstado, filtroCidade]);

  const distPais = useMemo(() => {
    const m = new Map<string, { profissionais: number }>();
    distribuicaoFiltrada.forEach((r) => {
      const cur = m.get(r.pais) ?? { profissionais: 0 };
      cur.profissionais += r.total_profissionais;
      m.set(r.pais, cur);
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v.profissionais, 0) || 1;
    return Array.from(m.entries()).map(([pais, v]) => ({
      pais,
      total_profissionais: v.profissionais,
      pct: Math.round((v.profissionais / total) * 1000) / 10,
    }));
  }, [distribuicaoFiltrada]);

  const distEstado = useMemo(() => {
    const m = new Map<string, { profissionais: number }>();
    distribuicaoFiltrada.forEach((r) => {
      const cur = m.get(r.estado) ?? { profissionais: 0 };
      cur.profissionais += r.total_profissionais;
      m.set(r.estado, cur);
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v.profissionais, 0) || 1;
    return Array.from(m.entries()).map(([estado, v]) => ({
      estado,
      total_profissionais: v.profissionais,
      pct: Math.round((v.profissionais / total) * 1000) / 10,
    }));
  }, [distribuicaoFiltrada]);

  const topCidadesFiltradas = useMemo(() => {
    return (topCidades.data ?? []).filter((c) => {
      if (filtroPais && c.pais !== filtroPais) return false;
      if (filtroEstado && c.estado !== filtroEstado) return false;
      if (filtroCidade && c.cidade !== filtroCidade) return false;
      return true;
    });
  }, [topCidades.data, filtroPais, filtroEstado, filtroCidade]);

  // Tipo de conta: institucional = unidade_id != null; consultorio = sem unidade.
  // unidades_resumo só lista institucional, então o filtro de tipo_conta apenas
  // afeta a visibilidade das tabelas de unidades.
  const mostrarTabelasInstitucionais = filtroTipo !== "consultorio";

  return (
    <div className="space-y-10">
      {/* Saudação */}
      <div className="pb-6 border-b" style={{ borderColor: "#E2E8F0" }}>
        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          {t("admin.overview.greeting", { nome: nomeAdmin })}
        </h1>
        <p className="mt-2 text-base" style={{ color: "#64748B" }}>
          {t("admin.overview.welcome")}
        </p>
      </div>

      <div>
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          {t("admin.overview.title")}
        </h2>
        <p className="text-sm" style={{ color: "#64748B" }}>
          {t("admin.overview.subtitle")}
        </p>
      </div>

      {/* Cards rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo
          label={t("admin.overview.cardProfessionals")}
          valor={resumo.profissionais}
          loading={loadingResumo}
          tooltip={t("admin.overview.cardProfessionalsTip")}
        />
        <CardResumo
          label={t("admin.overview.cardUnits")}
          valor={resumo.unidades}
          loading={loadingResumo}
          tooltip={t("admin.overview.cardUnitsTip")}
        />
        <CardResumo
          label={t("admin.overview.cardPatients")}
          valor={isPreview ? resumo.pacientes : (r0?.total_pacientes ?? null)}
          loading={isPreview ? loadingResumo : resumoGlobal.isLoading}
          tooltip={t("admin.overview.cardPatientsTip")}
        />
        <CardResumo
          label={t("admin.overview.cardReports")}
          valor={isPreview ? resumo.laudos : (r0?.total_laudos ?? null)}
          loading={isPreview ? loadingResumo : resumoGlobal.isLoading}
          tooltip={t("admin.overview.cardReportsTip")}
        />
      </div>

      {/* Alertas operacionais */}
      <SecaoBloco
        titulo={t("admin.overview.alertsTitle")}
        descricao={t("admin.overview.alertsDesc")}
        tooltip={t("admin.overview.alertsTip")}
        loading={alertas.isLoading}
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALERTAS_CONFIG.map((a) => (
              <div
                key={a.tipo}
                className="rounded-lg animate-pulse"
                style={{ background: "#E2E8F0", height: 140 }}
              />
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALERTAS_CONFIG.map((a) => (
            <AlertaOperacionalCard key={a.tipo} config={a} total={alertasMap.get(a.tipo) ?? 0} />
          ))}
        </div>
      </SecaoBloco>

      {/* Filtros — só afetam as análises abaixo (não os totais/alertas acima).
          Na vitrine a barra já vem do PreviewAdminLayout, então não repetir. */}
      {!isPreview && (
        <div className="space-y-3">
          <div>
            <h2
              className="text-2xl font-semibold mb-1"
              style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
            >
              {t("admin.overview.analysisTitle")}
            </h2>
            <p className="text-sm" style={{ color: "#64748B" }}>
              {t("admin.overview.analysisDesc")}
            </p>
          </div>
          <BarraFiltrosGlobais />
        </div>
      )}

      {/* Evolução mensal de profissionais — separada por escopo */}
      <div className="space-y-2">
        <div>
          <h2
            className="text-2xl font-semibold mb-1"
            style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
          >
            {t("admin.overview.evolTitle")}
          </h2>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {t("admin.overview.evolDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SecaoBloco
            titulo={t("admin.overview.evolConsultorioTitle")}
            descricao={t("admin.overview.evolConsultorioDesc")}
            tooltip={t("admin.overview.evolConsultorioTip")}
            acao={<BadgeEscopo escopo="consultorio" />}
            loading={evolProfTipo.isLoading}
            skeletonHeight={280}
          >
            <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
              <GraficoLinhaEvolucao
                dados={evolConsultorio}
                series={[
                  { chave: "novos", nome: t("admin.overview.seriesNew"), cor: "#7C4DBA" },
                  { chave: "ativos", nome: t("admin.overview.seriesActive"), cor: "#5EEAD4" },
                ]}
              />
            </div>
          </SecaoBloco>

          <SecaoBloco
            titulo={t("admin.overview.evolInstitucionalTitle")}
            descricao={t("admin.overview.evolInstitucionalDesc")}
            tooltip={t("admin.overview.evolInstitucionalTip")}
            acao={<BadgeEscopo escopo="institucional" />}
            loading={evolProfTipo.isLoading}
            skeletonHeight={280}
          >
            <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
              <GraficoLinhaEvolucao
                dados={evolInstitucional}
                series={[
                  { chave: "novos", nome: t("admin.overview.seriesNew"), cor: "#0F766E" },
                  { chave: "ativos", nome: t("admin.overview.seriesActive"), cor: "#5EEAD4" },
                ]}
              />
            </div>
          </SecaoBloco>
        </div>
      </div>

      {/* ========== GRUPO CONSULTÓRIO ========== */}
      <GrupoEscopo
        escopo="consultorio"
        titulo={t("admin.overview.consultorioGroupTitle")}
        descricao={t("admin.overview.consultorioGroupDesc")}
      >
        <SecaoBloco
          titulo={t("admin.overview.byPlanTitle")}
          tooltip={t("admin.overview.byPlanTip")}
          acao={<BadgeEscopo escopo="consultorio" />}
          loading={planos.isLoading}
          skeletonHeight={280}
        >
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <GraficoPizzaPlanos rows={planos.data ?? []} />
          </div>
        </SecaoBloco>

        <SecaoBloco
          titulo={t("admin.overview.planEvolTitle")}
          descricao={t("admin.overview.planEvolDesc")}
          tooltip={t("admin.overview.planEvolTip")}
          acao={<BadgeEscopo escopo="consultorio" />}
          loading={evolPlanos.isLoading}
          skeletonHeight={280}
        >
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <GraficoLinhaEvolucao dados={evolPlanosDados} series={seriesPlanos} />
          </div>
        </SecaoBloco>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SecaoBloco
            titulo={t("admin.overview.byCountryTitle")}
            tooltip={t("admin.overview.byCountryTip")}
            acao={<BadgeEscopo escopo="consultorio" />}
            loading={distribuicao.isLoading}
            skeletonHeight={180}
          >
            <TabelaOrdenavel
              denso
              colunas={[
                { chave: "pais", titulo: t("admin.overview.colCountry") },
                { chave: "total_profissionais", titulo: t("admin.overview.colProfShort"), alinhamento: "right" },
                { chave: "pct", titulo: "%", alinhamento: "right", formato: fmtPct },
              ]}
              dados={distPais}
            />
          </SecaoBloco>

          <SecaoBloco
            titulo={t("admin.overview.byStateTitle")}
            tooltip={t("admin.overview.byStateTip")}
            acao={<BadgeEscopo escopo="consultorio" />}
            loading={distribuicao.isLoading}
            skeletonHeight={220}
          >
            <TabelaOrdenavel
              denso
              colunas={[
                { chave: "estado", titulo: t("admin.overview.colState") },
                { chave: "total_profissionais", titulo: t("admin.overview.colProfShort"), alinhamento: "right" },
                { chave: "pct", titulo: t("admin.overview.colPctCountryShort"), alinhamento: "right", formato: fmtPct },
              ]}
              dados={distEstado}
            />
          </SecaoBloco>

          <SecaoBloco
            titulo={t("admin.overview.topCitiesTitle")}
            tooltip={t("admin.overview.topCitiesTip")}
            acao={<BadgeEscopo escopo="consultorio" />}
            loading={topCidades.isLoading}
            skeletonHeight={220}
          >
            <TabelaOrdenavel
              denso
              colunas={[
                { chave: "posicao", titulo: "#", alinhamento: "right" },
                { chave: "cidade", titulo: t("admin.overview.colCity") },
                { chave: "estado", titulo: t("admin.overview.colUf") },
                { chave: "total_profissionais", titulo: t("admin.overview.colProfShort"), alinhamento: "right" },
              ]}
              dados={topCidadesFiltradas}
            />
          </SecaoBloco>
        </div>
      </GrupoEscopo>

      {/* ========== GRUPO INSTITUCIONAL ========== */}
      <GrupoEscopo
        escopo="institucional"
        titulo={t("admin.overview.institutionalGroupTitle")}
        descricao={t("admin.overview.institutionalGroupDesc")}
      >
        <SecaoBloco
          titulo={t("admin.overview.unitsByTypeTitle")}
          tooltip={t("admin.overview.unitsByTypeTip")}
          acao={<BadgeEscopo escopo="institucional" />}
          loading={unidades.isLoading}
          skeletonHeight={280}
        >
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <GraficoPizzaTiposUnidade rows={tiposUnidade} />
          </div>
        </SecaoBloco>

        {mostrarTabelasInstitucionais && (
          <>
            <SecaoBloco
              titulo={t("admin.overview.profByUnitTitle")}
              tooltip={t("admin.overview.profByUnitTip")}
              acao={<BadgeEscopo escopo="institucional" />}
              loading={unidades.isLoading}
              skeletonHeight={220}
            >
              <TabelaOrdenavel
                colunas={[
                  { chave: "nome", titulo: t("admin.overview.colUnit") },
                  { chave: "tipo", titulo: t("admin.overview.colType") },
                  { chave: "cidade", titulo: t("admin.overview.colCity") },
                  { chave: "estado", titulo: t("admin.overview.colUf") },
                  { chave: "total_profissionais", titulo: t("admin.overview.colProfessionals"), alinhamento: "right" },
                ]}
                dados={unidadesFiltradas}
              />
            </SecaoBloco>

            <SecaoBloco
              titulo={t("admin.overview.patByUnitTitle")}
              descricao={t("admin.overview.patByUnitDesc")}
              acao={<BadgeEscopo escopo="institucional" />}
              loading={unidades.isLoading}
              skeletonHeight={220}
            >
              <TabelaOrdenavel
                colunas={[
                  { chave: "nome", titulo: t("admin.overview.colUnit") },
                  { chave: "cidade", titulo: t("admin.overview.colCity") },
                  { chave: "total_pacientes", titulo: t("admin.overview.colPatientsHist"), alinhamento: "right" },
                  { chave: "total_laudos", titulo: t("admin.overview.colReportsGenerated"), alinhamento: "right" },
                ]}
                dados={unidadesFiltradas}
              />
            </SecaoBloco>
          </>
        )}
      </GrupoEscopo>

      {/* Cards finais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="rounded-lg bg-white p-5 flex items-center gap-4"
          style={{ borderLeft: "4px solid #7E69AB", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
        >
          <Users size={28} style={{ color: "#7E69AB" }} />
          <div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B", fontSize: 13 }}>
              {t("admin.overview.managersTotal")}
            </div>
            <div
              style={{
                fontFamily: "Sora, sans-serif",
                color: "#1E293B",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {resumoGlobal.isLoading
                ? "—"
                : (r0?.total_gestores_gerais ?? 0).toLocaleString(locale)}
            </div>
          </div>
        </div>
        <div
          className="rounded-lg bg-white p-5 flex items-center gap-4"
          style={{ borderLeft: "4px solid #9b87f5", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
        >
          <Users size={28} style={{ color: "#9b87f5" }} />
          <div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B", fontSize: 13 }}>
              {t("admin.overview.managersUnit")}
            </div>
            <div
              style={{
                fontFamily: "Sora, sans-serif",
                color: "#1E293B",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {resumoGlobal.isLoading
                ? "—"
                : (r0?.total_gestores_unidade ?? 0).toLocaleString(locale)}
            </div>
          </div>
        </div>
        <div
          className="rounded-lg bg-white p-5 flex items-center gap-4"
          style={{ borderLeft: "4px solid #5EEAD4", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
        >
          <Building2 size={28} style={{ color: "#0F766E" }} />
          <div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B", fontSize: 13 }}>
              {t("admin.overview.consolidationsActive")}
            </div>
            <div
              style={{
                fontFamily: "Sora, sans-serif",
                color: "#1E293B",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {resumoGlobal.isLoading
                ? "—"
                : (r0?.total_consolidacoes ?? 0).toLocaleString(locale)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
