import { FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Consulta1ResultCardProps {
  janelaGTT: { inicio: Date; fim: Date } | null;
  igMaior24: boolean;
}

export default function Consulta1ResultCard({ janelaGTT, igMaior24 }: Consulta1ResultCardProps) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
      <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Pedido de exame — Consulta 1
      </h2>

      <div className="rounded-lg bg-white/70 p-3">
        <p className="text-sm font-semibold text-emerald-900">Orientação do exame</p>
        <p className="mt-1 text-xs text-emerald-800">
          Consulta 1 registrada com sucesso. Solicitar glicemia plasmática de jejum. Jejum de 8 a 12 horas. Coleta venosa processada em laboratório — glicemia capilar em ponta de dedo não é válida para fins diagnósticos.
        </p>
      </div>

      {janelaGTT && (
        <div className="rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-3">
          <p className="text-sm font-semibold text-[#92400E]">Janela para GTT 75g</p>
          <p className="mt-1 text-xs text-[#92400E]">
            {igMaior24 ? (
              'O GTT 75g já está na janela — solicitar o mais breve possível.'
            ) : (
              <>
                O GTT 75g deverá ser realizado o mais próximo possível da 24ª semana (entre{' '}
                <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>
                ). Oriente a paciente desde já.
              </>
            )}
          </p>
          <p className="mt-2 text-xs italic text-[#92400E]/80">
            Esta orientação aparece desde agora para que a paciente tenha tempo de agendar o exame, que frequentemente tem fila nas unidades de saúde. Caso não consiga realizar dentro da janela, o exame deve ser feito o mais breve possível — mesmo após 28 semanas.
          </p>
        </div>
      )}
    </div>
  );
}
