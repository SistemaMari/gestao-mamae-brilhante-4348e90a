import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Users, Building2 } from "lucide-react";
import { CardResumo } from "@/components/admin/CardResumo";
import { TabelaOrdenavel } from "@/components/admin/TabelaOrdenavel";
import { AlertaOperacionalCard, ALERTAS_CONFIG } from "@/components/admin/AlertaOperacionalCard";
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

const fmtMes = (mes: string) => {
  const d = new Date(mes);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

export default function VisaoGeralPage() {
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/vitrine");

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
    [evolProf.data],
  );

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
  }, [evolPlanos.data]);

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
      const k = u.tipo ?? "Não informado";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([tipo, total]) => ({ tipo, total }));
  }, [unidadesFiltradas]);

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
    const m = new Map<string, { profissionais: number; unidades: number }>();
    distribuicaoFiltrada.forEach((r) => {
      const cur = m.get(r.pais) ?? { profissionais: 0, unidades: 0 };
      cur.profissionais += r.total_profissionais;
      cur.unidades += r.total_unidades;
      m.set(r.pais, cur);
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v.profissionais, 0) || 1;
    return Array.from(m.entries()).map(([pais, v]) => ({
      pais,
      total_profissionais: v.profissionais,
      total_unidades: v.unidades,
      pct: Math.round((v.profissionais / total) * 1000) / 10,
    }));
  }, [distribuicaoFiltrada]);

  const distEstado = useMemo(() => {
    const m = new Map<string, { profissionais: number; unidades: number }>();
    distribuicaoFiltrada.forEach((r) => {
      const cur = m.get(r.estado) ?? { profissionais: 0, unidades: 0 };
      cur.profissionais += r.total_profissionais;
      cur.unidades += r.total_unidades;
      m.set(r.estado, cur);
    });
    const total = Array.from(m.values()).reduce((s, v) => s + v.profissionais, 0) || 1;
    return Array.from(m.entries()).map(([estado, v]) => ({
      estado,
      total_profissionais: v.profissionais,
      total_unidades: v.unidades,
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
      <div>
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          Visão Geral
        </h2>
        <p className="text-sm" style={{ color: "#64748B" }}>
          Panorama do sistema em tempo quase real.
        </p>
      </div>

      {/* Cards rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo label="Total de profissionais" valor={resumo.profissionais} loading={loadingResumo} />
        <CardResumo label="Total de unidades" valor={resumo.unidades} loading={loadingResumo} />
        <CardResumo label="Total de pacientes" valor={resumo.pacientes} loading={loadingResumo} />
        <CardResumo label="Total de laudos gerados" valor={resumo.laudos} loading={loadingResumo} />
      </div>

      {/* Alertas operacionais */}
      <SecaoBloco
        titulo="Alertas Operacionais"
        descricao="Sinais que merecem atenção da operação."
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

      {/* Evolução mensal de profissionais */}
      <SecaoBloco
        titulo="Evolução mensal de profissionais"
        descricao="Novos cadastros e profissionais ativos nos últimos 12 meses."
        loading={evolProf.isLoading}
        skeletonHeight={280}
      >
        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <GraficoLinhaEvolucao
            dados={evolProfDados}
            series={[
              { chave: "novos", nome: "Novos profissionais", cor: "#7C4DBA" },
              { chave: "ativos", nome: "Ativos no mês", cor: "#5EEAD4" },
            ]}
          />
        </div>
      </SecaoBloco>

      {/* Pizzas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecaoBloco
          titulo="Profissionais por plano"
          loading={planos.isLoading}
          skeletonHeight={280}
        >
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <GraficoPizzaPlanos rows={planos.data ?? []} />
          </div>
        </SecaoBloco>
        <SecaoBloco
          titulo="Unidades por tipo"
          loading={unidades.isLoading}
          skeletonHeight={280}
        >
          <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <GraficoPizzaTiposUnidade rows={tiposUnidade} />
          </div>
        </SecaoBloco>
      </div>

      {/* Evolução de planos */}
      <SecaoBloco
        titulo="Evolução mensal de planos"
        descricao="Novos profissionais por plano nos últimos 12 meses."
        loading={evolPlanos.isLoading}
        skeletonHeight={280}
      >
        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <GraficoLinhaEvolucao dados={evolPlanosDados} series={seriesPlanos} />
        </div>
      </SecaoBloco>

      {/* Distribuição por país */}
      <SecaoBloco
        titulo="Distribuição por país"
        loading={distribuicao.isLoading}
        skeletonHeight={180}
      >
        <TabelaOrdenavel
          colunas={[
            { chave: "pais", titulo: "País" },
            { chave: "total_profissionais", titulo: "Profissionais", alinhamento: "right" },
            { chave: "total_unidades", titulo: "Unidades", alinhamento: "right" },
            {
              chave: "pct",
              titulo: "% profissionais",
              alinhamento: "right",
              formato: (v) => `${(v as number).toLocaleString("pt-BR")}%`,
            },
          ]}
          dados={distPais}
        />
      </SecaoBloco>

      {/* Distribuição por estado */}
      <SecaoBloco
        titulo="Distribuição por estado"
        loading={distribuicao.isLoading}
        skeletonHeight={220}
      >
        <TabelaOrdenavel
          colunas={[
            { chave: "estado", titulo: "Estado" },
            { chave: "total_profissionais", titulo: "Profissionais", alinhamento: "right" },
            { chave: "total_unidades", titulo: "Unidades", alinhamento: "right" },
            {
              chave: "pct",
              titulo: "% no país",
              alinhamento: "right",
              formato: (v) => `${(v as number).toLocaleString("pt-BR")}%`,
            },
          ]}
          dados={distEstado}
        />
      </SecaoBloco>

      {/* Top cidades */}
      <SecaoBloco titulo="Top 20 cidades" loading={topCidades.isLoading} skeletonHeight={220}>
        <TabelaOrdenavel
          colunas={[
            { chave: "posicao", titulo: "#", alinhamento: "right" },
            { chave: "cidade", titulo: "Cidade" },
            { chave: "estado", titulo: "Estado" },
            { chave: "pais", titulo: "País" },
            { chave: "total_profissionais", titulo: "Profissionais", alinhamento: "right" },
          ]}
          dados={topCidadesFiltradas}
        />
      </SecaoBloco>

      {mostrarTabelasInstitucionais && (
        <>
          {/* Profissionais por unidade */}
          <SecaoBloco
            titulo="Profissionais por unidade"
            loading={unidades.isLoading}
            skeletonHeight={220}
          >
            <TabelaOrdenavel
              colunas={[
                { chave: "nome", titulo: "Unidade" },
                { chave: "tipo", titulo: "Tipo" },
                { chave: "cidade", titulo: "Cidade" },
                { chave: "estado", titulo: "UF" },
                { chave: "total_profissionais", titulo: "Profissionais", alinhamento: "right" },
              ]}
              dados={unidadesFiltradas}
            />
          </SecaoBloco>

          {/* Pacientes por unidade */}
          <SecaoBloco
            titulo="Pacientes por unidade"
            descricao="Histórico acumulado de pacientes e laudos gerados por unidade."
            loading={unidades.isLoading}
            skeletonHeight={220}
          >
            <TabelaOrdenavel
              colunas={[
                { chave: "nome", titulo: "Unidade" },
                { chave: "cidade", titulo: "Cidade" },
                { chave: "total_pacientes", titulo: "Pacientes (histórico)", alinhamento: "right" },
                { chave: "total_laudos", titulo: "Laudos gerados", alinhamento: "right" },
              ]}
              dados={unidadesFiltradas}
            />
          </SecaoBloco>
        </>
      )}

      {/* Cards finais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-lg bg-white p-5 flex items-center gap-4"
          style={{ borderLeft: "4px solid #7E69AB", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
        >
          <Users size={28} style={{ color: "#7E69AB" }} />
          <div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B", fontSize: 13 }}>
              Total de gestores gerais
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
                : (r0?.total_gestores_gerais ?? 0).toLocaleString("pt-BR")}
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
              Consolidações ativas
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
                : (r0?.total_consolidacoes ?? 0).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
