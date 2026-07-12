import { Users, UserPlus, MailWarning, FileCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CardResumoEquipe from './CardResumoEquipe';
import ComposicaoClinica from './ComposicaoClinica';
import PerformanceIndividual from './PerformanceIndividual';
import IndicadoresFluxo from './IndicadoresFluxo';
import type { DadosEquipe } from '@/lib/fetchDadosEquipe';

interface Props {
  dados: DadosEquipe;
}

export default function SecaoEquipePdf({ dados }: Props) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4" data-pdf-section="equipe">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {t('team.title')}
      </h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardResumoEquipe
          titulo={t('management.activeProfessionals')}
          valor={dados.totalAtivos}
          sublabel={t('gestao.secaoEquipePdf.incluindoVoce')}
          tooltip=""
          icon={Users}
          erro={dados.errosCards.ativos}
        />
        <CardResumoEquipe
          titulo={t('management.pendingInvites')}
          valor={dados.totalPendentes}
          sublabel={t('management.awaitingAccept')}
          tooltip=""
          icon={UserPlus}
          erro={dados.errosCards.pendentes}
        />
        <CardResumoEquipe
          titulo={t('gestao.secaoEquipePdf.convitesExpirados')}
          valor={dados.totalExpirados}
          sublabel={t('gestao.secaoEquipePdf.reenviarDisponivel')}
          tooltip=""
          icon={MailWarning}
          erro={dados.errosCards.expirados}
        />
        <CardResumoEquipe
          titulo={t('gestao.secaoEquipePdf.laudosGeradosEquipe')}
          valor={dados.totalLaudos}
          sublabel={t('gestao.secaoEquipePdf.totalHistorico')}
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
