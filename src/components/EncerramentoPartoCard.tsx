import { CheckCircle2, Printer } from 'lucide-react';

/**
 * Card permanente exibido na ficha quando o parto foi registrado
 * (status = resultado_parto). Encerra o acompanhamento da Dra. Mari.
 */
export default function EncerramentoPartoCard() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 p-5 space-y-4" style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
          <div>
            <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
              Acompanhamento da Dra. Mari encerrado
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
              O acompanhamento desta paciente pela Dra. Mari Diagnóstica foi concluído com o
              registro do parto. Toda a história clínica, laudos e perfis glicêmicos permanecem
              disponíveis para consulta nesta ficha.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-white/70 p-3 space-y-1">
          <p className="text-sm font-semibold" style={{ color: '#5B21B6' }}>
            Orientação pós-parto
          </p>
          <p className="text-xs" style={{ color: '#6D28D9' }}>
            Lembrete: realizar reteste puerperal (TTG 75g — jejum + 2h) entre 6 e 8 semanas após
            o parto para rastreio de diabete tipo 2.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#94A3B8] print:hidden">
        <Printer className="h-3.5 w-3.5" />
        <span>
          Para salvar ou imprimir esta ficha em PDF: pressione Ctrl+P (Windows) ou Cmd+P (Mac)
          e escolha "Salvar como PDF".
        </span>
      </div>
    </div>
  );
}
