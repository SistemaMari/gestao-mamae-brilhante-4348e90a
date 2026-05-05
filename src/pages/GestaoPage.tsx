import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Users, FileText, UserPlus, ArrowRight, Building2, Clock, Download, Filter, Activity, Syringe, HeartPulse, FileDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import FiltroPeriodoGlobal from '@/components/gestao/FiltroPeriodoGlobal';
import MetricasPartoSection from '@/components/gestao/MetricasPartoSection';
import PacientesPorProfissional from '@/components/gestao/PacientesPorProfissional';
import { exportarRelatorioPdf } from '@/lib/exportarRelatorioPdf';

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
  profissional_id: string;
  profissional_nome: string;
  data_ultima_consulta: string | null;
  created_at: string;
  dmg_gestacao_anterior: boolean | null;
}

interface UnidadeOpt { id: string; nome: string; }

export default function GestaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [unidadeNome, setUnidadeNome] = useState('');
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [isGestorGeral, setIsGestorGeral] = useState(false);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<UnidadeOpt[]>([]);
  const [gestorSemUnidade, setGestorSemUnidade] = useState(false);
  const [contextoCarregado, setContextoCarregado] = useState(false);

  const [totalProfissionais, setTotalProfissionais] = useState(0);
  const [convitesPendentes, setConvitesPendentes] = useState(0);
  const [totalLaudos, setTotalLaudos] = useState(0);
  const [pacientesEmInsulina, setPacientesEmInsulina] = useState(0);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [fichas, setFichas] = useState<FichaResumo[]>([]);
  const [_loading, setLoading] = useState(true);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  // Filtros locais
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Filtros globais
  const [periodoInicio, setPeriodoInicio] = useState<Date | null>(null);
  const [periodoFim, setPeriodoFim] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    initContext();
  }, [user]);

  useEffect(() => {
    if (!user || !unidadeId) return;
    fetchDados();
  }, [user, unidadeId, periodoInicio, periodoFim]);

  const initContext = async () => {
    if (!user) return;
    // Verificar se é gestor geral
    const { data: gg } = await supabase.from('gestores_gerais').select('id').eq('user_id', user.id).maybeSingle();
    const ehGestorGeral = !!gg;
    setIsGestorGeral(ehGestorGeral);

    if (ehGestorGeral) {
      const { data: uns } = await supabase.from('unidades').select('id, nome').order('nome');
      setUnidadesDisponiveis(uns || []);
      if (uns && uns.length > 0) setUnidadeId(uns[0].id);
    } else {
      const { data: prof } = await supabase
        .from('profissionais')
        .select('unidade_id, perfil_institucional, acesso_revogado')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prof?.unidade_id) {
        setUnidadeId(prof.unidade_id);
      } else {
        if (prof && prof.perfil_institucional === 'gestor' && !prof.acesso_revogado) {
          setGestorSemUnidade(true);
        }
        setLoading(false);
      }
    }
    setContextoCarregado(true);
  };

  const fetchDados = async () => {
    if (!user || !unidadeId) return;
    setLoading(true);

    const inicioStr = periodoInicio ? format(periodoInicio, 'yyyy-MM-dd') : null;
    const fimStr = periodoFim ? format(periodoFim, 'yyyy-MM-dd') : null;

    const [unidadeRes, profsRes, convitesRes] = await Promise.all([
      supabase.from('unidades').select('nome').eq('id', unidadeId).single(),
      supabase.from('profissionais').select('id, nome').eq('unidade_id', unidadeId),
      supabase.from('convites').select('id').eq('unidade_id', unidadeId).eq('status', 'pendente'),
    ]);

    const profIds = (profsRes.data || []).map(p => p.id);
    const profissionaisMap = new Map((profsRes.data || []).map(p => [p.id, p.nome]));
    const safeIds = profIds.length > 0 ? profIds : ['00000000-0000-0000-0000-000000000000'];

    let qFichas = supabase
      .from('pacientes')
      .select('id, nome, status_ficha, profissional_id, data_ultima_consulta, created_at, dmg_gestacao_anterior')
      .eq('unidade_id', unidadeId)
      .eq('is_rascunho', false);
    if (inicioStr) qFichas = qFichas.gte('created_at', inicioStr);
    if (fimStr) qFichas = qFichas.lte('created_at', fimStr + 'T23:59:59');

    let qLaudos = supabase
      .from('laudos')
      .select('id, created_at, profissional_id, status')
      .in('profissional_id', safeIds);
    if (inicioStr) qLaudos = qLaudos.gte('created_at', inicioStr);
    if (fimStr) qLaudos = qLaudos.lte('created_at', fimStr + 'T23:59:59');

    let qConsultas = supabase
      .from('consultas')
      .select('id, data, profissional_id, tipo, paciente_id')
      .in('profissional_id', safeIds)
      .order('data', { ascending: false })
      .limit(20);
    if (inicioStr) qConsultas = qConsultas.gte('data', inicioStr);
    if (fimStr) qConsultas = qConsultas.lte('data', fimStr);

    const [fichasRes, laudosRes, consultasRes, perfisRes] = await Promise.all([
      qFichas,
      qLaudos,
      qConsultas,
      supabase.from('perfis_glicemicos').select('paciente_id, decisao').in('profissional_id', safeIds),
    ]);

    setUnidadeNome(unidadeRes.data?.nome || '');
    setTotalProfissionais(profsRes.data?.length || 0);
    setConvitesPendentes(convitesRes.data?.length || 0);
    setTotalLaudos(laudosRes.data?.length || 0);

    // Pacientes em insulina (último perfil glicêmico decidiu insulina)
    const pacientesInsulina = new Set<string>();
    (perfisRes.data || []).forEach(p => {
      if (p.decisao && p.decisao.toLowerCase().includes('insulina')) {
        pacientesInsulina.add(p.paciente_id);
      }
    });
    setPacientesEmInsulina(pacientesInsulina.size);

    const fichasList: FichaResumo[] = (fichasRes.data || []).map(f => ({
      id: f.id,
      nome: f.nome,
      status_ficha: f.status_ficha,
      profissional_id: f.profissional_id,
      profissional_nome: (profissionaisMap.get(f.profissional_id) || 'Desconhecido') as string,
      data_ultima_consulta: f.data_ultima_consulta,
      created_at: f.created_at,
      dmg_gestacao_anterior: f.dmg_gestacao_anterior,
    }));
    setFichas(fichasList);

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

  const fichasFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return fichas;
    return fichas.filter(f => f.status_ficha === filtroStatus);
  }, [fichas, filtroStatus]);

  const totalFichas = fichas.length;
  const fichasComDmg = fichas.filter(f => f.dmg_gestacao_anterior).length;
  const fichasAtivas = fichas.filter(f => ['aguardando_gj', 'em_acompanhamento'].includes(f.status_ficha)).length;

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
    toast.success('CSV exportado!');
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
    toast.success('JSON exportado!');
  };

  const exportXLSX = () => {
    const inicioStr = periodoInicio ? format(periodoInicio, 'dd/MM/yyyy') : '—';
    const fimStr = periodoFim ? format(periodoFim, 'dd/MM/yyyy') : '—';

    // Aba 1 — Resumo
    const resumoRows = [
      ['Relatório de Gestão — Unidade'],
      ['Unidade', unidadeNome],
      ['Período', `${inicioStr} até ${fimStr}`],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Indicador', 'Valor'],
      ['Profissionais ativos', totalProfissionais],
      ['Convites pendentes', convitesPendentes],
      ['Fichas no período', totalFichas],
      ['Fichas ativas', fichasAtivas],
      ['DMG em gestação anterior', fichasComDmg],
      ['Pacientes em insulina', pacientesEmInsulina],
      ['Laudos gerados', totalLaudos],
      ['Taxa DMG (%)', totalFichas > 0 ? Number(((fichasComDmg / totalFichas) * 100).toFixed(1)) : 0],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo['!cols'] = [{ wch: 32 }, { wch: 28 }];

    // Aba 2 — Fichas (respeita filtro de status)
    const fichasHeader = ['Paciente', 'Status', 'Profissional', 'Última consulta', 'Criada em', 'DMG anterior'];
    const fichasRows = fichasFiltradas.map(f => [
      f.nome,
      traduzirStatus(f.status_ficha),
      f.profissional_nome,
      f.data_ultima_consulta ? new Date(f.data_ultima_consulta).toLocaleDateString('pt-BR') : '—',
      new Date(f.created_at).toLocaleDateString('pt-BR'),
      f.dmg_gestacao_anterior ? 'Sim' : 'Não',
    ]);
    const wsFichas = XLSX.utils.aoa_to_sheet([fichasHeader, ...fichasRows]);
    wsFichas['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];

    // Aba 3 — Atividade recente
    const atvHeader = ['Tipo', 'Descrição', 'Profissional', 'Data'];
    const atvRows = atividades.map(a => [
      a.tipo,
      a.descricao,
      a.profissional_nome,
      new Date(a.data).toLocaleDateString('pt-BR'),
    ]);
    const wsAtv = XLSX.utils.aoa_to_sheet([atvHeader, ...atvRows]);
    wsAtv['!cols'] = [{ wch: 12 }, { wch: 36 }, { wch: 28 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    XLSX.utils.book_append_sheet(wb, wsFichas, 'Fichas');
    XLSX.utils.book_append_sheet(wb, wsAtv, 'Atividade');

    const filename = `relatorio-${(unidadeNome || 'unidade').replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success('Excel exportado!');
  };

  const exportPDF = async () => {
    if (!user || !unidadeId) return;
    setExportandoPdf(true);
    try {
      const inicioStr = periodoInicio ? format(periodoInicio, 'yyyy-MM-dd') : format(new Date(Date.now() - 365 * 86400000), 'yyyy-MM-dd');
      const fimStr = periodoFim ? format(periodoFim, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      const result = await exportarRelatorioPdf({
        elementId: 'dashboard-relatorio',
        unidadeId,
        gestorId: user.id,
        periodoInicio: inicioStr,
        periodoFim: fimStr,
        metricasResumo: {
          // Schema 18A — 21 chaves (campos não calculados pelo frontend ficam 0;
          // o backend automático preenche todos via gerar-relatorios-mensais)
          unidade_nome: unidadeNome,
          total_gestantes: totalFichas,
          total_dmg_confirmado: fichasComDmg,
          taxa_dmg_percent: totalFichas > 0 ? Number(((fichasComDmg / totalFichas) * 100).toFixed(1)) : 0,
          total_overt: 0,
          dmg_retorno1: 0,
          dmg_gtt: 0,
          controle_adequado_sem_insulina: 0,
          controle_com_insulina: pacientesEmInsulina,
          controle_adequado_com_insulina: 0,
          encaminhadas_especialista: 0,
          partos_registrados: 0,
          partos_vaginal: 0,
          partos_cesarea: 0,
          rn_aig: 0,
          rn_gig: 0,
          rn_pig: 0,
          intercorrencias_maternas: 0,
          intercorrencias_neonatais: 0,
          profissionais_ativos: totalProfissionais,
          total_laudos: totalLaudos,
        },
        filename: `relatorio-${unidadeNome.replace(/\s+/g, '-')}-${fimStr}.pdf`,
      });
      if (result.ok) toast.success('Relatório PDF gerado e arquivado.');
      else toast.error(`PDF baixado, mas falha ao arquivar: ${result.error}`);
    } catch (e) {
      toast.error('Erro ao gerar PDF');
      console.error(e);
    } finally {
      setExportandoPdf(false);
    }
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

  if (contextoCarregado && gestorSemUnidade) {
    return (
      <div className="flex h-screen bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex min-h-full items-center justify-center px-6 py-12">
            <div className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-200">
                <Building2 className="h-6 w-6 text-amber-900" />
              </div>
              <h1 className="font-heading text-xl font-semibold text-amber-950">
                Você ainda não está vinculado a uma unidade
              </h1>
              <p className="mt-3 text-sm text-amber-900">
                Sua conta de gestor está ativa, mas ainda não foi associada a nenhuma unidade.
                Aguarde a vinculação por um administrador. Assim que estiver vinculado, esta tela
                exibirá automaticamente o painel de gestão da unidade.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span>{unidadeNome || 'Carregando...'}</span>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard de Gestão</h1>
              <p className="mt-1 text-sm text-muted-foreground">Métricas e gestão da unidade</p>
            </div>
            <Button onClick={exportPDF} disabled={exportandoPdf || !unidadeId}>
              <FileDown className="h-4 w-4" />
              {exportandoPdf ? 'Gerando...' : 'Exportar PDF'}
            </Button>
          </div>

          {/* Filtros globais */}
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {isGestorGeral && unidadesDisponiveis.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Unidade:</span>
                  <Select value={unidadeId || ''} onValueChange={(v) => setUnidadeId(v)}>
                    <SelectTrigger className="w-[240px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unidadesDisponiveis.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex-1 flex justify-end">
                <FiltroPeriodoGlobal
                  inicio={periodoInicio}
                  fim={periodoFim}
                  onChange={(i, f) => { setPeriodoInicio(i); setPeriodoFim(f); }}
                />
              </div>
            </div>
          </div>

          <div id="dashboard-relatorio">
            {/* Stats */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Profissionais ativos" value={totalProfissionais} subtitle="na unidade" icon={Users} />
              <StatCard title="Convites pendentes" value={convitesPendentes} subtitle="aguardando aceite" icon={UserPlus} />
              <StatCard title="Fichas no período" value={totalFichas} subtitle={`${fichasAtivas} ativas`} icon={FileText} />
              <StatCard title="Laudos gerados" value={totalLaudos} subtitle="no período" icon={Activity} />
              <StatCard title="DMG em gestação anterior" value={fichasComDmg} subtitle="histórico positivo" icon={HeartPulse} />
              <StatCard title="Pacientes em insulina" value={pacientesEmInsulina} subtitle="último perfil" icon={Syringe} />
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
                  onClick={() => document.getElementById('fichas-section')?.scrollIntoView({ behavior: 'smooth' })}
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

            {/* Partos */}
            <div className="mb-8">
              <MetricasPartoSection
                unidadeId={unidadeId}
                periodoInicio={periodoInicio ? format(periodoInicio, 'yyyy-MM-dd') : null}
                periodoFim={periodoFim ? format(periodoFim, 'yyyy-MM-dd') : null}
              />
            </div>

            {/* Pacientes por profissional */}
            <div className="mb-8">
              <PacientesPorProfissional fichas={fichas} />
            </div>

            {/* Fichas */}
            <div id="fichas-section" className="mb-8 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-heading text-lg font-semibold text-foreground">Fichas da unidade</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-[180px] h-9">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
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
                  <Button variant="outline" size="sm" onClick={exportXLSX} disabled={fichasFiltradas.length === 0}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Excel
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

            {/* Atividade recente */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Atividade recente</h2>
              {atividades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
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
        </div>
      </main>
    </div>
  );
}
