import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";

interface Relatorio {
  id: string;
  unidade_id: string;
  periodo_inicio: string;
  origem: string | null;
  arquivo_path: string;
  created_at: string;
}

/** "2026-09-01" → "setembro de 2026" no idioma da tela. */
function rotuloMes(iso: string, locale: string): string {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
}

const TODOS = "todos";

/**
 * Relatórios mensais (PDF) das unidades da rede — os mesmos que o gestor de
 * cada unidade baixa em "Relatórios". Respeita o filtro de unidades do topo;
 * o filtro de período não se aplica (cada relatório já é de um mês).
 */
export default function RelatoriosRedePage() {
  const { t, i18n } = useTranslation();
  const { unidades, unidadesEfetivas, semSelecao } = useFiltrosGestorGeral();
  const modoVitrine = useLocation().pathname.startsWith("/vitrine");
  const [mes, setMes] = useState<string>(TODOS);
  const [baixando, setBaixando] = useState<string | null>(null);

  const ids = useMemo(() => unidadesEfetivas ?? unidades.map((u) => u.id), [unidadesEfetivas, unidades]);
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id, u.nome])), [unidades]);

  const q = useQuery({
    queryKey: ["painel-gg", "relatorios-rede", [...ids].sort().join(",")],
    enabled: !semSelecao && !modoVitrine && ids.length > 0,
    queryFn: async (): Promise<Relatorio[]> => {
      const { data, error } = await supabase
        .from("relatorios_unidade")
        .select("id, unidade_id, periodo_inicio, origem, arquivo_path, created_at")
        .in("unidade_id", ids)
        .order("periodo_inicio", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Relatorio[];
    },
    staleTime: 60_000,
  });

  const meses = useMemo(
    () => Array.from(new Set((q.data ?? []).map((r) => r.periodo_inicio.slice(0, 7)))).sort().reverse(),
    [q.data],
  );
  const linhas = useMemo(
    () =>
      (q.data ?? [])
        .filter((r) => mes === TODOS || r.periodo_inicio.startsWith(mes))
        .sort(
          (a, b) =>
            b.periodo_inicio.localeCompare(a.periodo_inicio) ||
            (nomeUnidade.get(a.unidade_id) ?? "").localeCompare(nomeUnidade.get(b.unidade_id) ?? "", "pt-BR"),
        ),
    [q.data, mes, nomeUnidade],
  );

  if (semSelecao) return <EmptyStateSemSelecao />;

  const baixar = async (r: Relatorio) => {
    setBaixando(r.id);
    try {
      const { data, error } = await supabase.storage.from("relatorios").createSignedUrl(r.arquivo_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("sem URL");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (e) {
      console.error("[RelatoriosRedePage] download", e);
      toast.error(t("gestao.relatorios.erroBaixar"));
    } finally {
      setBaixando(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
            <FileBarChart className="h-5 w-5 text-[#7E69AB]" />
            {t("gestao.relatorios.title")}
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">{t("consolidar.relatorios.subtitle")}</p>
        </div>
        {meses.length > 1 && (
          <div className="w-56">
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger aria-label={t("consolidar.relatorios.filtroMes")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{t("consolidar.relatorios.todosMeses")}</SelectItem>
                {meses.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {rotuloMes(`${m}-01`, i18n.language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {q.isLoading && !modoVitrine ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("gestao.relatorios.carregando")}
        </div>
      ) : q.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {t("gestao.relatorios.erroCarregar")}
        </div>
      ) : linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F0FF]">
            <FileBarChart className="h-6 w-6 text-[#9b87f5]" />
          </div>
          <p className="text-lg font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
            {t("gestao.relatorios.vazioTitulo")}
          </p>
          <p className="mt-1 text-sm text-[#64748B]">{t("consolidar.relatorios.vazio")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#E8E0FF] text-left text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
              <tr>
                <th className="px-4 py-3 font-semibold">{t("consolidar.relatorios.colUnidade")}</th>
                <th className="px-4 py-3 font-semibold">{t("gestao.relatorios.colMes")}</th>
                <th className="px-4 py-3 font-semibold">{t("gestao.relatorios.colOrigem")}</th>
                <th className="px-4 py-3 font-semibold">{t("gestao.relatorios.colGeradoEm")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((r, idx) => (
                <tr key={r.id} className={`border-t border-[#E2E8F0] hover:bg-[#F1F5F9] ${idx % 2 === 1 ? "bg-[#F8FAFC]" : "bg-white"}`}>
                  <td className="px-4 py-3 font-medium text-[#1E293B]">{nomeUnidade.get(r.unidade_id) ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-[#334155]">{rotuloMes(r.periodo_inicio, i18n.language)}</td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {r.origem === "automatico" ? t("gestao.relatorios.origemAutomatico") : t("gestao.relatorios.origemManual")}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{new Date(r.created_at).toLocaleDateString(i18n.language)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => baixar(r)} disabled={baixando === r.id}>
                      {baixando === r.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      {t("gestao.relatorios.baixar")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
