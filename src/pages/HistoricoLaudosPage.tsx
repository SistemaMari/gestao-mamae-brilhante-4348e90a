import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Loader2, Search, Filter, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface LaudoRow {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  cenario_clinico: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pronto: { label: 'Pronto', variant: 'default' },
  gerando: { label: 'Gerando', variant: 'secondary' },
  pendente: { label: 'Pendente', variant: 'outline' },
  erro: { label: 'Erro', variant: 'destructive' },
};

function fmtData(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export default function HistoricoLaudosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [laudos, setLaudos] = useState<LaudoRow[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroCenario, setFiltroCenario] = useState<string>('todos');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data: prof } = await supabase
        .from('profissionais')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!prof) {
        if (!cancelled) {
          setLaudos([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('laudos')
        .select('id, paciente_id, cenario_clinico, status, created_at, pacientes:paciente_id(nome)')
        .eq('profissional_id', prof.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        setLaudos([]);
        setLoading(false);
        return;
      }

      const rows: LaudoRow[] = (data ?? []).map((l: any) => ({
        id: l.id,
        paciente_id: l.paciente_id,
        paciente_nome: l.pacientes?.nome ?? '—',
        cenario_clinico: l.cenario_clinico,
        status: l.status,
        created_at: l.created_at,
      }));

      setLaudos(rows);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const cenariosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    laudos.forEach((l) => { if (l.cenario_clinico) set.add(l.cenario_clinico); });
    return Array.from(set).sort();
  }, [laudos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return laudos.filter((l) => {
      if (filtroStatus !== 'todos' && l.status !== filtroStatus) return false;
      if (filtroCenario !== 'todos' && l.cenario_clinico !== filtroCenario) return false;
      if (q && !l.paciente_nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [laudos, busca, filtroStatus, filtroCenario]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-primary">
        <History className="h-4 w-4" />
        <span>Histórico</span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-foreground">
        Histórico de laudos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Todos os laudos gerados, em ordem do mais recente para o mais antigo.
      </p>

      {/* Filtros */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="gerando">Gerando</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroCenario} onValueChange={setFiltroCenario}>
            <SelectTrigger><SelectValue placeholder="Cenário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cenários</SelectItem>
              {cenariosDisponiveis.map((c) => (
                <SelectItem key={c} value={c}>Cenário {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Tabela */}
      <section className="mt-6 rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              {laudos.length === 0 ? 'Nenhum laudo ainda' : 'Nenhum laudo corresponde aos filtros'}
            </p>
            <p className="text-xs text-muted-foreground">
              {laudos.length === 0
                ? 'Os laudos gerados nas fichas das pacientes aparecerão aqui.'
                : 'Ajuste os filtros para ver mais resultados.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead className="w-[140px]">Cenário</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[200px]">Gerado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((l) => {
                const status = STATUS_LABEL[l.status] ?? { label: l.status, variant: 'outline' as const };
                return (
                  <TableRow key={l.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link to={`/paciente/${l.paciente_id}`} className="font-medium text-foreground hover:underline">
                        {l.paciente_nome}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {l.cenario_clinico ? `Cenário ${l.cenario_clinico}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtData(l.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
