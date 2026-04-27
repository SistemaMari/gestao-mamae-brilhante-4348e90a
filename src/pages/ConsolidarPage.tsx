import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import {
  BarChart3, Building2, Calendar as CalendarIcon, CheckCircle2, Download,
  FileText, Filter, History, Loader2, RefreshCw, Sparkles, User, XCircle,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type OrigemRelatorio = 'manual' | 'automatico';
type FiltroOrigem = 'todas' | 'manual' | 'automatico';

interface GestorGeral {
  id: string;
  nome: string | null;
  user_id: string;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Relatorio {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  created_at: string;
  arquivo_path: string;
  total_gestantes: number | null;
  origem: OrigemRelatorio;
}

interface Consolidacao {
  id: string;
  created_at: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  unidades_incluidas: number;
  pdf_path: string | null;
  csv_path: string | null;
}

interface ConsolidarSucesso {
  consolidacao_id: string;
  unidades_incluidas: number;
  pdf_url: string | null;
  csv_url: string | null;
}

function fmtPeriodo(inicio?: string | null, fim?: string | null) {
  if (!inicio || !fim) return '—';
  try {
    const a = format(new Date(inicio + 'T00:00:00'), "MMM/yy", { locale: ptBR });
    const b = format(new Date(fim + 'T00:00:00'), "MMM/yy", { locale: ptBR });
    return a === b ? a : `${a} – ${b}`;
  } catch {
    return `${inicio} – ${fim}`;
  }
}

function fmtData(iso?: string | null) {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); }
  catch { return '—'; }
}

export default function ConsolidarPage() {
  const navigate = useNavigate();

  const [carregandoTela, setCarregandoTela] = useState(true);
  const [gestor, setGestor] = useState<GestorGeral | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<Set<string>>(new Set());

  const [periodo, setPeriodo] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [carregandoRelatorios, setCarregandoRelatorios] = useState(false);
  const [selecionadosRel, setSelecionadosRel] = useState<Set<string>>(new Set());

  const [consolidando, setConsolidando] = useState(false);
  const [resultado, setResultado] = useState<ConsolidarSucesso | null>(null);
  const [erroConsolidacao, setErroConsolidacao] = useState<string | null>(null);

  const [historico, setHistorico] = useState<Consolidacao[]>([]);
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todas');
  // ----- Bootstrap: validar acesso, carregar gestor + unidades vinculadas -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) { navigate('/login', { replace: true }); return; }

      const { data: gg } = await supabase
        .from('gestores_gerais')
        .select('id, nome, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!gg) {
        // Redireciona silenciosamente para a rota padrão
        const { data: admin } = await supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle();
        if (admin) { navigate('/admin', { replace: true }); return; }
        const { data: prof } = await supabase
          .from('profissionais')
          .select('unidade_id, perfil_institucional')
          .eq('user_id', user.id)
          .maybeSingle();
        if (prof?.perfil_institucional === 'gestor') navigate('/gestao', { replace: true });
        else navigate('/dashboard', { replace: true });
        return;
      }

      if (cancelled) return;
      setGestor(gg as GestorGeral);

      // Unidades vinculadas
      const { data: vincs } = await supabase
        .from('gestores_gerais_unidades')
        .select('unidade_id')
        .eq('gestor_geral_id', gg.id);
      const unidadeIds = (vincs ?? []).map((v) => v.unidade_id as string);

      let unidadesData: Unidade[] = [];
      if (unidadeIds.length > 0) {
        const { data: uns } = await supabase
          .from('unidades')
          .select('id, nome')
          .in('id', unidadeIds)
          .order('nome');
        unidadesData = (uns ?? []) as Unidade[];
      }
      if (cancelled) return;
      setUnidades(unidadesData);
      setUnidadesSelecionadas(new Set(unidadesData.map((u) => u.id)));

      // Histórico
      await carregarHistorico(gg.id);
      setCarregandoTela(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar relatórios sempre que unidades / período mudarem (auto após bootstrap)
  useEffect(() => {
    if (!gestor || carregandoTela) return;
    carregarRelatorios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor?.id, carregandoTela]);

  async function carregarRelatorios() {
    if (!gestor) return;
    setCarregandoRelatorios(true);
    setSelecionadosRel(new Set());
    setResultado(null);
    setErroConsolidacao(null);

    const unidadeIds = Array.from(unidadesSelecionadas);
    if (unidadeIds.length === 0) {
      setRelatorios([]);
      setCarregandoRelatorios(false);
      return;
    }

    let q = supabase
      .from('relatorios_unidade')
      .select('id, unidade_id, periodo_inicio, periodo_fim, created_at, arquivo_path, metricas_resumo, origem')
      .in('unidade_id', unidadeIds)
      .order('created_at', { ascending: false });

    if (periodo?.from) q = q.gte('periodo_inicio', format(periodo.from, 'yyyy-MM-dd'));
    if (periodo?.to)   q = q.lte('periodo_fim',   format(periodo.to,   'yyyy-MM-dd'));

    const { data, error } = await q;
    if (error) {
      toast.error('Falha ao carregar relatórios.');
      setRelatorios([]);
      setCarregandoRelatorios(false);
      return;
    }

    const nomeMap = new Map(unidades.map((u) => [u.id, u.nome]));
    const lista: Relatorio[] = (data ?? []).map((r: any) => {
      const m = r.metricas_resumo as Record<string, unknown> | null;
      const total = (m && typeof m.total_gestantes === 'number') ? m.total_gestantes as number : null;
      const origem: OrigemRelatorio = r.origem === 'automatico' ? 'automatico' : 'manual';
      return {
        id: r.id,
        unidade_id: r.unidade_id,
        unidade_nome: nomeMap.get(r.unidade_id) ?? '—',
        periodo_inicio: r.periodo_inicio,
        periodo_fim: r.periodo_fim,
        created_at: r.created_at,
        arquivo_path: r.arquivo_path,
        total_gestantes: total,
        origem,
      };
    });
    setRelatorios(lista);
    setCarregandoRelatorios(false);
  }

  async function carregarHistorico(gestorId: string) {
    const { data } = await supabase
      .from('consolidacoes')
      .select('id, created_at, periodo_inicio, periodo_fim, unidades_incluidas, pdf_path, csv_path')
      .eq('gestor_geral_id', gestorId)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistorico((data ?? []) as Consolidacao[]);
  }

  // ----- Filtros -----
  function toggleUnidade(id: string) {
    setUnidadesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleTodasUnidades() {
    if (unidadesSelecionadas.size === unidades.length) setUnidadesSelecionadas(new Set());
    else setUnidadesSelecionadas(new Set(unidades.map((u) => u.id)));
  }

  // ----- Seleção de relatórios -----
  function toggleRelatorio(id: string) {
    setSelecionadosRel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleTodosRelatorios() {
    if (selecionadosRel.size === relatoriosFiltrados.length) setSelecionadosRel(new Set());
    else setSelecionadosRel(new Set(relatoriosFiltrados.map((r) => r.id)));
  }

  // ----- Download individual -----
  async function baixarRelatorioIndividual(rel: Relatorio) {
    const { data, error } = await supabase.storage
      .from('relatorios')
      .createSignedUrl(rel.arquivo_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível gerar o link de download.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function baixarConsolidacao(cons: Consolidacao, formato: 'pdf' | 'csv') {
    const path = formato === 'pdf' ? cons.pdf_path : cons.csv_path;
    if (!path) return;
    const { data, error } = await supabase.storage
      .from('consolidados')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível gerar o link.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  // ----- Consolidar -----
  async function consolidar() {
    if (!gestor || selecionadosRel.size === 0) return;
    setConsolidando(true);
    setResultado(null);
    setErroConsolidacao(null);

    const { data, error } = await supabase.functions.invoke('consolidar-relatorios', {
      body: {
        relatorio_ids: Array.from(selecionadosRel),
        gestor_geral_id: gestor.id,
        formato_saida: 'ambos',
      },
    });

    setConsolidando(false);

    if (error) {
      setErroConsolidacao(error.message ?? 'Erro ao consolidar relatórios.');
      return;
    }
    if (!data || data.status !== 'consolidado') {
      setErroConsolidacao(data?.mensagem ?? 'Resposta inválida da consolidação.');
      return;
    }

    setResultado({
      consolidacao_id: data.consolidacao_id,
      unidades_incluidas: data.unidades_incluidas,
      pdf_url: data.pdf_url ?? null,
      csv_url: data.csv_url ?? null,
    });
    toast.success('Relatório consolidado gerado!');
    await carregarHistorico(gestor.id);
  }

  function tentarNovamente() {
    setErroConsolidacao(null);
    setResultado(null);
  }

  // ----- UI computeds -----
  const relatoriosFiltrados = useMemo(() => {
    if (filtroOrigem === 'todas') return relatorios;
    return relatorios.filter((r) => r.origem === filtroOrigem);
  }, [relatorios, filtroOrigem]);

  const todasUnidadesSelecionadas = unidades.length > 0 && unidadesSelecionadas.size === unidades.length;
  const algumasUnidadesSelecionadas = unidadesSelecionadas.size > 0 && !todasUnidadesSelecionadas;
  const todosRelatoriosSelecionados = relatoriosFiltrados.length > 0 && selecionadosRel.size === relatoriosFiltrados.length;
  const algunsRelatoriosSelecionados = selecionadosRel.size > 0 && !todosRelatoriosSelecionados;
  const labelPeriodo = useMemo(() => {
    if (!periodo?.from) return 'Selecionar período';
    const a = format(periodo.from, 'dd/MM/yyyy', { locale: ptBR });
    const b = periodo.to ? format(periodo.to, 'dd/MM/yyyy', { locale: ptBR }) : a;
    return `${a} – ${b}`;
  }, [periodo]);

  if (carregandoTela) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-10">
          {/* ===== Cabeçalho ===== */}
          <div className="mb-6 flex items-center gap-2 text-sm text-primary">
            <BarChart3 className="h-4 w-4" />
            <span>Gestor Geral</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Consolidação de Relatórios — Dra. Mari DMG Diagnóstica
          </h1>

          {/* Card boas-vindas */}
          <div className="mt-4 rounded-xl border border-border bg-[#F1F0FB] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-heading text-lg font-semibold text-foreground">
                  Olá, {gestor?.nome ?? 'Gestor(a) Geral'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Gestor Geral — visão consolidada de todas as unidades vinculadas
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15">
                <Building2 className="mr-1 h-3.5 w-3.5" />
                {unidades.length} {unidades.length === 1 ? 'unidade vinculada' : 'unidades vinculadas'}
              </Badge>
            </div>
          </div>

          {/* ===== Filtros ===== */}
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-base font-semibold text-foreground">Filtros</h2>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto] lg:items-end">
                {/* Multi-select de unidades */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Unidade(s)</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {todasUnidadesSelecionadas
                            ? 'Todas as unidades'
                            : unidadesSelecionadas.size === 0
                              ? 'Nenhuma unidade'
                              : `${unidadesSelecionadas.size} selecionada(s)`}
                        </span>
                        <Building2 className="ml-2 h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[320px] p-2">
                      <div className="max-h-[280px] overflow-auto">
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent">
                          <Checkbox
                            checked={todasUnidadesSelecionadas ? true : algumasUnidadesSelecionadas ? 'indeterminate' : false}
                            onCheckedChange={toggleTodasUnidades}
                          />
                          <span className="text-sm font-medium">Selecionar todas</span>
                        </label>
                        <div className="my-1 border-t border-border" />
                        {unidades.length === 0 ? (
                          <p className="px-2 py-2 text-sm text-muted-foreground">Nenhuma unidade vinculada.</p>
                        ) : unidades.map((u) => (
                          <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent">
                            <Checkbox
                              checked={unidadesSelecionadas.has(u.id)}
                              onCheckedChange={() => toggleUnidade(u.id)}
                            />
                            <span className="text-sm">{u.nome}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date range */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Período</label>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-between font-normal', !periodo && 'text-muted-foreground')}>
                        <span className="truncate">{labelPeriodo}</span>
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="range"
                        selected={periodo}
                        onSelect={setPeriodo}
                        numberOfMonths={2}
                        locale={ptBR}
                        defaultMonth={periodo?.from}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Filtro de origem */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Origem</label>
                  <Select value={filtroOrigem} onValueChange={(v) => setFiltroOrigem(v as FiltroOrigem)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="automatico">Somente automáticos</SelectItem>
                      <SelectItem value="manual">Somente manuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={carregarRelatorios} disabled={carregandoRelatorios}>
                    {carregandoRelatorios ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Filtrar
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Botão consolidar + estados ===== */}
          <section className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-base font-semibold text-foreground">Relatórios disponíveis</h2>
                <Badge variant="outline">{relatoriosFiltrados.length}</Badge>
              </div>
              <Button
                onClick={consolidar}
                disabled={selecionadosRel.size === 0 || consolidando}
                className="bg-primary hover:bg-[#B4A0FF] text-primary-foreground"
              >
                {consolidando ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consolidando…</>
                ) : (
                  <>Consolidar {selecionadosRel.size} relatório{selecionadosRel.size === 1 ? '' : 's'}</>
                )}
              </Button>
            </div>

            {consolidando && (
              <div className="mb-4 rounded-xl border border-border bg-card p-5 text-center">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-foreground">Consolidando relatórios... Isso pode levar alguns segundos.</p>
              </div>
            )}

            {resultado && !consolidando && (
              <div className="mb-4 rounded-xl border p-5" style={{ background: '#DCFCE7', borderColor: '#86EFAC' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" />
                    <div>
                      <p className="font-heading font-semibold text-green-900">
                        Relatório consolidado gerado com sucesso!
                      </p>
                      <p className="text-sm text-green-800">{resultado.unidades_incluidas} unidade(s) incluída(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resultado.pdf_url && (
                      <Button asChild variant="outline" className="border-green-700 text-green-900 hover:bg-green-100">
                        <a href={resultado.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" /> Baixar PDF consolidado
                        </a>
                      </Button>
                    )}
                    {resultado.csv_url && (
                      <Button asChild variant="outline" className="border-green-700 text-green-900 hover:bg-green-100">
                        <a href={resultado.csv_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-2 h-4 w-4" /> Baixar CSV
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {erroConsolidacao && !consolidando && (
              <div className="mb-4 rounded-xl border p-5" style={{ background: '#FEE2E2', borderColor: '#FCA5A5' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 text-red-700" />
                    <div>
                      <p className="font-heading font-semibold text-red-900">Não foi possível gerar o consolidado</p>
                      <p className="text-sm text-red-800">{erroConsolidacao}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={tentarNovamente} className="border-red-700 text-red-900 hover:bg-red-100">
                    <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {/* Lista */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {carregandoRelatorios ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando relatórios…
                </div>
              ) : relatoriosFiltrados.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  {relatorios.length === 0
                    ? 'Nenhum relatório disponível para o período selecionado. Os relatórios ficam disponíveis automaticamente quando os gestores de unidade exportam seus dashboards.'
                    : 'Nenhum relatório corresponde ao filtro de origem selecionado.'}
                </div>
              ) : (
                <TooltipProvider delayDuration={150}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#F8FAFC]">
                        <TableHead className="w-[44px]">
                          <Checkbox
                            checked={todosRelatoriosSelecionados ? true : algunsRelatoriosSelecionados ? 'indeterminate' : false}
                            onCheckedChange={toggleTodosRelatorios}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Gerado em</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Gestantes</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatoriosFiltrados.map((r, idx) => {
                        const isAuto = r.origem === 'automatico';
                        const badgeStyle = isAuto
                          ? { background: '#EDE9FE', color: '#6D28D9' }
                          : { background: '#F1F5F9', color: '#475569' };
                        const tooltipText = isAuto
                          ? 'Gerado automaticamente pelo sistema no dia 1 do mês.'
                          : `Exportado pelo gestor de unidade em ${fmtData(r.created_at)}.`;
                        return (
                          <TableRow key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                            <TableCell>
                              <Checkbox
                                checked={selecionadosRel.has(r.id)}
                                onCheckedChange={() => toggleRelatorio(r.id)}
                                aria-label={`Selecionar ${r.unidade_nome}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{r.unidade_nome}</TableCell>
                            <TableCell>{fmtPeriodo(r.periodo_inicio, r.periodo_fim)}</TableCell>
                            <TableCell>{fmtData(r.created_at)}</TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full text-xs font-medium"
                                    style={{ ...badgeStyle, padding: '3px 10px' }}
                                  >
                                    {isAuto ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                    {isAuto ? 'Automático' : 'Manual'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{tooltipText}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="text-right">{r.total_gestantes ?? '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => baixarRelatorioIndividual(r)}>
                                <Download className="mr-1 h-3.5 w-3.5" /> Baixar PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              )}
            </div>
          </section>

          {/* ===== Histórico ===== */}
          <section className="mt-8 mb-12">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h2 className="font-heading text-base font-semibold text-foreground">Consolidações anteriores</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {historico.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma consolidação gerada ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC]">
                      <TableHead>Data</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Unidades</TableHead>
                      <TableHead className="text-right">PDF</TableHead>
                      <TableHead className="text-right">CSV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((c, idx) => (
                      <TableRow key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                        <TableCell>{fmtData(c.created_at)}</TableCell>
                        <TableCell>{fmtPeriodo(c.periodo_inicio, c.periodo_fim)}</TableCell>
                        <TableCell>{c.unidades_incluidas} {c.unidades_incluidas === 1 ? 'unidade' : 'unidades'}</TableCell>
                        <TableCell className="text-right">
                          {c.pdf_path ? (
                            <Button variant="ghost" size="sm" onClick={() => baixarConsolidacao(c, 'pdf')}>
                              <Download className="mr-1 h-3.5 w-3.5" /> Baixar
                            </Button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.csv_path ? (
                            <Button variant="ghost" size="sm" onClick={() => baixarConsolidacao(c, 'csv')}>
                              <Download className="mr-1 h-3.5 w-3.5" /> Baixar
                            </Button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
