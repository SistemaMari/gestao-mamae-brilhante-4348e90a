import { Outlet, useLocation } from "react-router-dom";
import { FiltrosGestorGeralProvider } from "@/contexts/FiltrosGestorGeralContext";
import FiltrosGlobais from "@/components/gestor-geral/painel/FiltrosGlobais";

const VITRINE_MOCK = {
  gestor: { id: "vitrine-gg", nome: "Dr. Demo Gestor Geral" },
  unidades: [
    { id: "u-pinheiros", nome: "UBS Demo Pinheiros" },
    { id: "u-moema", nome: "UBS Demo Moema" },
    { id: "u-lapa", nome: "UBS Demo Lapa" },
    { id: "u-vilanova", nome: "UBS Demo Vila Nova" },
  ],
  contratantes: { primeiro: "Demo Health", outros: 0 },
};

export default function ConsolidarLayout() {
  const { pathname } = useLocation();
  const modoVitrine = pathname.startsWith("/vitrine");

  return (
    <FiltrosGestorGeralProvider modoVitrine={modoVitrine} mockData={VITRINE_MOCK}>
      <div className="flex flex-col gap-5 p-5 md:p-6">
        <FiltrosGlobais />
        <Outlet />
      </div>
    </FiltrosGestorGeralProvider>
  );
}
