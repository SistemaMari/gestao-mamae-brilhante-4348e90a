import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import { useVisaoGeralRede } from "@/hooks/usePainelDataGestorGeral";
import { exportarConsolidadoPdf } from "@/lib/exportarConsolidadoPdf";

interface Props {
  /** Contêiner da tela do Consolidador (os blocos com data-pdf-section). */
  raiz: RefObject<HTMLElement>;
}

/** "Exportar PDF" do consolidado da rede — mesmo formato do PDF do painel da unidade. */
export default function BotaoExportarPdfRede({ raiz }: Props) {
  const { t } = useTranslation();
  const { filtros, unidades, unidadesEfetivas, redes } = useFiltrosGestorGeral();
  const visaoGeral = useVisaoGeralRede();
  const [gerando, setGerando] = useState(false);

  const executar = async () => {
    if (!raiz.current) return;
    const ids = unidadesEfetivas ?? unidades.map((u) => u.id);
    const selecionadas = unidades.filter((u) => ids.includes(u.id));
    const idsRede = new Set(selecionadas.map((u) => u.contratante_id).filter(Boolean));
    const nomesRede = (redes ?? []).filter((r) => idsRede.has(r.id)).map((r) => r.nome);
    setGerando(true);
    const res = await exportarConsolidadoPdf({
      redeNome: nomesRede.length > 0 ? nomesRede.join(" + ") : t("consolidar.exportar.pdfRedeSemNome"),
      unidadesNomes: selecionadas.map((u) => u.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
      periodo: { inicio: filtros.dataInicio, fim: filtros.dataFim },
      raiz: raiz.current,
      visaoGeral: visaoGeral.data ?? null,
      unidadesIds: unidadesEfetivas,
    });
    setGerando(false);
    if (res.ok) toast.success(t("consolidar.exportar.pdfGerado", { seconds: (res.tempoMs / 1000).toFixed(1) }));
    else toast.error(res.error || t("consolidar.exportar.erro"));
  };

  return (
    <Button variant="outline" size="sm" onClick={executar} disabled={gerando}>
      {gerando ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {t("consolidar.exportar.pdfGerando")}
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4" /> {t("consolidar.exportar.pdf")}
        </>
      )}
    </Button>
  );
}
