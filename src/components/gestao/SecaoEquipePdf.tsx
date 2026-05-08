import { Users, UserPlus, MailWarning, FileCheck } from 'lucide-react';
import CardResumoEquipe from './CardResumoEquipe';
import ComposicaoClinica from './ComposicaoClinica';
import PerformanceIndividual from './PerformanceIndividual';
import IndicadoresFluxo from './IndicadoresFluxo';
import type { DadosEquipe } from '@/lib/fetchDadosEquipe';

interface Props {
  dados: DadosEquipe;
}

export default function SecaoEquipePdf({ dados }: Props) {
  return (
    <section className="space-y-4" data-pdf-section="equipe">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Equipe da unidade
      </h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardResumoEquipe
          titulo="Profissionais ativos"
          valor={dados.totalAtivos}
          sublabel="incluindo você"
          tooltip=""
          icon={Users}
          erro={dados.errosCards.ativos}
        />
        <CardResumoEquipe
          titulo="Convites pendentes"
          valor={dados.totalPendentes}
          sublabel="aguardando aceite"
          tooltip=""
          icon={UserPlus}
          erro={dados.errosCards.pendentes}
        />
        <CardResumoEquipe
          titulo="Convites expirados"
          valor={dados.totalExpirados}
          sublabel="reenviar disponível"
          tooltip=""
          icon={MailWarning}
          erro={dados.errosCards.expirados}
        />
        <CardResumoEquipe
          titulo="Laudos gerados pela equipe"
          valor={dados.totalLaudos}
          sublabel="total histórico"
          tooltip=""
          icon={FileCheck}
          erro={dados.errosCards.laudos}
        />
      </div>

      <ComposicaoClinica
        profissionais={dados.profissionaisEquipe}
        erro={dados.erroComposicao}
      />

      <PerformanceIndividual
        profissionais={dados.performance}
        erro={dados.erroPerformance}
      />

      <IndicadoresFluxo
        tempoMedioDias={dados.tempoMedioDias}
        sobrecarregados={dados.sobrecarregados}
        erroTempo={dados.erroTempo}
        erroSobrecarga={dados.erroSobrecarga}
      />
    </section>
  );
}
