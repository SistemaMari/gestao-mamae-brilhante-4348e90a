import { Activity, FileText, Users } from 'lucide-react';
import type { PainelOperacao } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

interface Props {
  data: PainelOperacao;
  loading?: boolean;
  error?: string | null;
}

const TT_GESTANTES =
  'Total de gestantes da sua unidade com DUM (Data da Última Menstruação) registrada nos últimos 280 dias — período correspondente à gestação completa. Reflete a carga de atendimento atual da equipe.';
const TT_LAUDOS =
  'Total de laudos de DMG gerados pela sua equipe nos últimos 30 dias. Indica produtividade de diagnóstico no período. Queda brusca pode sinalizar falha no fluxo de rastreamento.';
const TT_PROFS =
  'Profissionais da sua unidade que têm pelo menos 1 paciente em acompanhamento. Útil para detectar profissionais ociosos ou sobrecarregados — veja a distribuição detalhada na aba Equipe.';

interface CardProps {
  title: string;
  tooltip: string;
  value: number | string;
  subtitle: string;
  Icon: React.ElementType;
}

function Card({ title, tooltip, value, subtitle, Icon }: CardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <CardInfoTooltip text={tooltip} />
          </div>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

export default function BlocoOperacao({ data, loading, error }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Operação da unidade
      </h2>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card
              title="Gestantes ativas"
              tooltip={TT_GESTANTES}
              value={data.gestantes_ativas}
              subtitle="DUM nos últimos 280 dias"
              Icon={Users}
            />
            <Card
              title="Laudos nos últimos 30 dias"
              tooltip={TT_LAUDOS}
              value={data.laudos_30d}
              subtitle="emitidos pela equipe"
              Icon={FileText}
            />
            <Card
              title="Profissionais com paciente ativo"
              tooltip={TT_PROFS}
              value={data.distribuicao_profissionais.filter(p => p.total_pacientes_ativos > 0).length}
              subtitle={`de ${data.distribuicao_profissionais.length} na unidade`}
              Icon={Activity}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Distribuição de gestantes ativas por profissional
            </h3>
            {data.distribuicao_profissionais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum profissional vinculado.</p>
            ) : (
              <ul className="space-y-2">
                {data.distribuicao_profissionais.map(p => {
                  const max = Math.max(...data.distribuicao_profissionais.map(x => x.total_pacientes_ativos), 1);
                  const pct = (p.total_pacientes_ativos / max) * 100;
                  return (
                    <li key={p.profissional_id} className="flex items-center gap-3 text-sm">
                      <span className="w-44 shrink-0 truncate text-foreground">{p.nome}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${pct}%`, background: '#9b87f5' }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums text-muted-foreground">
                        {p.total_pacientes_ativos}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
