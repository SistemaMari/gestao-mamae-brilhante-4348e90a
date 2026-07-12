import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { type Cenario } from '@/lib/laudoMapping';

interface Props {
  paciente: { nome: string };
  // 34C-B: IG pode ser null quando a paciente não tem âncora definida
  // (sem DUM e sem USG de referência). Estado explícito — sem fallback {0,0}.
  igSemanas: number | null;
  igDias: number | null;
  dataLaudo: Date;
  cenario: Cenario;
}

export default function LaudoCabecalho({ paciente, igSemanas, igDias, dataLaudo }: Props) {
  const { t } = useTranslation();
  const igTexto =
    igSemanas != null && igDias != null
      ? `${igSemanas}s ${igDias}d`
      : t('laudo.cabecalho.igNaoDefinida');

  return (
    <header className="laudo-cabecalho rounded-t-xl border-b-2 border-[#D6BCFA] bg-white px-5 py-4">
      <div>
        <p className="font-heading text-[11px] uppercase tracking-wider text-[#7E69AB]">
          {t('laudo.cabecalho.laudo')}
        </p>
        <h2 className="font-heading text-base font-bold text-[#5B21B6]">
          MARI
        </h2>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-[#4C1D95] sm:grid-cols-3">
        <div>
          <dt className="inline font-semibold text-[#5B21B6]">{t('laudo.cabecalho.paciente')} </dt>
          <dd className="inline">{paciente.nome}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#5B21B6]">{t('laudo.cabecalho.ig')} </dt>
          <dd className="inline">{igTexto}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="inline font-semibold text-[#5B21B6]">{t('laudo.cabecalho.data')} </dt>
          <dd className="inline">{format(dataLaudo, 'dd/MM/yyyy')}</dd>
        </div>
      </dl>
    </header>
  );
}
