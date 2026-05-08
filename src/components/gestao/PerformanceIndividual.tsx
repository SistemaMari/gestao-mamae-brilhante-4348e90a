import { TrendingUp, TrendingDown } from 'lucide-react';
import CardInfoTooltip from './CardInfoTooltip';

export interface ProfPerformance {
  id: string;
  nome: string;
  crm: string | null;
  laudos: number;
  pacientes: number;
}

interface Props {
  profissionais: ProfPerformance[];
  loading?: boolean;
  erro?: boolean;
}

function Linha({ p, cor }: { p: ProfPerformance; cor: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 py-2.5 first:border-t-0">
      <div>
        <div className="text-sm font-medium text-foreground">{p.nome}</div>
        <div className="text-[11px] text-muted-foreground">{p.crm || '—'}</div>
      </div>
      <div className="text-right">
        <div className="text-sm" style={{ color: cor, fontWeight: 500 }}>
          {p.laudos} {p.laudos === 1 ? 'laudo' : 'laudos'}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {p.pacientes} {p.pacientes === 1 ? 'paciente' : 'pacientes'}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="h-10 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

export default function PerformanceIndividual({ profissionais, loading, erro }: Props) {
  // Ordenar por laudos desc para "mais ativos"; asc para "menos ativos"
  const total = profissionais.length;
  const sortedDesc = [...profissionais].sort((a, b) => b.laudos - a.laudos);
  const top3 = sortedDesc.slice(0, 3);
  const top3Ids = new Set(top3.map(p => p.id));
  const restantes = sortedDesc.filter(p => !top3Ids.has(p.id));
  const bottom3 = [...restantes].sort((a, b) => a.laudos - b.laudos).slice(0, 3);

  const equipePequena = total <= 3;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {/* Mais ativos */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: '#1D9E75' }} />
          <h3 className="font-heading text-base font-semibold text-foreground">
            Mais ativos
          </h3>
          <CardInfoTooltip text="Os 3 profissionais com maior produção de laudos da equipe. Pode ser útil para reconhecimento, mentoria de novos membros ou redistribuição de carga." />
        </div>
        {loading ? (
          <Skeleton />
        ) : erro ? (
          <p className="text-sm text-muted-foreground">Erro ao carregar.</p>
        ) : top3.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
        ) : (
          <div>
            {top3.map(p => <Linha key={p.id} p={p} cor="#1D9E75" />)}
          </div>
        )}
      </div>

      {/* Menos ativos */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5" style={{ color: '#BA7517' }} />
          <h3 className="font-heading text-base font-semibold text-foreground">
            Menos ativos
          </h3>
          <CardInfoTooltip text="Os 3 profissionais com menor produção de laudos da equipe. Avalie se há sobrecarga em outros profissionais que justifique redistribuição, ou se algum membro precisa de suporte." />
        </div>
        {loading ? (
          <Skeleton />
        ) : erro ? (
          <p className="text-sm text-muted-foreground">Erro ao carregar.</p>
        ) : equipePequena || bottom3.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Equipe pequena — sem distinção de menos ativos.
          </p>
        ) : (
          <div>
            {bottom3.map(p => <Linha key={p.id} p={p} cor="#BA7517" />)}
          </div>
        )}
      </div>
    </div>
  );
}
