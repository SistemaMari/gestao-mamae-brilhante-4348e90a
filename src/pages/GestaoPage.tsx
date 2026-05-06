import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import StatCard from '@/components/StatCard';
import { Users, FileText, UserPlus, ArrowRight, Building2, Clock, Activity, Syringe, HeartPulse, FileDown } from 'lucide-react';
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
import { STATUS_CONFIG, calcIdadeGestacional } from '@/lib/fichaUtils';

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
  data_proximo_retorno: string | null;
  created_at: string;
  dmg_gestacao_anterior: boolean | null;
  dum: string | null;
  usg_data: string | null;
  usg_ig_semanas: number | null;
  usg_ig_dias: number | null;
}

interface UnidadeOpt { id: string; nome: string; }

export default function GestaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith('/vitrine');
  const basePath = isVitrine ? '/vitrine/gestao' : '/gestao';

  const [unidadeNome, setUnidadeNome] = useState(isVitrine ? 'Hospital Demo MARI' : '');
  const [unidadeId, setUnidadeId] = useState<string | null>(isVitrine ? 'vitrine-unidade' : null);
  const [isGestorGeral, setIsGestorGeral] = useState(false);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<UnidadeOpt[]>([]);
  const [gestorSemUnidade, setGestorSemUnidade] = useState(false);
  const [contextoCarregado, setContextoCarregado] = useState(isVitrine);

  const [totalProfissionais, setTotalProfissionais] = useState(isVitrine ? 8 : 0);
  const [convitesPendentes, setConvitesPendentes] = useState(isVitrine ? 2 : 0);
  const [totalLaudos, setTotalLaudos] = useState(isVitrine ? 47 : 0);
  const [pacientesEmInsulina, setPacientesEmInsulina] = useState(isVitrine ? 6 : 0);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>(
    isVitrine
      ? [
          { id: 'a1', tipo: 'laudo', descricao: 'Laudo gerado', profissional_nome: 'Dra. Ana Souza', data: new Date(Date.now() - 2 * 86400000).toISOString() },
          { id: 'a2', tipo: 'consulta', descricao: 'Primeira consulta registrado', profissional_nome: 'Dr. Carlos Lima', data: new Date(Date.now() - 3 * 86400000).toISOString() },
          { id: 'a3', tipo: 'laudo', descricao: 'Laudo gerado', profissional_nome: 'Dra. Bia Mello', data: new Date(Date.now() - 4 * 86400000).toISOString() },
          { id: 'a4', tipo: 'consulta', descricao: 'Retorno registrado', profissional_nome: 'Dra. Ana Souza', data: new Date(Date.now() - 6 * 86400000).toISOString() },
        ]
      : [],
  );
  const [fichas, setFichas] = useState<FichaResumo[]>(
    isVitrine
      ? (() => {
          const base = [
            { nome: 'Maria Souza', status_ficha: 'dmg_confirmado', prof: 'Dra. Ana Souza',  semWeeks: 28, semDays: 3, ult: 1, prox: 6 },
            { nome: 'Beatriz Alves', status_ficha: 'aguardando_gtt', prof: 'Dr. Carlos Lima', semWeeks: 24, semDays: 1, ult: 2, prox: 5 },
            { nome: 'Júlia Costa',   status_ficha: 'dmg_confirmado', prof: 'Dra. Bia Mello',  semWeeks: 32, semDays: 5, ult: 3, prox: 4 },
            { nome: 'Renata Lima',   status_ficha: 'dmg_afastado',   prof: 'Dr. Diego Reis',  semWeeks: 36, semDays: 2, ult: 4, prox: 9 },
            { nome: 'Camila Rocha',  status_ficha: 'aguardando_gj',  prof: 'Dra. Ana Souza',  semWeeks: 20, semDays: 0, ult: 5, prox: 2 },
          ];
          const extras = ['Mariana Silva','Patrícia Souza','Larissa Pinto','Fernanda Dias','Helena Pires','Roberta Cunha','Aline Tavares','Tatiana Reis','Sofia Mendes','Vivian Gomes','Carla Nogueira','Bianca Moura','Yasmin Borges','Eduarda Pacheco','Joana Vieira','Isabela Ramos','Karina Brito','Luana Sales'];
          const profs = ['Dra. Ana Souza', 'Dr. Carlos Lima', 'Dra. Bia Mello', 'Dr. Diego Reis'];
          const statuses = ['dmg_confirmado','aguardando_gtt','dmg_afastado','aguardando_gj','encaminhada_endocrino'];
          const today = Date.now();
          const day = 86400000;
          const all = [...base, ...extras.map((nome, i) => ({
            nome,
            status_ficha: statuses[i % statuses.length],
            prof: profs[i % profs.length],
            semWeeks: 18 + (i * 3) % 20,
            semDays: i % 7,
            ult: (i + 6) % 30,
            prox: ((i + 1) % 20) - 5,
          }))];
          return all.map((f, i) => {
            // Calcula uma DUM coerente para que calcIdadeGestacional renderize a IG desejada
            const totalDias = f.semWeeks * 7 + f.semDays;
            const dum = new Date(today - totalDias * day).toISOString().slice(0, 10);
            const proxDate = f.prox >= 0 ? new Date(today + f.prox * day) : new Date(today - Math.abs(f.prox) * day);
            return {
              id: `vit-${i}`,
              nome: f.nome,
              status_ficha: f.status_ficha,
              profissional_id: `p-${f.prof}`,
              profissional_nome: f.prof,
              data_ultima_consulta: new Date(today - f.ult * day).toISOString().slice(0, 10),
              data_proximo_retorno: proxDate.toISOString().slice(0, 10),
              created_at: new Date(today - (f.ult + 30) * day).toISOString(),
              dmg_gestacao_anterior: i % 4 === 0,
              dum,
              usg_data: null,
              usg_ig_semanas: null,
              usg_ig_dias: null,
            };
          });
        })()
      : [],
  );
  const [_loading, setLoading] = useState(!isVitrine);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  // Filtros globais
  const [periodoInicio, setPeriodoInicio] = useState<Date | null>(null);
  const [periodoFim, setPeriodoFim] = useState<Date | null>(null);

  useEffect(() => {
    if (isVitrine) return;
    if (!user) return;
    initContext();
  }, [user, isVitrine]);

  useEffect(() => {
    if (isVitrine) return;
    if (!user || !unidadeId) return;
    fetchDados();
  }, [user, unidadeId, periodoInicio, periodoFim, isVitrine]);

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
      .select('id, nome, status_ficha, profissional_id, data_ultima_consulta, data_proximo_retorno, created_at, dmg_gestacao_anterior, dum, usg_data, usg_ig_semanas, usg_ig_dias')
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

    const fichasList: FichaResumo[] = (fichasRes.data || []).map((f: any) => ({
      id: f.id,
      nome: f.nome,
      status_ficha: f.status_ficha,
      profissional_id: f.profissional_id,
      profissional_nome: (profissionaisMap.get(f.profissional_id) || 'Desconhecido') as string,
      data_ultima_consulta: f.data_ultima_consulta,
      data_proximo_retorno: f.data_proximo_retorno,
      created_at: f.created_at,
      dmg_gestacao_anterior: f.dmg_gestacao_anterior,
      dum: f.dum,
      usg_data: f.usg_data,
      usg_ig_semanas: f.usg_ig_semanas,
      usg_ig_dias: f.usg_ig_dias,
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

  // Resumo (5 fichas mais urgentes para o Painel)
  const fichasResumo = useMemo(() => {
    const sorted = [...fichas].sort((a, b) => {
      // data_proximo_retorno ASC NULLS LAST
      if (!a.data_proximo_retorno && !b.data_proximo_retorno) return 0;
      if (!a.data_proximo_retorno) return 1;
      if (!b.data_proximo_retorno) return -1;
      return a.data_proximo_retorno.localeCompare(b.data_proximo_retorno);
    });
    return sorted.slice(0, 5);
  }, [fichas]);

  const totalFichas = fichas.length;
  const fichasComDmg = fichas.filter(f => f.dmg_gestacao_anterior).length;
  const fichasAtivas = fichas.filter(f => ['aguardando_gj', 'aguardando_gtt', 'dmg_confirmado'].includes(f.status_ficha)).length;

  const exportPDF = async () => {
    if (isVitrine) {
      toast.success('Exportar PDF é uma funcionalidade da versão real (vitrine apenas demonstrativa).');
      return;
    }
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


  if (contextoCarregado && gestorSemUnidade) {
    return (
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
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span>{contextoCarregado ? (unidadeNome || '—') : 'Carregando...'}</span>
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
                  onClick={() => navigate(`${basePath}/equipe`)}
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

            {/* Fichas — resumo executivo (5 mais urgentes) */}
            <div id="fichas-section" className="mb-8 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-foreground">Fichas da unidade</h2>
              </div>

              {fichas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma ficha cadastrada nesta unidade ainda.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Paciente</TableHead>
                          <TableHead>IG</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Profissional</TableHead>
                          <TableHead>Última consulta</TableHead>
                          <TableHead>Próxima consulta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fichasResumo.map(f => {
                          const cfg = STATUS_CONFIG[f.status_ficha];
                          return (
                            <TableRow
                              key={f.id}
                              className="cursor-pointer"
                              onClick={() => navigate(`${basePath}/fichas/${f.id}`)}
                            >
                              <TableCell className="font-medium">{f.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{calcIdadeGestacional(f)}</TableCell>
                              <TableCell>
                                {cfg ? (
                                  <Badge className={`${cfg.color} text-white border-0`}>{cfg.label}</Badge>
                                ) : (
                                  <Badge variant="outline">{f.status_ficha}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{f.profissional_nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {f.data_ultima_consulta ? new Date(f.data_ultima_consulta).toLocaleDateString('pt-BR') : '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {f.data_proximo_retorno ? new Date(f.data_proximo_retorno).toLocaleDateString('pt-BR') : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {fichas.length > 5 && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`${basePath}/fichas`)}
                        className="text-[#7C4DBA] hover:text-[#7E69AB] hover:bg-[#E8E0FF]"
                      >
                        Ver todas as fichas ({fichas.length}) <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
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
  );
}
