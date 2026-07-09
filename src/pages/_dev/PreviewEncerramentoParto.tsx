import { Baby } from 'lucide-react';
import EncerramentoPartoCard from '@/components/EncerramentoPartoCard';
import RegistroPartoReadOnlyCard from '@/components/RegistroPartoReadOnlyCard';

const mockConsulta = {
  id: 'mock',
  tipo_consulta: 'registro_parto',
  observacoes: JSON.stringify({
    via_parto: 'vaginal',
    ig_semanas: 39,
    ig_dias: 2,
    data_parto: '2026-06-20',
    peso_rn_g: 3450,
    sexo_rn: 'F',
    classificacao_rn: 'AIG',
    apgar_1min: 9,
    apgar_5min: 10,
    intercorrencias_maternas: false,
    intercorrencias_neonatais: false,
    aleitamento_sala_parto: true,
    observacoes: 'Parto sem intercorrências. Alta materna e neonatal em 48h.',
  }),
} as any;

export default function PreviewEncerramentoParto() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8">
      <div className="mx-auto max-w-3xl px-4 space-y-4">
        {/* Cabeçalho da paciente */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-[Sora] text-2xl font-bold text-foreground">
                Maria Aparecida da Silva
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                32 anos · Cartão SUS 700 1234 5678 9012
              </p>
              <p className="mt-1 text-sm text-[#7E69AB]">UBS Vila Esperança</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6BCFA] bg-[#F1F0FB] px-3 py-1 text-xs font-semibold text-[#5B21B6]">
              <Baby className="h-3.5 w-3.5" />
              Acompanhamento encerrado (parto)
            </span>
          </div>
        </div>

        <EncerramentoPartoCard />
        <RegistroPartoReadOnlyCard consulta={mockConsulta} />

        <p className="text-center text-xs text-muted-foreground">
          Preview visual · dados fictícios
        </p>
      </div>
    </div>
  );
}
