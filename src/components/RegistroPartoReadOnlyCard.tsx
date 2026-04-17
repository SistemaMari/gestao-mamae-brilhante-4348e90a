import { Baby } from 'lucide-react';
import type { PreviewConsulta } from '@/lib/previewPatients';

type DadosParto = {
  via_parto?: 'vaginal' | 'cesarea';
  motivo_cesarea?: string | null;
  ig_semanas?: number;
  ig_dias?: number;
  data_parto?: string;
  peso_rn_g?: number;
  classificacao_rn?: 'AIG' | 'GIG' | 'PIG';
  apgar_1min?: number;
  apgar_5min?: number;
  intercorrencias_maternas?: boolean;
  desc_intercorrencias_maternas?: string | null;
  intercorrencias_neonatais?: boolean;
  desc_intercorrencias_neonatais?: string | null;
  aleitamento_sala_parto?: boolean;
  observacoes?: string | null;
};

function parseDados(observacoes: string | null | undefined): DadosParto | null {
  if (!observacoes) return null;
  try {
    const obj = JSON.parse(observacoes);
    if (obj && typeof obj === 'object') return obj as DadosParto;
  } catch {
    return null;
  }
  return null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 py-1">
      <span className="text-xs font-medium text-[#5B21B6] sm:w-48 shrink-0">{label}</span>
      <span className="text-xs text-[#1E293B]">{value ?? '—'}</span>
    </div>
  );
}

export default function RegistroPartoReadOnlyCard({
  consulta,
}: { consulta: PreviewConsulta }) {
  const dados = parseDados(consulta.observacoes);

  if (!dados) {
    return (
      <div className="rounded-lg border border-[#D6BCFA] bg-[#F1F0FB] p-3">
        <p className="text-xs text-[#6D28D9]">
          Dados do parto registrados, mas sem detalhes estruturados.
        </p>
      </div>
    );
  }

  const via =
    dados.via_parto === 'cesarea'
      ? `Cesárea${dados.motivo_cesarea ? ` (${dados.motivo_cesarea})` : ''}`
      : dados.via_parto === 'vaginal'
      ? 'Vaginal'
      : '—';

  const ig =
    dados.ig_semanas != null
      ? `${dados.ig_semanas} sem + ${dados.ig_dias ?? 0} dias`
      : '—';

  const peso =
    dados.peso_rn_g != null
      ? `${dados.peso_rn_g.toLocaleString('pt-BR')} g${
          dados.classificacao_rn ? ` — Classificação: ${dados.classificacao_rn}` : ''
        }`
      : '—';

  const apgar =
    dados.apgar_1min != null && dados.apgar_5min != null
      ? `${dados.apgar_1min} / ${dados.apgar_5min} (1º / 5º minuto)`
      : '—';

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#F1F0FB] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Baby className="h-4 w-4 text-[#7E69AB]" />
        <h3 className="text-sm font-bold text-[#5B21B6]">Dados do parto</h3>
      </div>

      <div className="rounded-lg bg-white/70 p-3 space-y-1">
        <Row label="Via de parto" value={via} />
        <Row label="IG no parto" value={ig} />
        <Row label="Peso do RN" value={peso} />
        <Row label="Apgar" value={apgar} />
        <Row
          label="Intercorrências maternas"
          value={
            dados.intercorrencias_maternas
              ? `Sim${dados.desc_intercorrencias_maternas ? ` — ${dados.desc_intercorrencias_maternas}` : ''}`
              : 'Não'
          }
        />
        <Row
          label="Intercorrências neonatais"
          value={
            dados.intercorrencias_neonatais
              ? `Sim${dados.desc_intercorrencias_neonatais ? ` — ${dados.desc_intercorrencias_neonatais}` : ''}`
              : 'Não'
          }
        />
        <Row
          label="Aleitamento na sala de parto"
          value={dados.aleitamento_sala_parto ? 'Sim' : 'Não'}
        />
        {dados.observacoes && <Row label="Observações" value={dados.observacoes} />}
      </div>
    </div>
  );
}
