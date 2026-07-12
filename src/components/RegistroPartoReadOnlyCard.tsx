import { Baby } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PreviewConsulta } from '@/lib/previewPatients';

type DadosParto = {
  via_parto?: 'vaginal' | 'cesarea';
  motivo_cesarea?: string | null;
  ig_semanas?: number;
  ig_dias?: number;
  data_parto?: string;
  peso_rn_g?: number;
  sexo_rn?: 'M' | 'F';
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
  const { t, i18n } = useTranslation();
  const dados = parseDados(consulta.observacoes);

  if (!dados) {
    return (
      <div className="rounded-lg border border-[#D6BCFA] bg-[#F1F0FB] p-3">
        <p className="text-xs text-[#6D28D9]">
          {t('registroPartoReadOnly.noStructuredData')}
        </p>
      </div>
    );
  }

  const via =
    dados.via_parto === 'cesarea'
      ? `${t('registroParto.cesarean')}${dados.motivo_cesarea ? ` (${dados.motivo_cesarea})` : ''}`
      : dados.via_parto === 'vaginal'
      ? t('registroParto.vaginal')
      : '—';

  const ig =
    dados.ig_semanas != null
      ? `${dados.ig_semanas}s ${dados.ig_dias ?? 0}d`
      : '—';

  const peso =
    dados.peso_rn_g != null
      ? `${dados.peso_rn_g.toLocaleString(i18n.language)} g${
          dados.classificacao_rn ? ` — ${t('registroPartoReadOnly.classificationLabel')}: ${dados.classificacao_rn}` : ''
        }`
      : '—';

  const apgar =
    dados.apgar_1min != null && dados.apgar_5min != null
      ? `${dados.apgar_1min} / ${dados.apgar_5min} ${t('registroPartoReadOnly.apgarMinutes')}`
      : '—';

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#F1F0FB] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Baby className="h-4 w-4 text-[#7E69AB]" />
        <h3 className="text-sm font-bold text-[#5B21B6]">{t('registroPartoReadOnly.title')}</h3>
      </div>

      <div className="rounded-lg bg-white/70 p-3 space-y-1">
        <Row label={t('registroParto.viaLabel')} value={via} />
        <Row label={t('registroParto.igLabel')} value={ig} />
        <Row label={t('registroParto.pesoRnLabel')} value={peso} />
        <Row
          label={t('registroParto.sexoRnLabel')}
          value={
            dados.sexo_rn === 'M'
              ? t('registroParto.male')
              : dados.sexo_rn === 'F'
              ? t('registroParto.female')
              : '—'
          }
        />
        <Row label={t('registroParto.apgarLabel')} value={apgar} />
        <Row
          label={t('registroParto.intercorrMatLabel')}
          value={
            dados.intercorrencias_maternas
              ? `${t('common.yes')}${dados.desc_intercorrencias_maternas ? ` — ${dados.desc_intercorrencias_maternas}` : ''}`
              : t('common.no')
          }
        />
        <Row
          label={t('registroParto.intercorrNeoLabel')}
          value={
            dados.intercorrencias_neonatais
              ? `${t('common.yes')}${dados.desc_intercorrencias_neonatais ? ` — ${dados.desc_intercorrencias_neonatais}` : ''}`
              : t('common.no')
          }
        />
        <Row
          label={t('registroParto.aleitamentoLabel')}
          value={dados.aleitamento_sala_parto ? t('common.yes') : t('common.no')}
        />
        {dados.observacoes && <Row label={t('registroParto.observacoesLabel')} value={dados.observacoes} />}
      </div>
    </div>
  );
}
