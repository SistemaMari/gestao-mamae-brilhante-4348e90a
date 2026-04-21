import { FileText } from 'lucide-react';

interface Consulta1ResultCardProps {
  /** Mantidas por compatibilidade — não são mais usadas neste card. */
  janelaGTT?: { inicio: Date; fim: Date } | null;
  igMaior24?: boolean;
}

export default function Consulta1ResultCard(_props: Consulta1ResultCardProps) {
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
    </div>
  );
}
