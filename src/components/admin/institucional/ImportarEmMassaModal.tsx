import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { extrairErroEdge, MENSAGENS_UNICIDADE, FALLBACK_GENERICO } from "@/lib/mensagensUnicidade";

/**
 * Importação em massa (Excel/CSV) — motor genérico reaproveitado por Profissionais,
 * Unidades e Gestores. Cada tela passa uma `config` com as colunas do modelo, um
 * exemplo, a ação da edge function `gerenciar-institucional` e o `preparar` (valida
 * a linha crua e devolve o payload ou os erros). Fluxo: baixar modelo → subir →
 * prévia validada → confirmar → relatório por linha. Um erro numa linha não derruba o lote.
 */
export interface ColunaModelo {
  chave: string;
  obrigatoria?: boolean;
}

export interface Preparado {
  payload: Record<string, unknown> | null;
  erros: string[];
  /** rótulo curto da linha (ex.: nome/e-mail) para o relatório */
  rotulo: string;
}

export interface ImportConfig {
  slug: string;
  titulo: string;
  descricao: string;
  acao: string;
  colunas: ColunaModelo[];
  exemplo: Record<string, string>;
  preparar: (linha: Record<string, string>) => Preparado;
}

type LinhaPrevia = { indice: number; raw: Record<string, string> } & Preparado;
type Resultado = { rotulo: string; ok: boolean; motivo?: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: ImportConfig;
  onSucesso: () => void;
}

export default function ImportarEmMassaModal({ open, onOpenChange, config, onSucesso }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaPrevia[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  const validas = useMemo(() => linhas.filter((l) => l.payload && l.erros.length === 0), [linhas]);
  const invalidas = linhas.length - validas.length;

  function reset() {
    setLinhas([]); setNomeArquivo(""); setEnviando(false); setProgresso(0); setResultados(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function baixarModelo() {
    const headers = config.colunas.map((c) => c.chave);
    const ws = XLSX.utils.json_to_sheet([config.exemplo], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "modelo");
    XLSX.writeFile(wb, `modelo-${config.slug}.xlsx`);
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setResultados(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed: LinhaPrevia[] = raw.map((r, i) => {
        // normaliza chaves (trim) e valores para string
        const linha: Record<string, string> = {};
        for (const k of Object.keys(r)) linha[k.trim()] = String(r[k] ?? "").trim();
        return { indice: i + 2, raw: linha, ...config.preparar(linha) };
      });
      setLinhas(parsed);
    } catch {
      setLinhas([]);
      setNomeArquivo("");
    }
  }

  async function confirmar() {
    if (validas.length === 0 || enviando) return;
    setEnviando(true);
    setProgresso(0);
    const res: Resultado[] = [];
    for (let i = 0; i < validas.length; i++) {
      const l = validas[i];
      const { error } = await supabase.functions.invoke("gerenciar-institucional", {
        body: { acao: config.acao, ...l.payload },
      });
      if (error) {
        const { codigo } = await extrairErroEdge(error);
        res.push({ rotulo: l.rotulo, ok: false, motivo: (codigo && MENSAGENS_UNICIDADE[codigo]) || FALLBACK_GENERICO });
      } else {
        res.push({ rotulo: l.rotulo, ok: true });
      }
      setProgresso(i + 1);
    }
    setEnviando(false);
    setResultados(res);
    if (res.some((r) => r.ok)) onSucesso();
  }

  const okCount = resultados?.filter((r) => r.ok).length ?? 0;
  const erroCount = resultados?.filter((r) => !r.ok).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-[#5B3A8E]">{config.titulo}</DialogTitle>
          <DialogDescription>{config.descricao}</DialogDescription>
        </DialogHeader>

        {/* RELATÓRIO */}
        {resultados ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg border border-[#6EE7B7] bg-[#ECFDF5] p-3">
                <p className="text-2xl font-bold text-[#065F46]">{okCount}</p>
                <p className="text-xs text-[#047857]">{t("importar.report.ok")}</p>
              </div>
              <div className="flex-1 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3">
                <p className="text-2xl font-bold text-[#991B1B]">{erroCount}</p>
                <p className="text-xs text-[#B91C1C]">{t("importar.report.errors")}</p>
              </div>
            </div>
            {erroCount > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E2E8F0]">
                {resultados.filter((r) => !r.ok).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 border-b border-[#F1F5F9] px-3 py-2 text-sm last:border-0">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" />
                    <span><b>{r.rotulo}</b> — {r.motivo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Passo 1 — modelo */}
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2 text-sm text-[#475569]">
                <FileSpreadsheet className="h-4 w-4 text-[#7C4DBA]" />
                {t("importar.step1")}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={baixarModelo}>
                <Download className="mr-1 h-4 w-4" /> {t("importar.downloadTemplate")}
              </Button>
            </div>

            {/* Passo 2 — upload */}
            <div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onArquivo}
                className="hidden"
                id="importar-arquivo"
              />
              <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> {nomeArquivo || t("importar.chooseFile")}
              </Button>
            </div>

            {/* Passo 3 — prévia */}
            {linhas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-[#475569]">
                  {t("importar.previewCount", { total: linhas.length, ok: validas.length, erros: invalidas })}
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border border-[#E2E8F0]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#F1F0FB] text-[#5B3A8E]">
                      <tr>
                        <th className="px-2 py-1.5 w-6"></th>
                        {config.colunas.map((c) => <th key={c.chave} className="px-2 py-1.5 font-semibold">{c.chave}</th>)}
                        <th className="px-2 py-1.5 font-semibold">{t("importar.rowStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => {
                        const ok = l.payload && l.erros.length === 0;
                        return (
                          <tr key={l.indice} className="border-t border-[#F1F5F9]">
                            <td className="px-2 py-1.5">
                              {ok
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-[#DC2626]" />}
                            </td>
                            {config.colunas.map((c) => (
                              <td key={c.chave} className="px-2 py-1.5 text-[#334155]">{l.raw[c.chave] ?? ""}</td>
                            ))}
                            <td className="px-2 py-1.5 text-[#DC2626]">{l.erros.join("; ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={enviando}>
            {resultados ? t("common.close") : t("common.cancel")}
          </Button>
          {!resultados && (
            <Button
              type="button"
              onClick={confirmar}
              disabled={validas.length === 0 || enviando}
              className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {enviando
                ? t("importar.sending", { done: progresso, total: validas.length })
                : t("importar.confirm", { count: validas.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
