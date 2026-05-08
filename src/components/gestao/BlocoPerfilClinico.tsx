import { HeartPulse, Syringe, Activity, CalendarClock, AlertTriangle, AlertCircle } from 'lucide-react';
import type { PainelPerfilClinico } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  data: PainelPerfilClinico;
  loading?: boolean;
  error?: string | null;
}

const TT_PREVALENCIA =
  'Porcentagem das suas gestantes ativas com diagnóstico confirmado de DMG. Referência Febrasgo no Brasil: 7-18% da população gestante. Abaixo de 7% pode indicar subdiagnóstico — revise se o rastreamento está sendo feito conforme protocolo. Acima de 18% sugere população de alto risco — fatores como obesidade, idade materna avançada e histórico familiar podem estar elevando a prevalência local.';
const TT_INSULINA =
  'Pacientes com DMG confirmado que estão em terapia com insulina. Em populações brasileiras com DMG, espera-se que 20-30% das diagnosticadas precisem de insulinoterapia (Febrasgo). Percentuais muito acima podem indicar diagnóstico tardio ou perfis mais graves.';
const TT_DMG_ANTERIOR =
  'Pacientes com histórico de DMG em gestação anterior. Esse grupo tem risco até 7x maior de repetir o diagnóstico — são candidatas a rastreamento precoce, antes da janela padrão de 24-28 semanas (Febrasgo).';
const TT_IG_MEDIA =
  'Idade gestacional média (em semanas + dias) em que sua equipe diagnostica DMG, considerando os últimos 90 dias. Janela ideal de rastreamento Febrasgo: 24-28 semanas. Acima de 28 semanas indica diagnóstico tardio — paciente pode chegar ao terceiro trimestre sem tratamento adequado, aumentando risco de macrossomia e complicações no parto.';

function formatIg(dias: number | null) {
  if (dias == null) return '—';
  const w = Math.floor(dias / 7);
  const d = dias % 7;
  return `${w}s ${d}d`;
}

type StatusPrevalencia = 'subnotificacao' | 'esperado' | 'alto_risco';

export default function BlocoPerfilClinico({ data, loading, error }: Props) {
  const status: StatusPrevalencia =
    data.prevalencia_pct < 7
      ? 'subnotificacao'
      : data.prevalencia_pct > 18
        ? 'alto_risco'
        : 'esperado';

  const dentroDoBenchmark = status === 'esperado';

  return (
    <section className="space-y-3" data-pdf-section="perfil">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Perfil clínico das pacientes
      </h2>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : data.total_acompanhadas === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem gestantes ativas no momento.
        </div>
      ) : (
        <>
          {status === 'subnotificacao' && (
            <div className="mb-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-900">
              ⚠️ Sua prevalência de DMG está abaixo do esperado ({data.prevalencia_pct}% vs. faixa Febrasgo de 7-18%). Pode indicar subdiagnóstico — revise se o rastreamento está sendo feito conforme protocolo na primeira consulta e na janela 24-28 semanas.
            </div>
          )}
          {status === 'alto_risco' && (
            <div className="mb-4 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4 text-sm text-orange-900">
              ⚠️ Sua prevalência de DMG está acima do esperado ({data.prevalencia_pct}% vs. faixa Febrasgo de 7-18%). Pode indicar população de alto risco — considere revisar fatores demográficos como idade materna, IMC pré-gestacional e histórico familiar.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Prevalência de DMG</p>
                    <CardInfoTooltip text={TT_PREVALENCIA} />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-heading text-2xl font-bold text-foreground">
                      {data.prevalencia_pct}%
                    </p>
                    {status === 'subnotificacao' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        <AlertTriangle className="h-3 w-3" />
                        Subnotificação
                      </span>
                    )}
                    {status === 'alto_risco' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        <AlertCircle className="h-3 w-3" />
                        Alto risco
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.total_dmg_confirmadas} de {data.total_acompanhadas}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      dentroDoBenchmark
                        ? 'text-emerald-600'
                        : status === 'alto_risco'
                          ? 'text-orange-600'
                          : 'text-yellow-700'
                    }`}
                  >
                    Esperado: 7–18% (Febrasgo)
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: '#E8E0FF' }}>
                  <HeartPulse className="h-5 w-5" style={{ color: '#7E69AB' }} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">Em insulina</p>
                    <CardInfoTooltip text={TT_INSULINA} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {data.em_insulina}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.em_insulina_pct}% das DMG
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Syringe className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">DMG em gestação anterior</p>
                    <CardInfoTooltip text={TT_DMG_ANTERIOR} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {data.dmg_anterior}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.dmg_anterior_pct}% das ativas
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-muted-foreground">IG média ao diagnóstico</p>
                    <CardInfoTooltip text={TT_IG_MEDIA} />
                  </div>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {formatIg(data.ig_media_diagnostico_dias)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">últimos 90 dias</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
