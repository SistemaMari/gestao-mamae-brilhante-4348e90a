import { CheckCircle2, Info } from 'lucide-react';

/**
 * PROMPT 42B — Card permanente exibido na ficha quando o acompanhamento
 * foi encerrado por insulinização (Hipótese 3, ≤30 semanas).
 *
 * A MARI emitiu o laudo de insulina com conduta + 3 arranjos de continuidade
 * (GO / endócrino / referência). A partir daqui a jornada ativa dentro da MARI
 * encerra — a continuidade clínica segue com o profissional que introduziu a
 * insulina, conforme os arranjos descritos no laudo.
 *
 * O ajuste visual fino desta caixa fica para a fase Moara; aqui garante-se
 * o dado (motivo/data de encerramento em `pacientes`) e a rota (sem botão
 * de próxima ficha).
 */
export default function EncerramentoInsulinizacaoCard() {
  return (
    <div
      className="rounded-xl border-2 p-5 space-y-4"
      style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
            Acompanhamento da MARI encerrado por insulinização
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
            A introdução de insulina foi indicada e o laudo correspondente foi
            emitido com a conduta e os três arranjos de continuidade (obstetra
            conduzindo, associação com endocrinologista ou referência para
            serviço especializado). O acompanhamento ativo dentro da MARI se
            encerra neste ponto — toda a história clínica, laudos e perfis
            glicêmicos permanecem disponíveis para consulta nesta ficha.
          </p>
        </div>
      </div>

      <div
        className="flex items-start gap-3 rounded-lg border p-3"
        style={{ backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' }}
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#4338CA' }} />
        <p className="text-sm" style={{ color: '#3730A3' }}>
          <strong>Continuidade clínica:</strong> siga os arranjos descritos no
          laudo de insulinização. A MARI não emitirá novos retornos automáticos
          para esta paciente.
        </p>
      </div>
    </div>
  );
}
