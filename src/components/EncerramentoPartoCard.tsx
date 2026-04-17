import { CheckCircle2 } from 'lucide-react';

/**
 * Card permanente exibido na ficha quando o parto foi registrado
 * (status = resultado_parto). Encerra o acompanhamento da MARI.
 */
export default function EncerramentoPartoCard() {
  return (
    <div className="rounded-xl border-2 p-5" style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
            Acompanhamento da MARI encerrado
          </h2>
          <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
            O acompanhamento desta paciente pela MARI Diagnóstica foi concluído com o
            registro do parto. Toda a história clínica, laudos e perfis glicêmicos permanecem
            disponíveis para consulta nesta ficha.
          </p>
        </div>
      </div>
    </div>
  );
}
