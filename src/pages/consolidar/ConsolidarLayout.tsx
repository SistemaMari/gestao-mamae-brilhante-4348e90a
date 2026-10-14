import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiltrosGestorGeralProvider, useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import Saudacao from "@/components/shell/Saudacao";
import FiltrosGlobais from "@/components/gestor-geral/painel/FiltrosGlobais";

// Saudação no padrão do admin, só na tela inicial (Visão Geral), acima dos filtros.
function SaudacaoVisaoGeral() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { gestor } = useFiltrosGestorGeral();
  if (!pathname.endsWith("/visao-geral") || !gestor?.nome) return null;
  return <Saudacao nome={gestor.nome} subtitulo={t("shell.panoramaRede")} />;
}

export default function ConsolidarLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const modoVitrine = pathname.startsWith("/vitrine");

  const VITRINE_MOCK = {
    gestor: { id: "vitrine-gg", nome: t("consolidar.vitrine.gestorNome") },
    unidades: [
      { id: "u-pinheiros", nome: t("consolidar.vitrine.unidadePinheiros") },
      { id: "u-moema", nome: t("consolidar.vitrine.unidadeMoema") },
      { id: "u-lapa", nome: t("consolidar.vitrine.unidadeLapa") },
      { id: "u-vilanova", nome: t("consolidar.vitrine.unidadeVilaNova") },
    ],
    contratantes: { primeiro: t("consolidar.vitrine.contratante"), outros: 0 },
  };

  return (
    <FiltrosGestorGeralProvider modoVitrine={modoVitrine} mockData={VITRINE_MOCK}>
      <div className="flex flex-col gap-5 p-5 md:p-6">
        <SaudacaoVisaoGeral />
        <FiltrosGlobais />
        <Outlet />
      </div>
    </FiltrosGestorGeralProvider>
  );
}
