import { useTranslation } from "react-i18next";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";

const fmtData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/**
 * Metadados das planilhas do gestor geral: período e unidades do filtro ativo,
 * gestor(a) e data/hora de geração. `incluirPeriodo=false` para listas que
 * mostram a situação de hoje (gargalos), que não dependem do período.
 */
export function useMetaExportRede(incluirPeriodo = true): [string, string][] {
  const { t } = useTranslation();
  const { filtros, unidades, unidadesEfetivas, gestor } = useFiltrosGestorGeral();
  const nomesUnidades =
    unidadesEfetivas === null
      ? t("consolidar.exportar.metaTodas", { count: unidades.length })
      : unidades
          .filter((u) => unidadesEfetivas.includes(u.id))
          .map((u) => u.nome)
          .join(", ");
  const agora = new Date();
  const meta: [string, string][] = [];
  if (incluirPeriodo) {
    meta.push([t("consolidar.exportar.metaPeriodo"), `${fmtData(filtros.dataInicio)} – ${fmtData(filtros.dataFim)}`]);
  }
  meta.push([t("consolidar.exportar.metaUnidades"), nomesUnidades]);
  if (gestor?.nome) meta.push([t("consolidar.exportar.metaGestor"), gestor.nome]);
  meta.push([
    t("consolidar.exportar.metaGeradoEm"),
    `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  ]);
  return meta;
}
