import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Baby, AlertTriangle, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  unidadeId: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
}

interface PartoRow {
  via_parto: string;
  classificacao_rn: string | null;
  intercorrencia_materna: boolean;
  intercorrencia_neonatal: boolean;
}

export default function MetricasPartoSection({ unidadeId, periodoInicio, periodoFim }: Props) {
  const [partos, setPartos] = useState<PartoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unidadeId) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('partos')
        .select('via_parto, classificacao_rn, intercorrencia_materna, intercorrencia_neonatal')
        .eq('unidade_id', unidadeId);
      if (periodoInicio) q = q.gte('data_parto', periodoInicio);
      if (periodoFim) q = q.lte('data_parto', periodoFim);
      const { data } = await q;
      setPartos((data || []) as PartoRow[]);
      setLoading(false);
    })();
  }, [unidadeId, periodoInicio, periodoFim]);

  if (loading) return null;

  const total = partos.length;
  const cesarea = partos.filter(p => p.via_parto === 'cesarea').length;
  const vaginal = partos.filter(p => p.via_parto === 'vaginal').length;
  const aig = partos.filter(p => p.classificacao_rn === 'AIG').length;
  const gig = partos.filter(p => p.classificacao_rn === 'GIG').length;
  const pig = partos.filter(p => p.classificacao_rn === 'PIG').length;
  const intMat = partos.filter(p => p.intercorrencia_materna).length;
  const intNeo = partos.filter(p => p.intercorrencia_neonatal).length;

  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—');

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
          <Baby className="h-5 w-5 text-primary" />
          Partos e desfechos neonatais
        </h2>
        {total === 0 && <Badge variant="outline">Sem dados ainda</Badge>}
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum parto registrado neste período. Os dados aparecerão aqui conforme forem cadastrados.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total de partos" value={total.toString()} />
          <Stat label="Cesáreas" value={`${cesarea} (${pct(cesarea)})`} />
          <Stat label="Vaginais" value={`${vaginal} (${pct(vaginal)})`} />
          <Stat label="Intercorrência materna" value={`${intMat} (${pct(intMat)})`} icon={<AlertTriangle className="h-4 w-4 text-clinical-warning-icon" />} />
          <Stat label="Intercorrência neonatal" value={`${intNeo} (${pct(intNeo)})`} icon={<Activity className="h-4 w-4 text-clinical-warning-icon" />} />
          <Stat label="AIG" value={`${aig} (${pct(aig)})`} />
          <Stat label="GIG" value={`${gig} (${pct(gig)})`} />
          <Stat label="PIG" value={`${pig} (${pct(pig)})`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
