import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import BotoesExportarRede from "@/components/gestor-geral/BotoesExportarRede";
import { useMetaExportRede } from "@/hooks/useMetaExportRede";
import {
  useConsolidadorGargalosDetalhado,
  type ChaveGargaloGG,
  type GargaloGestanteGG,
} from "@/hooks/usePainelDataGestorGeral";
import { igDiasParaTexto, slugArquivo, type TabelaExport } from "@/lib/exportarTabelaRede";
import { formatDateBR } from "@/lib/dateUtils";

const TITULOS: Record<ChaveGargaloGG, { titulo: string; descricao: string }> = {
  sem_gj_primeira_consulta: { titulo: "gestao.blocoGargalos.semGjTitulo", descricao: "gestao.blocoGargalos.semGjDescricao" },
  atrasadas_gtt: { titulo: "gestao.blocoGargalos.gttTitulo", descricao: "gestao.blocoGargalos.gttDescricao" },
  confirmadas_sem_retorno: { titulo: "gestao.blocoGargalos.semRetornoTitulo", descricao: "gestao.blocoGargalos.semRetornoDescricao" },
};

interface Props {
  /** Gargalo aberto (null = fechado). */
  chave: ChaveGargaloGG | null;
  /** Número mostrado no cartão (para avisar se a lista veio cortada). */
  total: number;
  onClose: () => void;
}

/** Lista das gestantes por trás de um número de gargalo da rede. */
export default function GargalosDetalheDialog({ chave, total, onClose }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useConsolidadorGargalosDetalhado(chave !== null);
  const meta = useMetaExportRede(false);
  const linhas: GargaloGestanteGG[] = chave && data ? data[chave] ?? [] : [];
  const titulo = chave ? t(TITULOS[chave].titulo) : "";
  const fmtData = (v: string | null) => (v ? formatDateBR(v) : t("consolidar.gargalos.semConsulta"));

  const montarExport = (): TabelaExport<GargaloGestanteGG> => ({
    titulo,
    meta: [...meta, [t("consolidar.exportar.metaObservacao"), t("consolidar.gargalos.detalheSubtitulo")]],
    aba: titulo,
    fileBase: `${slugArquivo(t("consolidar.exportar.arquivoGargalo"))}_${slugArquivo(titulo)}_${new Date().toISOString().slice(0, 10)}`,
    linhas,
    colunas: [
      { header: t("consolidar.gargalos.colGestante"), valor: (r) => r.nome, width: 32 },
      { header: t("consolidar.gargalos.colUnidade"), valor: (r) => r.unidade_nome, width: 28 },
      { header: t("consolidar.gargalos.colIg"), valor: (r) => igDiasParaTexto(r.ig_atual_dias) },
      { header: t("consolidar.gargalos.colProfissional"), valor: (r) => r.profissional_nome ?? "—", width: 28 },
      { header: t("consolidar.gargalos.colUltimaConsulta"), valor: (r) => fmtData(r.ultima_consulta), width: 18 },
    ],
  });

  return (
    <Dialog open={chave !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {titulo} {!isLoading && !isError && <span className="text-muted-foreground font-normal">({total})</span>}
          </DialogTitle>
          <DialogDescription>
            {chave ? t(TITULOS[chave].descricao) : ""} {t("consolidar.gargalos.detalheSubtitulo")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <BotoesExportarRede montar={montarExport} disabled={isLoading || isError || linhas.length === 0} />
        </div>

        {isError ? (
          <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            {t("consolidar.gargalos.detalheErro")}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {t("consolidar.gargalos.detalheVazio")}
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-[#E8E0FF] hover:bg-[#E8E0FF] [&>th]:font-semibold [&>th]:text-[#1E293B]">
                    <TableHead>{t("consolidar.gargalos.colGestante")}</TableHead>
                    <TableHead>{t("consolidar.gargalos.colUnidade")}</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        {t("consolidar.gargalos.colIg")}
                        <TooltipInfo text={t("consolidar.gargalos.colIgTip")} />
                      </span>
                    </TableHead>
                    <TableHead>{t("consolidar.gargalos.colProfissional")}</TableHead>
                    <TableHead>{t("consolidar.gargalos.colUltimaConsulta")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((r) => (
                    <TableRow key={r.paciente_id}>
                      <TableCell className="font-medium text-[#1E293B]">{r.nome}</TableCell>
                      <TableCell className="text-[#475569]">{r.unidade_nome ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{igDiasParaTexto(r.ig_atual_dias)}</TableCell>
                      <TableCell className="text-[#475569]">{r.profissional_nome ?? "—"}</TableCell>
                      <TableCell className="tabular-nums text-[#475569]">{fmtData(r.ultima_consulta)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {linhas.length < total && (
              <p className="text-xs text-muted-foreground">
                {t("consolidar.gargalos.detalheLimite", { mostrando: linhas.length, total })}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
