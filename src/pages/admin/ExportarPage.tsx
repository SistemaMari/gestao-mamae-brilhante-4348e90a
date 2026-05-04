import { useState } from "react";
import { useLocation } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import type { AdminViewSlug } from "@/lib/adminMetrics";

type Formato = "csv" | "xlsx" | "pdf";

const COR = "#7C4DBA";
const COR_HOVER = "#5A3690";
const BADGE_BG = "#EDE5F7";
const BADGE_TXT = "#5A3690";

const TIMEOUT_MSG =
  "Exportação muito grande. Aplique filtros de período ou tipo de conta para reduzir o volume.";

const CONTEUDOS = [
  { id: "completo", label: "Relatório completo", desc: "Usuários + diagnósticos + desfechos" },
  { id: "usuarios", label: "Usuários e unidades", desc: "Profissionais, planos, geografia" },
  { id: "diagnosticos", label: "Diagnósticos clínicos", desc: "DMG, Overt, tratamento, desfechos" },
  { id: "profissionais_por_estado", label: "Profissionais por estado", desc: "Tabela específica" },
  { id: "dmg_por_estado", label: "DMG por estado", desc: "Tabela específica" },
  { id: "dmg_por_cidade", label: "DMG por cidade", desc: "Tabela específica" },
  { id: "metricas_por_unidade", label: "Métricas por unidade", desc: "Tabela específica" },
  { id: "funil_tratamento", label: "Funil de tratamento", desc: "Tabela específica" },
  { id: "desfechos_perinatais", label: "Desfechos perinatais", desc: "Tabela específica" },
] as const;

// Mapa conteudo CSV → view do admin-metrics
const CSV_VIEW: Partial<Record<string, AdminViewSlug>> = {
  usuarios: "unidades_resumo",
  profissionais_por_estado: "distribuicao_geografica",
  dmg_por_cidade: "top_cidades",
  metricas_por_unidade: "unidades_resumo",
};

function ResumoFiltros() {
  const { filtros, filtrosAtivosCount } = useAdminFiltros();
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700" style={{ fontFamily: "Sora, sans-serif" }}>
          Filtros aplicados
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: BADGE_BG, color: BADGE_TXT }}
        >
          {filtrosAtivosCount} ativo{filtrosAtivosCount === 1 ? "" : "s"}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Período</dt>
          <dd className="text-slate-800">
            {filtros.periodo_inicio ?? "—"} → {filtros.periodo_fim ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">País</dt>
          <dd className="text-slate-800">{filtros.pais === "todos" ? "Todos" : filtros.pais}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estado</dt>
          <dd className="text-slate-800">{filtros.estado === "todos" ? "Todos" : filtros.estado}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Cidade</dt>
          <dd className="text-slate-800">{filtros.cidade === "todos" ? "Todas" : filtros.cidade}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tipo de conta</dt>
          <dd className="text-slate-800">{filtros.tipo_conta === "todos" ? "Todas" : filtros.tipo_conta}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Unidade</dt>
          <dd className="text-slate-800">
            {filtros.unidade_id === "todos" ? "Todas" : filtros.unidade_id.slice(0, 8) + "…"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Momento dx</dt>
          <dd className="text-slate-800">
            {filtros.momento_diagnostico === "todos" ? "Todos" : filtros.momento_diagnostico}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

export default function ExportarPage() {
  const { pathname } = useLocation();
  const previewMode = pathname.startsWith("/vitrine");
  const queryClient = useQueryClient();
  const { contratoExportacao } = useAdminFiltros();

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
      setMensagem("Exportação indisponível no modo vitrine. Acesse /admin com login real.");
      return;
    }

    if (formato === "csv") {
      const view = CSV_VIEW[conteudo];
      if (!view) {
        setEstado("erro");
        setMensagem(
          "CSV disponível apenas para tabelas específicas (usuários, profissionais por estado, DMG por cidade, métricas por unidade). Para o relatório completo, use Excel ou PDF.",
        );
        return;
      }
      setEstado("carregando");
      const res = await exportarCsvAdmin({
        queryClient,
        view,
        previewMode,
        nomeArquivo: `${conteudo}_${new Date().toISOString().slice(0, 10)}.csv`,
        onLoading: (l) => setEstado(l ? "carregando" : "gerando"),
      });
      if (res.ok) {
        setEstado("ok");
        setMensagem("Arquivo CSV gerado e baixado.");
      } else {
        setEstado("erro");
        setMensagem(res.mensagem ?? "Falha ao gerar CSV.");
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
          setMensagem(`Falha ao gerar relatório (${status ?? "?"}). ${respText ?? error.message ?? ""}`.slice(0, 220));
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
        setMensagem(payload.mensagem ?? "Sem dados para os filtros aplicados.");
        return;
      }

      if (payload?.arquivo_url) {
        setArquivoUrl(payload.arquivo_url);
        setArquivoNome(payload.arquivo_nome ?? `relatorio.${formato}`);
        setEstado("ok");
        setMensagem("Relatório gerado com sucesso.");
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
        setMensagem("Resposta inesperada do servidor.");
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
        setMensagem(`Falha ao gerar relatório: ${(e as Error)?.message ?? "erro desconhecido"}`.slice(0, 220));
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
          Exportar relatórios
        </h2>
        <p className="text-sm text-slate-600">
          Gere arquivos consolidados respeitando os filtros aplicados na barra superior.
        </p>
      </div>

      <ResumoFiltros />

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3" style={{ fontFamily: "Sora, sans-serif" }}>
          Conteúdo
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
          Formato
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: "xlsx" as const, icon: FileSpreadsheet, label: "Excel (.xlsx)", desc: "Múltiplas abas com dados estruturados" },
            { id: "pdf" as const, icon: FileText, label: "PDF (.pdf)", desc: "Relatório formatado para impressão" },
            { id: "csv" as const, icon: FileJson, label: "CSV (.csv)", desc: "Tabelas individuais (sem agregações)" },
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
              ? "Carregando dados..."
              : estado === "gerando"
              ? "Gerando relatório..."
              : "Gerar e baixar"}
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
              Tentar novamente
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
              Baixar novamente: {arquivoNome}
            </a>
            <p className="mt-1 text-xs text-slate-500">Link válido por 1 hora.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
