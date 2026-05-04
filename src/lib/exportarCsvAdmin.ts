import type { QueryClient } from "@tanstack/react-query";
import { fetchAdminView, type AdminViewSlug } from "@/lib/adminMetrics";

export interface ExportarCsvParams {
  queryClient: QueryClient;
  view: AdminViewSlug;
  pais?: string;
  nomeArquivo?: string;
  previewMode?: boolean;
  onLoading?: (loading: boolean) => void;
}

function escaparCelula(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (/[;\n\r"]/.test(s)) s = `"${s}"`;
  return s;
}

function rowsParaCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const cabecalhos = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r ?? {}).forEach((k) => acc.add(k));
      return acc;
    }, new Set()),
  );
  const linhas = [cabecalhos.map(escaparCelula).join(";")];
  for (const r of rows) {
    linhas.push(cabecalhos.map((c) => escaparCelula(r?.[c])).join(";"));
  }
  return "\ufeff" + linhas.join("\r\n");
}

export async function exportarCsvAdmin({
  queryClient,
  view,
  pais,
  nomeArquivo,
  previewMode = false,
  onLoading,
}: ExportarCsvParams): Promise<{ ok: boolean; mensagem?: string }> {
  const queryKey = ["admin-metrics", view, pais ?? null, previewMode];
  let rows = queryClient.getQueryData<Array<Record<string, unknown>>>(queryKey);

  if (!rows || rows.length === 0) {
    onLoading?.(true);
    try {
      rows = await queryClient.fetchQuery<Array<Record<string, unknown>>>({
        queryKey,
        queryFn: async () =>
          (await fetchAdminView(view, pais ? { pais } : undefined)) as Array<
            Record<string, unknown>
          >,
      });
    } catch (e) {
      onLoading?.(false);
      return {
        ok: false,
        mensagem: "Falha ao carregar dados para exportação.",
      };
    } finally {
      onLoading?.(false);
    }
  }

  if (!rows || rows.length === 0) {
    return { ok: false, mensagem: "Sem dados para exportar." };
  }

  const csv = rowsParaCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo ?? `${view}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { ok: true };
}
