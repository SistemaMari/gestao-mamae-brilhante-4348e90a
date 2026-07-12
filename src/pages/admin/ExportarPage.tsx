import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, FileJson, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminFiltros } from "@/contexts/AdminFiltrosContext";
import { exportarCsvAdmin } from "@/lib/exportarCsvAdmin";
import { todayLocalISO } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import type { AdminViewSlug } from "@/lib/adminMetrics";

type Formato = "csv" | "xlsx" | "pdf";

const COR = "#7C4DBA";
const COR_HOVER = "#5A3690";
const BADGE_BG = "#EDE5F7";
const BADGE_TXT = "#5A3690";

const CONTEUDO_IDS = [
  "completo",
  "usuarios",
  "diagnosticos",
  "profissionais_por_estado",
  "dmg_por_estado",
  "dmg_por_cidade",
  "metricas_por_unidade",
  "funil_tratamento",
  "desfechos_perinatais",
] as const;

// Mapa conteudo CSV → view do admin-metrics
const CSV_VIEW: Partial<Record<string, AdminViewSlug>> = {
  usuarios: "unidades_resumo",
  profissionais_por_estado: "distribuicao_geografica",
  dmg_por_cidade: "top_cidades",
  metricas_por_unidade: "unidades_resumo",
};

function ResumoFiltros() {
  const { t } = useTranslation();
  const { filtros, filtrosAtivosCount } = useAdminFiltros();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700" style={{ fontFamily: "Sora, sans-serif" }}>
          {t("admin.exportar.appliedFilters")}
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: BADGE_BG, color: BADGE_TXT }}
        >
          {t("admin.exportar.activeCount", { count: filtrosAtivosCount })}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">{t("admin.exportar.period")}</dt>
          <dd className="text-slate-800">
            {filtros.periodo_inicio ?? "—"} → {filtros.periodo_fim ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.overview.colCountry")}</dt>
          <dd className="text-slate-800">{filtros.pais === "todos" ? t("common.all") : filtros.pais}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.overview.colState")}</dt>
          <dd className="text-slate-800">{filtros.estado === "todos" ? t("common.all") : filtros.estado}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.overview.colCity")}</dt>
          <dd className="text-slate-800">{filtros.cidade === "todos" ? t("admin.exportar.allFemale") : filtros.cidade}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.exportar.accountType")}</dt>
          <dd className="text-slate-800">{filtros.tipo_conta === "todos" ? t("admin.exportar.allFemale") : filtros.tipo_conta}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.overview.colUnit")}</dt>
          <dd className="text-slate-800">
            {filtros.unidade_id === "todos" ? t("admin.exportar.allFemale") : filtros.unidade_id.slice(0, 8) + "…"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("admin.exportar.diagnosisMoment")}</dt>
          <dd className="text-slate-800">
            {filtros.momento_diagnostico === "todos" ? t("common.all") : filtros.momento_diagnostico}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export default function ExportarPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const previewMode = pathname.startsWith("/vitrine");
  const queryClient = useQueryClient();
  const { contratoExportacao } = useAdminFiltros();

  const TIMEOUT_MSG = t("admin.exportar.timeoutMsg");
  const CONTEUDOS = CONTEUDO_IDS.map((id) => ({
    id,
    label: t(`admin.exportar.conteudos.${id}.label`),
    desc: t(`admin.exportar.conteudos.${id}.desc`),
  }));

  const [conteudo, setConteudo] = useState<string>("completo");
  const [formato, setFormato] = useState<Formato>("xlsx");
  const [estado, setEstado] = useState<"idle" | "carregando" | "gerando" | "ok" | "vazio" | "erro" | "timeout">("idle");
  const [mensagem, setMensagem] = useState<string>("");
  const [arquivoUrl, setArquivoUrl] = useState<string>("");
  const [arquivoNome, setArquivoNome] = useState<string>("");

  const exportar = async () => {
    setEstado("idle");
    setMensagem("");
    setArquivoUrl("");
    setArquivoNome("");

    if (previewMode) {
      setEstado("erro");
      setMensagem(t("admin.exportar.previewUnavailable"));
      return;
    }

    if (formato === "csv") {
      const view = CSV_VIEW[conteudo];
      if (!view) {
        setEstado("erro");
        setMensagem(t("admin.exportar.csvOnlySpecific"));
        return;
      }
      setEstado("carregando");
      const res = await exportarCsvAdmin({
        queryClient,
        view,
        previewMode,
        nomeArquivo: `${conteudo}_${todayLocalISO()}.csv`,
        onLoading: (l) => setEstado(l ? "carregando" : "gerando"),
      });
      if (res.ok) {
        setEstado("ok");
        setMensagem(t("admin.exportar.csvGenerated"));
      } else {
        setEstado("erro");
        setMensagem(res.mensagem ?? t("admin.exportar.csvFailed"));
      }
      return;
    }

    // xlsx ou pdf via Edge Function
    setEstado("gerando");
    try {
      // Timeout client-side de 60s para detectar exportações grandes.
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 60000);
      const promise = supabase.functions.invoke("exportar-relatorio-admin", {
        body: { formato, conteudo, filtros: contratoExportacao },
      });
      const winner = await Promise.race([
        promise,
        new Promise<never>((_, rej) => {
          controller.signal.addEventListener("abort", () => rej(new Error("__timeout__")));
        }),
      ]);
      clearTimeout(tid);
      const { data, error } = winner as Awaited<typeof promise>;

      if (error) {
        const status = (error as any)?.context?.status;
        let respText: string | null = null;
        try {
          respText = await (error as any)?.context?.text?.();
        } catch { /* ignore */ }
        console.error(
          "[exportar] Conteúdo:", conteudo,
          "Formato:", formato,
          "Body:", { conteudo, filtros: contratoExportacao },
          "Erro:", error,
          "Status:", status,
          "Response:", respText,
        );
        const msg = String(error.message ?? "").toLowerCase();
        if (msg.includes("timeout") || msg.includes("aborted") || msg.includes("__timeout__")) {
          setEstado("timeout");
          setMensagem(TIMEOUT_MSG);
        } else {
          setEstado("erro");
          setMensagem(`${t("admin.exportar.reportFailed", { status: status ?? "?" })} ${respText ?? error.message ?? ""}`.slice(0, 220));
        }
        return;
      }

      const payload = data as {
        status?: string;
        arquivo_url?: string;
        arquivo_nome?: string;
        mensagem?: string;
      };

      if (payload?.status === "vazio") {
        setEstado("vazio");
        setMensagem(payload.mensagem ?? t("admin.exportar.noDataForFilters"));
        return;
      }

      if (payload?.arquivo_url) {
        setArquivoUrl(payload.arquivo_url);
        setArquivoNome(payload.arquivo_nome ?? `relatorio.${formato}`);
        setEstado("ok");
        setMensagem(t("admin.exportar.reportGenerated"));
        // Inicia download automaticamente
        const a = document.createElement("a");
        a.href = payload.arquivo_url;
        a.download = payload.arquivo_nome ?? `relatorio.${formato}`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setEstado("erro");
        setMensagem(t("admin.exportar.unexpectedResponse"));
      }
    } catch (e: unknown) {
      console.error(
        "[exportar] Conteúdo:", conteudo,
        "Formato:", formato,
        "Body:", { conteudo, filtros: contratoExportacao },
        "Erro (catch):", e,
      );
      const msg = String((e as Error)?.message ?? "").toLowerCase();
      if (msg.includes("__timeout__") || msg.includes("aborted")) {
        setEstado("timeout");
        setMensagem(TIMEOUT_MSG);
      } else {
        setEstado("erro");
        setMensagem(t("admin.exportar.reportFailedGeneric", { message: (e as Error)?.message ?? t("admin.exportar.unknownError") }).slice(0, 220));
      }
    }
  };

  const desabilitado = estado === "carregando" || estado === "gerando";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          {t("admin.exportar.title")}
        </h2>
        <p className="text-sm text-slate-600">
          {t("admin.exportar.subtitle")}
        </p>
      </div>

      <BarraFiltrosGlobais />

      <ResumoFiltros />

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3" style={{ fontFamily: "Sora, sans-serif" }}>
          {t("admin.exportar.contentLabel")}
        </h3>
        <Select value={conteudo} onValueChange={setConteudo}>
          <SelectTrigger className="w-full md:w-[420px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTEUDOS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs text-slate-500">{c.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <h3 className="mt-6 text-sm font-semibold text-slate-700 mb-3" style={{ fontFamily: "Sora, sans-serif" }}>
          {t("admin.exportar.formatLabel")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: "xlsx" as const, icon: FileSpreadsheet, label: t("admin.exportar.formatXlsx"), desc: t("admin.exportar.formatXlsxDesc") },
            { id: "pdf" as const, icon: FileText, label: t("admin.exportar.formatPdf"), desc: t("admin.exportar.formatPdfDesc") },
            { id: "csv" as const, icon: FileJson, label: t("admin.exportar.formatCsv"), desc: t("admin.exportar.formatCsvDesc") },
          ].map((opt) => {
            const ativo = formato === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFormato(opt.id)}
                className="rounded-lg border p-4 text-left transition-colors"
                style={{
                  borderColor: ativo ? COR : "#E2E8F0",
                  borderWidth: ativo ? 2 : 1,
                  background: ativo ? BADGE_BG : "white",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-5 w-5" style={{ color: ativo ? COR : "#64748B" }} />
                  <span className="font-medium text-sm text-slate-800">{opt.label}</span>
                </div>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={exportar}
            disabled={desabilitado}
            className="gap-2 text-white"
            style={{ background: COR }}
            onMouseEnter={(e) => (e.currentTarget.style.background = COR_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.background = COR)}
          >
            {desabilitado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {estado === "carregando"
              ? t("admin.exportar.loadingData")
              : estado === "gerando"
              ? t("admin.exportar.generatingReport")
              : t("admin.exportar.generateDownload")}
          </Button>

          {estado === "ok" && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {mensagem}
            </span>
          )}
          {(estado === "vazio" || estado === "erro" || estado === "timeout") && (
            <span className="inline-flex items-center gap-1 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              {mensagem}
            </span>
          )}
          {estado === "erro" && (
            <Button variant="outline" size="sm" onClick={exportar}>
              {t("common.tryAgain")}
            </Button>
          )}
        </div>

        {arquivoUrl && estado === "ok" && (
          <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "#E2E8F0" }}>
            <a
              href={arquivoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium"
              style={{ color: COR }}
            >
              <Download className="h-4 w-4" />
              {t("admin.exportar.downloadAgain", { nome: arquivoNome })}
            </a>
            <p className="mt-1 text-xs text-slate-500">{t("admin.exportar.linkValid")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
