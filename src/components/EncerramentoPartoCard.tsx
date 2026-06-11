import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Card permanente exibido na ficha quando o parto foi registrado
 * (status = resultado_parto). Encerra o acompanhamento da MARI.
 */
export default function EncerramentoPartoCard() {
  return (
    <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
            Acompanhamento da MARI encerrado
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
            O acompanhamento desta paciente pela MARI foi concluído com o
            registro do parto. Toda a história clínica, laudos e perfis glicêmicos permanecem
            disponíveis para consulta nesta ficha.
          </p>
        </div>
      </div>

      {/* 38B-B (#22): lembrete de reteste puerperal — conduta acionável, em âmbar */}
      <div className="flex items-start gap-3 rounded-lg border p-3" style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#B45309' }} />
        <p className="text-sm" style={{ color: '#92400E' }}>
          <strong>Reteste puerperal:</strong> realizar GTT 75g (jejum + 2h) entre 6 e 8 semanas após o parto.
        </p>
      </div>
    </div>
  );
}
