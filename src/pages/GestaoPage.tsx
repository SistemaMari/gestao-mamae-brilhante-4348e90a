import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Users, FileText, UserPlus, ArrowRight, Building2, Clock, Download, Filter, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AtividadeRecente {
  id: string;
  tipo: 'consulta' | 'laudo' | 'ficha';
  descricao: string;
  profissional_nome: string;
  data: string;
}

interface FichaResumo {
  id: string;
  nome: string;
  status_ficha: string;
  profissional_nome: string;
  data_ultima_consulta: string | null;
  created_at: string;
}

export default function GestaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unidadeNome, setUnidadeNome] = useState('');
  const [_unidadeId, setUnidadeId] = useState<string | null>(null);
  const [totalProfissionais, setTotalProfissionais] = useState(0);
  const [convitesPendentes, setConvitesPendentes] = useState(0);
  const [totalFichas, setTotalFichas] = useState(0);
  const [totalLaudos, setTotalLaudos] = useState(0);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [fichas, setFichas] = useState<FichaResumo[]>([]);
  const [_loading, setLoading] = useState(true);

  // Filters
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  useEffect(() => {
    if (!user) return;
    fetchDados();
  }, [user]);

  const fetchDados = async () => {
    if (!user) return;
    setLoading(true);

    const { data: prof } = await supabase
      .from('profissionais')
      .select('unidade_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!prof?.unidade_id) { setLoading(false); return; }
    setUnidadeId(prof.unidade_id);

    // First get profissionais to use their IDs in subsequent queries
    const [unidadeRes, profsRes, convitesRes] = await Promise.all([
      supabase.from('unidades').select('nome').eq('id', prof.unidade_id).single(),
      supabase.from('profissionais').select('id, nome').eq('unidade_id', prof.unidade_id),
      supabase.from('convites').select('id').eq('unidade_id', prof.unidade_id).eq('status', 'pendente'),
    ]);

    const profIds = (profsRes.data || []).map(p => p.id);
    const profissionaisMap = new Map((profsRes.data || []).map(p => [p.id, p.nome]));
    const safeIds = profIds.length > 0 ? profIds : ['00000000-0000-0000-0000-000000000000'];

    const [fichasRes, laudosRes, consultasRes] = await Promise.all([
      supabase.from('pacientes').select('id, nome, status_ficha, profissional_id, data_ultima_consulta, created_at').eq('unidade_id', prof.unidade_id),
      supabase.from('laudos').select('id, created_at, profissional_id, status').in('profissional_id', safeIds),
      supabase.from('consultas').select('id, data, profissional_id, tipo, paciente_id').in('profissional_id', safeIds).order('data', { ascending: false }).limit(20),
    ]);

    setUnidadeNome(unidadeRes.data?.nome || '');
    setTotalProfissionais(profsRes.data?.length || 0);
    setConvitesPendentes(convitesRes.data?.length || 0);
    setTotalFichas(fichasRes.data?.length || 0);
    setTotalLaudos(laudosRes.data?.length || 0);

    // Build fichas list
    const fichasList: FichaResumo[] = (fichasRes.data || []).map(f => ({
      id: f.id,
      nome: f.nome,
      status_ficha: f.status_ficha,
      profissional_nome: (profissionaisMap.get(f.profissional_id) || 'Desconhecido') as string,
      data_ultima_consulta: f.data_ultima_consulta,
      created_at: f.created_at,
    }));
    setFichas(fichasList);

    // Build activity feed
    const acts: AtividadeRecente[] = [];
    (consultasRes.data || []).forEach(c => {
      acts.push({
        id: c.id,
        tipo: 'consulta',
        descricao: `${c.tipo === 'consulta_1' ? 'Primeira consulta' : 'Retorno'} registrado`,
        profissional_nome: (profissionaisMap.get(c.profissional_id) || 'Desconhecido') as string,
        data: c.data,
      });
    });
    (laudosRes.data || []).slice(0, 10).forEach(l => {
      acts.push({
        id: l.id,
        tipo: 'laudo',
        descricao: `Laudo ${l.status === 'gerado' ? 'gerado' : 'pendente'}`,
        profissional_nome: (profissionaisMap.get(l.profissional_id) || 'Desconhecido') as string,
        data: l.created_at,
      });
    });
    acts.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    setAtividades(acts.slice(0, 10));

    setLoading(false);
  };

  // Filtered fichas
  const fichasFiltradas = useMemo(() => {
    let result = [...fichas];

    if (filtroStatus !== 'todos') {
      result = result.filter(f => f.status_ficha === filtroStatus);
    }

    if (filtroPeriodo !== 'todos') {
      const now = new Date();
      const dias = filtroPeriodo === '7d' ? 7 : filtroPeriodo === '30d' ? 30 : 90;
      const limite = new Date(now.getTime() - dias * 86400000);
      result = result.filter(f => new Date(f.created_at) >= limite);
    }

    return result;
  }, [fichas, filtroStatus, filtroPeriodo]);

  // Export functions
  const exportCSV = () => {
    const headers = ['Nome', 'Status', 'Profissional', 'Última Consulta', 'Criada em'];
    const rows = fichasFiltradas.map(f => [
      f.nome,
      traduzirStatus(f.status_ficha),
      f.profissional_nome,
      f.data_ultima_consulta ? new Date(f.data_ultima_consulta).toLocaleDateString('pt-BR') : '—',
      new Date(f.created_at).toLocaleDateString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadFile(csv, 'fichas_unidade.csv', 'text/csv');
    toast.success('CSV exportado com sucesso!');
  };

  const exportJSON = () => {
    const data = fichasFiltradas.map(f => ({
      nome: f.nome,
      status: traduzirStatus(f.status_ficha),
      profissional: f.profissional_nome,
      ultima_consulta: f.data_ultima_consulta,
      criada_em: f.created_at,
    }));
    downloadFile(JSON.stringify(data, null, 2), 'fichas_unidade.json', 'application/json');
    toast.success('JSON exportado com sucesso!');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const traduzirStatus = (status: string) => {
    const map: Record<string, string> = {
      aguardando_gj: 'Aguardando GJ',
      em_acompanhamento: 'Em acompanhamento',
      alta: 'Alta',
      concluido: 'Concluído',
    };
    return map[status] || status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_acompanhamento':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Em acompanhamento</Badge>;
      case 'alta':
        return <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/30">Alta</Badge>;
      case 'concluido':
        return <Badge className="bg-muted text-muted-foreground border-muted">Concluído</Badge>;
      default:
        return <Badge variant="outline">{traduzirStatus(status)}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span>{unidadeNome || 'Carregando...'}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard de Gestão</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Métricas e gestão da unidade
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Profissionais ativos"
              value={totalProfissionais}
              subtitle="na unidade"
              icon={Users}
            />
            <StatCard
              title="Convites pendentes"
              value={convitesPendentes}
              subtitle="aguardando aceite"
              icon={UserPlus}
            />
            <StatCard
              title="Fichas da unidade"
              value={totalFichas}
              subtitle="total acumulado"
              icon={FileText}
            />
            <StatCard
              title="Laudos gerados"
              value={totalLaudos}
              subtitle="total acumulado"
              icon={Activity}
            />
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Gestão da equipe</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate('/gestao/equipe')}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Gerenciar equipe</p>
                  <p className="text-sm text-muted-foreground">Ver membros, convidar e remover profissionais</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('fichas-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                  <FileText className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Fichas da unidade</p>
                  <p className="text-sm text-muted-foreground">Visualizar e exportar fichas</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* Fichas da unidade com filtros e exportação */}
          <div id="fichas-section" className="mb-8 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-lg font-semibold text-foreground">Fichas da unidade</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="aguardando_gj">Aguardando GJ</SelectItem>
                    <SelectItem value="em_acompanhamento">Em acompanhamento</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={fichasFiltradas.length === 0}>
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportJSON} disabled={fichasFiltradas.length === 0}>
                  <Download className="h-3.5 w-3.5" />
                  JSON
                </Button>
              </div>
            </div>

            {fichasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma ficha encontrada</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Última consulta</TableHead>
                      <TableHead>Criada em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fichasFiltradas.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>{getStatusBadge(f.status_ficha)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.profissional_nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.data_ultima_consulta ? new Date(f.data_ultima_consulta).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(f.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {fichasFiltradas.length} de {fichas.length} fichas exibidas
            </p>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Atividade recente</h2>
            {atividades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
                <p className="text-xs text-muted-foreground mt-1">A atividade dos profissionais aparecerá aqui.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atividades.map(a => (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      a.tipo === 'consulta' ? 'bg-primary/10' : 'bg-secondary/20'
                    }`}>
                      {a.tipo === 'consulta' ? (
                        <FileText className="h-4 w-4 text-primary" />
                      ) : (
                        <Activity className="h-4 w-4 text-secondary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.descricao}</p>
                      <p className="text-xs text-muted-foreground">{a.profissional_nome}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.data).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
