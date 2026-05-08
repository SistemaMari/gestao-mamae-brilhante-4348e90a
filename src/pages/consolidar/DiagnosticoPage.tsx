import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import {
  useDiagnosticoKpis,
  useDiagnosticoRanking,
  useDiagnosticoAlertas,
  useTopDestaques,
} from "@/hooks/usePainelDataGestorGeral";
import EmptyStateSemSelecao from "@/components/gestor-geral/EmptyStateSemSelecao";
import BlocoKpis from "@/components/gestor-geral/painel/BlocoKpis";
import BlocoRanking from "@/components/gestor-geral/painel/BlocoRanking";
import BlocoAlertas from "@/components/gestor-geral/painel/BlocoAlertas";
import BlocoTopDestaques from "@/components/gestor-geral/painel/BlocoTopDestaques";

export default function DiagnosticoPage() {
  const { semSelecao } = useFiltrosGestorGeral();
  const kpis = useDiagnosticoKpis();
  const ranking = useDiagnosticoRanking();
  const alertas = useDiagnosticoAlertas();
  const destaques = useTopDestaques();

  if (semSelecao) return <EmptyStateSemSelecao />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          Diagnóstico operacional
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Indicadores agregados, ranking e alertas determinísticos da rede.
        </p>
      </div>
      <BlocoKpis
        data={kpis.data}
        isLoading={kpis.isLoading}
        isError={kpis.isError}
        onRetry={() => kpis.refetch()}
      />
      <BlocoTopDestaques
        data={destaques.data}
        isLoading={destaques.isLoading}
        isError={destaques.isError}
      />
      <BlocoRanking
        data={ranking.data}
        isLoading={ranking.isLoading}
        isError={ranking.isError}
        onRetry={() => ranking.refetch()}
      />
      <BlocoAlertas
        data={alertas.data}
        isLoading={alertas.isLoading}
        isError={alertas.isError}
        onRetry={() => alertas.refetch()}
      />
    </div>
  );
}
