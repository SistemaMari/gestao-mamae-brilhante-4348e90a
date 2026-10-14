// Textos das metas da rede no idioma da tela (selo e tabela "Metas por unidade").
import { useTranslation } from "react-i18next";
import { CFG_META, type IndicadorMeta, type SituacaoMeta } from "@/lib/metas";

/** "80%" ou "30 dias", no idioma da tela. */
export function useFormatarMeta() {
  const { t, i18n } = useTranslation();
  return (indicador: IndicadorMeta, valor: number) => {
    const n = Number(valor).toLocaleString(i18n.language, { maximumFractionDigits: 1 });
    return CFG_META[indicador].unidade === "pct" ? `${n}%` : t("gestao.linhaCuidado.dias", { valor: n });
  };
}

/** Texto do selo para a situação (sem_meta → null). */
export function useTextoSituacao() {
  const { t } = useTranslation();
  return (indicador: IndicadorMeta, situacao: SituacaoMeta): string | null => {
    switch (situacao) {
      case "sem_meta":
        return null;
      case "atingida":
        return t("gestao.metas.atingida");
      case "nao_atingida":
        return CFG_META[indicador].sentido === "maximo" ? t("gestao.metas.acimaLimite") : t("gestao.metas.abaixo");
      case "poucos_dados":
        return t("gestao.metas.poucosDados");
      case "sem_dados":
        return t("gestao.metas.semDados");
    }
  };
}
