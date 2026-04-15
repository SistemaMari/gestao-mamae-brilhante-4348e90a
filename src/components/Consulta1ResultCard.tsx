import { FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Consulta1ResultCardProps {
  janelaGTT: { inicio: Date; fim: Date } | null;
  igMaior24: boolean;
}

export default function Consulta1ResultCard({ janelaGTT, igMaior24 }: Consulta1ResultCardProps) {
  return (
    <div className="space-y-4">
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
          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-sm font-semibold text-emerald-900">Janela para GTT 75g</p>
            <p className="mt-1 text-xs text-emerald-800">
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
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
        <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
          <li>Não repetir glicemia de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.</li>
          <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.</li>
          <li>Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.</li>
        </ul>
      </div>
    </div>
  );
}
