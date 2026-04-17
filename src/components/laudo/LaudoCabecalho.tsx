import { format } from 'date-fns';
import { cenarioLabel, type Cenario } from '@/lib/laudoMapping';

interface Props {
  paciente: { nome: string };
  igSemanas: number;
  igDias: number;
  dataLaudo: Date;
  cenario: Cenario;
}

export default function LaudoCabecalho({ paciente, igSemanas, igDias, dataLaudo, cenario }: Props) {
  return (
    <header className="laudo-cabecalho rounded-t-xl border-b-2 border-[#D6BCFA] bg-white px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-[11px] uppercase tracking-wider text-[#7E69AB]">
            Laudo
          </p>
          <h2 className="font-heading text-base font-bold text-[#5B21B6]">
            Dra. Mari DMG Diagnóstica
          </h2>
        </div>
        <span className="inline-flex items-center rounded-full border border-[#D6BCFA] bg-[#F1F0FB] px-2.5 py-0.5 text-[11px] font-semibold text-[#7E69AB]">
          {cenarioLabel(cenario)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-[#4C1D95] sm:grid-cols-3">
        <div>
          <dt className="inline font-semibold text-[#5B21B6]">Paciente: </dt>
          <dd className="inline">{paciente.nome}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[#5B21B6]">IG: </dt>
          <dd className="inline">{igSemanas} sem + {igDias} dias</dd>
        </div>
        <div className="sm:text-right">
          <dt className="inline font-semibold text-[#5B21B6]">Data: </dt>
          <dd className="inline">{format(dataLaudo, 'dd/MM/yyyy')}</dd>
        </div>
      </dl>
    </header>
  );
}
