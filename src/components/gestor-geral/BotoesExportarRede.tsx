import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportarTabelaCsv, exportarTabelaExcel, type TabelaExport } from "@/lib/exportarTabelaRede";

interface Props<T> {
  /** Monta a tabela na hora do clique (ordem e filtro que estão na tela). */
  montar: () => TabelaExport<T>;
  disabled?: boolean;
}

/** Botões "Exportar CSV" e "Exportar Excel" — mesmo visual da lista de fichas da unidade. */
export default function BotoesExportarRede<T>({ montar, disabled }: Props<T>) {
  const { t } = useTranslation();
  const [gerando, setGerando] = useState(false);

  const executar = async (tipo: "csv" | "excel") => {
    const tabela = montar();
    if (tabela.linhas.length === 0) {
      toast.info(t("consolidar.exportar.vazio"));
      return;
    }
    setGerando(true);
    try {
      if (tipo === "csv") exportarTabelaCsv(tabela);
      else await exportarTabelaExcel(tabela);
      toast.success(t("consolidar.exportar.gerado"));
    } catch (err) {
      console.error("[BotoesExportarRede] erro:", err);
      toast.error(t("consolidar.exportar.erro"));
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => executar("csv")} disabled={disabled || gerando}>
        <FileDown className="h-4 w-4" /> {t("consolidar.exportar.csv")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => executar("excel")} disabled={disabled || gerando}>
        {gerando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("consolidar.exportar.gerando")}
          </>
        ) : (
          <>
            <FileSpreadsheet className="h-4 w-4" /> {t("consolidar.exportar.excel")}
          </>
        )}
      </Button>
    </div>
  );
}
