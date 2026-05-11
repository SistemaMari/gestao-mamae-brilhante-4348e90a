import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Loader2, Search, Filter, History, Eye, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { downloadLaudoPdf, laudoConteudoToText } from '@/lib/laudoPdf';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import RealtimeIndicator from '@/components/RealtimeIndicator';

interface LaudoRow {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  conteudo_laudo: string | null;
  status: string;
  created_at: string;
  profissional_id: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
}

function fmtData(iso: string) {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function formatMedico(nome: string | null, crm: string | null): string {
  if (!nome) return '—';
  const partes = [`Dr(a). ${nome}`];
  if (crm) partes.push(`CRM ${crm}`);
  return partes.join(' — ');
}

export default function HistoricoLaudosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [laudos, setLaudos] = useState<LaudoRow[]>([]);
  const [busca, setBusca] = useState('');

  const fetchLaudos = useCallback(async () => {
    if (!user) return;

    const { data: prof } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!prof) {
      setLaudos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('laudos')
      .select('id, paciente_id, profissional_id, status, conteudo_laudo, created_at, pacientes:paciente_id(nome)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setLaudos([]);
      setLoading(false);
      return;
    }

    const profissionalIds = Array.from(
      new Set((data ?? []).map((l: any) => l.profissional_id).filter(Boolean)),
    );

    const medicoById = new Map<string, { nome: string | null; crm: string | null }>();
    if (profissionalIds.length > 0) {
      const { data: equipe } = await supabase
        .from('equipe_unidade_view' as any)
        .select('id, nome, crm')
        .in('id', profissionalIds);
      (equipe ?? []).forEach((m: any) => {
        medicoById.set(m.id, { nome: m.nome ?? null, crm: m.crm ?? null });
      });
    }

    const rows: LaudoRow[] = (data ?? []).map((l: any) => {
      const med = l.profissional_id ? medicoById.get(l.profissional_id) : null;
      return {
        id: l.id,
        paciente_id: l.paciente_id,
        paciente_nome: l.pacientes?.nome ?? '—',
        conteudo_laudo: l.conteudo_laudo,
        status: l.status,
        created_at: l.created_at,
        profissional_id: l.profissional_id,
        medico_nome: med?.nome ?? null,
        medico_crm: med?.crm ?? null,
      };
    });

    setLaudos(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchLaudos();
  }, [fetchLaudos]);

  // Realtime: laudos da unidade inteira (RLS já filtra o que cada usuário vê)
  const rtStatus = useRealtimeRefresh({
    tables: ['laudos', 'pacientes'],
    onChange: fetchLaudos,
    enabled: !!user,
    channelName: 'historico-laudos',
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return laudos;
    return laudos.filter((l) => l.paciente_nome.toLowerCase().includes(q));
  }, [laudos, busca]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-primary">
        <History className="h-4 w-4" />
        <span>Histórico</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Histórico de laudos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os laudos gerados, em ordem do mais recente para o mais antigo.
          </p>
        </div>
        <RealtimeIndicator status={rtStatus} />
      </div>

      {/* Filtros */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
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
                <TableHead>Médico</TableHead>
                <TableHead className="w-[200px]">Gerado em</TableHead>
                <TableHead className="w-[200px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((l) => {
                const podeBaixar =
                  (l.status === 'gerado' || l.status === 'concluido') && !!l.conteudo_laudo;
                const emProcessamento = l.status === 'processando' || l.status === 'pendente' || l.status === 'gerando';
                const comErro = l.status === 'erro';

                const handleDownload = () => {
                  if (!l.conteudo_laudo) {
                    toast.error('Este laudo ainda não tem conteúdo para baixar.');
                    return;
                  }
                  downloadLaudoPdf({
                    pacienteNome: l.paciente_nome,
                    medicoNome: l.medico_nome,
                    medicoCrm: l.medico_crm,
                    geradoEm: fmtData(l.created_at),
                    conteudo: laudoConteudoToText(l.conteudo_laudo),
                  });
                };

                return (
                  <TableRow key={l.id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link to={`/paciente/${l.paciente_id}`} className="font-medium text-foreground hover:underline">
                        {l.paciente_nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {formatMedico(l.medico_nome, l.medico_crm)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtData(l.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {emProcessamento ? (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Gerando...
                          </Badge>
                        ) : comErro ? (
                          <Badge variant="destructive">Falha na geração</Badge>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/laudo/${l.id}`)}
                              title="Visualizar laudo"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">Ver</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleDownload}
                              disabled={!podeBaixar}
                              title={podeBaixar ? 'Baixar PDF' : 'Laudo ainda não está pronto'}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">PDF</span>
                            </Button>
                          </>
                        )}
                      </div>
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
