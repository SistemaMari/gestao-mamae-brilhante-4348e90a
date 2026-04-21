import { format } from 'date-fns';

interface JanelaGttCardProps {
  janelaGTT: { inicio: Date; fim: Date } | null;
  igMaior24: boolean;
}

/**
 * Card "Janela para GTT 75g" — exibido APENAS no laudo do Retorno 1
 * quando o resultado da glicemia de jejum é NEGATIVO (< 92 mg/dL).
 * Posicionado entre o Bloco 1 e o Bloco 2 do laudo.
 */
export default function JanelaGttCard({ janelaGTT, igMaior24 }: JanelaGttCardProps) {
  if (!janelaGTT) return null;

  return (
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
  );
}
