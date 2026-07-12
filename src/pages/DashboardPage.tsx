import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import UsageWarningBanner from '@/components/UsageWarningBanner';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import RealtimeIndicator from '@/components/RealtimeIndicator';
import BlockingModal from '@/components/BlockingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getPreviewPacientes, type PreviewPaciente } from '@/lib/previewPatients';
import {
  Plus, Search, X, AlertTriangle, Clock, CalendarCheck,
  User, Info, Loader2, Building2, CalendarDays, UserPlus, Sparkles
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR } from '@/lib/dateUtils';
import { STATUS_CONFIG } from '@/lib/fichaUtils';
import { useIgBatch, formatIg } from '@/lib/getIg';

interface Paciente extends PreviewPaciente {}

// 38B-C (#16): semáforo de 3 estados a partir de data_proximo_retorno.
function getReturnBadge(paciente: Paciente): {
  type: 'vencido' | 'proximo' | 'em_dia';
  label: string;
  tooltip: string;
} | null {
  if (paciente.status_ficha !== 'dmg_confirmado') return null;
  if (!paciente.data_proximo_retorno) return null;

  const retornoDate = parseDateLocal(paciente.data_proximo_retorno);
  if (!retornoDate) return null;
  const diff = differenceInDays(retornoDate, new Date());
  const dataLimite = formatDateBR(paciente.data_proximo_retorno);

  if (diff < 0) {
    const dias = Math.abs(diff);
    return {
      type: 'vencido',
      label: `Vencido há ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      tooltip: `O prazo de retorno (${dataLimite}) já passou há ${dias} ${dias === 1 ? 'dia' : 'dias'}. Este aviso não pode ser ocultado.`,
    };
  }

  if (diff <= 3) {
    return {
      type: 'proximo',
      label: `Retorno próximo — até ${dataLimite}`,
      tooltip: `Faltam ${diff} ${diff === 1 ? 'dia' : 'dias'} para o prazo de retorno (${dataLimite}).`,
    };
  }

  return {
    type: 'em_dia',
    label: `Em dia — até ${dataLimite}`,
    tooltip: `Próximo retorno até ${dataLimite}.`,
  };
}

// 38B-C (#7): na vitrine, deriva os ids Overt das consultas do preview.
function derivarOvertIds(lista: PreviewPaciente[]): Set<string> {
  return new Set(
    lista.filter((p) => (p.consultas ?? []).some((c) => c.cenario_clinico === '8')).map((p) => p.id),
  );
}

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const { profile } = useAuth();
  const ehInstitucional = profile === 'institucional';
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [search, setSearch] = useState('');
  const [showEncerradas, setShowEncerradas] = useState(true);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [page, setPage] = useState(1);
  // 38B-C (#7): ids de pacientes com diagnóstico Overt (cenario_clinico='8').
  const [overtIds, setOvertIds] = useState<Set<string>>(new Set());
  const [unidadeNome, setUnidadeNome] = useState<string | null>(null);

  const DICAS_FALLBACK = useMemo(() => [
    'Diagnóstico precoce de DMG salva vidas — da mãe e do bebê.',
    'Não permita DMG tardio: rastreie no tempo certo.',
    'DMG confirmado NÃO se repete exame — a conduta é seguir o protocolo.',
    'Rastreio universal entre 24 e 28 semanas. Sem exceção.',
    'Glicemia de jejum ≥ 92 mg/dL na 1ª consulta já é DMG.',
    'DMG tratado é desfecho materno-fetal preservado.',
    'TOTG 75g é o padrão-ouro entre 24-28 semanas; jejum, 1h e 2h.',
    'Insulinização em DMG segue com o obstetra — o endócrino apoia, não assume o pré-natal.',
    'Reclassificação pós-parto (6-12 semanas) é obrigatória em toda paciente com DMG.',
  ], []);
  const [dicasPool, setDicasPool] = useState<string[]>(DICAS_FALLBACK);

  useEffect(() => {
    if (!profissionalData?.unidade_id) { setUnidadeNome(null); return; }
    supabase.from('unidades').select('nome, cidade, estado').eq('id', profissionalData.unidade_id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const local = [data.cidade, data.estado].filter(Boolean).join(' / ');
        setUnidadeNome(local ? `${data.nome} — ${local}` : data.nome);
      });
  }, [profissionalData?.unidade_id]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('dicas_dashboard')
        .select('texto')
        .eq('ativa', true)
        .order('slot', { ascending: true });
      if (!error && data && data.length > 0) {
        const textos = (data as { texto: string }[])
          .map((d) => (d.texto || '').trim())
          .filter((t) => t.length > 0);
        if (textos.length > 0) setDicasPool(textos);
      }
    })();
  }, []);




  const fetchPacientes = useCallback(async () => {
    if (!profissionalData || isPreview) return;

    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, numero_identificacao, dum, usg_data, usg_ig_semanas, usg_ig_dias, status_ficha, dmg_gestacao_anterior, data_ultima_consulta, data_proximo_retorno, tipo_retorno')
      .eq('is_rascunho', false)
      .order('data_ultima_consulta', { ascending: false, nullsFirst: false });

    setPacientes((data as Paciente[]) || []);

    // 38B-C (#7): pacientes com cenario_clinico='8' (Overt via Retorno 1 ou GTT 75g).
    const { data: overt } = await supabase
      .from('consultas')
      .select('paciente_id')
      .eq('cenario_clinico', '8');
    setOvertIds(new Set(((overt ?? []) as { paciente_id: string }[]).map((r) => r.paciente_id)));

    setLoadingPacientes(false);
  }, [profissionalData, isPreview]);

  useEffect(() => {
    if (isPreview) {
      const lista = getPreviewPacientes();
      setPacientes(lista);
      setOvertIds(derivarOvertIds(lista));
      setLoadingPacientes(false);
      return;
    }

    if (!profissionalData) {
      setLoadingPacientes(false);
      return;
    }

    setLoadingPacientes(true);
    fetchPacientes();
  }, [isPreview, profissionalData, fetchPacientes]);

  useEffect(() => {
    if (!isPreview) return;

    const syncPreviewPacientes = () => {
      const lista = getPreviewPacientes();
      setPacientes(lista);
      setOvertIds(derivarOvertIds(lista));
    };

    window.addEventListener('storage', syncPreviewPacientes);
    window.addEventListener('preview-pacientes-updated', syncPreviewPacientes as EventListener);

    return () => {
      window.removeEventListener('storage', syncPreviewPacientes);
      window.removeEventListener('preview-pacientes-updated', syncPreviewPacientes as EventListener);
    };
  }, [isPreview]);

  // Realtime: pacientes + consultas + laudos da unidade (RLS já filtra)
  const rtStatus = useRealtimeRefresh({
    tables: ['pacientes', 'consultas', 'laudos'],
    onChange: fetchPacientes,
    enabled: !isPreview && !!profissionalData,
    channelName: 'dashboard-pacientes',
  });

  const ENCERRADAS_STATUS = ['resultado_parto', 'dmg_afastado', 'encaminhada_endocrino'];

  const filtered = useMemo(() => {
    let list = pacientes;
    if (!showEncerradas) {
      list = list.filter((p) => !ENCERRADAS_STATUS.includes(p.status_ficha));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pacientes, search, showEncerradas]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 34C-B: IG da listagem vem da função única `calcular_ig` (RPC) na data da
  // última consulta da paciente — valor clínico estável, não "IG hoje".
  // Pacientes sem âncora ou sem última consulta ficam com "—" (sem 0s 0d).
  const { igs: igMap } = useIgBatch(
    paginated.map(p => ({ key: p.id, pacienteId: p.id, dataAlvo: p.data_ultima_consulta })),
  );

  const handleNovaPaciente = async () => {
    if (isPreview) {
      navigate('/vitrine/paciente/nova');
      return;
    }

    if (!profissionalData) return;

    const { data } = await supabase.rpc('pode_criar_ficha', { p_profissional_id: profissionalData.id });
    if (data === true) {
      navigate('/paciente/nova');
    } else {
      setShowBlockingModal(true);
    }
  };

  const usagePercent = profissionalData
    ? Math.round((profissionalData.laudos_usados / profissionalData.laudos_limite) * 100)
    : 0;

  if (profLoading && !isPreview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const nomeExibicao = (profissionalData?.nome || '').split(' ')[0] || 'boas-vindas';
  const hora = new Date().getHours();
  const saudacaoHorario = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const dataExtenso = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const DICAS_FALLBACK = [
    'Diagnóstico precoce de DMG salva vidas — da mãe e do bebê.',
    'Não permita DMG tardio: rastreie no tempo certo.',
    'DMG confirmado NÃO se repete exame — a conduta é seguir o protocolo.',
    'Rastreio universal entre 24 e 28 semanas. Sem exceção.',
    'Glicemia de jejum ≥ 92 mg/dL na 1ª consulta já é DMG.',
    'DMG tratado é desfecho materno-fetal preservado.',
    'TOTG 75g é o padrão-ouro entre 24-28 semanas; jejum, 1h e 2h.',
    'Insulinização em DMG segue com o obstetra — o endócrino apoia, não assume o pré-natal.',
    'Reclassificação pós-parto (6-12 semanas) é obrigatória em toda paciente com DMG.',
  ];
  const [dicasPool, setDicasPool] = useState<string[]>(DICAS_FALLBACK);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('dicas_dashboard')
        .select('texto')
        .eq('ativa', true)
        .order('slot', { ascending: true });
      if (!error && data && data.length > 0) {
        const textos = (data as { texto: string }[])
          .map((d) => (d.texto || '').trim())
          .filter((t) => t.length > 0);
        if (textos.length > 0) setDicasPool(textos);
      }
    })();
  }, []);
  const diaDoAno = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const dicaHoje = dicasPool[diaDoAno % dicasPool.length];

  return (
    <div>
      {ehInstitucional && (
        <section className="mb-8">
          <div className="pb-6 border-b" style={{ borderColor: '#E2E8F0' }}>
            <h1
              className="text-4xl md:text-5xl font-bold tracking-tight"
              style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
            >
              Olá, {nomeExibicao} ✨
            </h1>
            <p className="mt-2 text-base" style={{ color: '#64748B' }}>
              {saudacaoHorario}, tenha um atendimento tranquilo.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4 flex items-start gap-3" style={{ borderColor: '#E2E8F0' }}>
              <div className="rounded-xl p-2" style={{ background: '#F5F0FF' }}>
                <Building2 className="h-5 w-5" style={{ color: '#9b87f5' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Sua unidade</div>
                <div className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                  {profissionalData?.unidade_id ? (unidadeNome ?? 'Carregando…') : 'Consultório particular'}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 flex items-start gap-3" style={{ borderColor: '#E2E8F0' }}>
              <div className="rounded-xl p-2" style={{ background: '#F5F0FF' }}>
                <CalendarDays className="h-5 w-5" style={{ color: '#9b87f5' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Hoje é</div>
                <div className="text-sm font-medium capitalize" style={{ color: '#1E293B' }}>{dataExtenso}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>Ótimo dia para cuidar das suas gestantes.</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNovaPaciente}
              className="group rounded-2xl p-4 flex items-center gap-3 text-left transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #9b87f5 0%, #7E69AB 100%)',
                boxShadow: '0 4px 14px -4px rgba(155, 135, 245, 0.5)',
              }}
            >
              <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-sm">
                <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wide font-semibold text-white/80">Ação rápida</div>
                <div className="text-base font-semibold text-white">Cadastrar nova paciente</div>
                <div className="text-xs text-white/80 mt-0.5">Iniciar uma nova ficha clínica →</div>
              </div>
            </button>
          </div>

          <div
            className="mt-6 rounded-2xl border p-4 flex items-start gap-3"
            style={{ background: '#F5F0FF', borderColor: '#E9E3FA' }}
          >
            <Sparkles className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#7E69AB' }} />
            <div>
              <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#7E69AB' }}>Dica do dia</div>
              <div className="text-sm" style={{ color: '#1E293B' }}>{dicaHoje}</div>
            </div>
          </div>

          <div className="mt-8 border-b" style={{ borderColor: '#E2E8F0' }} />
        </section>
      )}


      {/* Usage warning banner */}
      {profissionalData && !ehInstitucional && (
        <UsageWarningBanner
          laudosUsados={profissionalData.laudos_usados}
          laudosLimite={profissionalData.laudos_limite}
        />
      )}



      <div>

        {/* Plan usage bar */}
        {(profissionalData || isPreview) && !ehInstitucional && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                {isPreview ? 'Plano Teste' : `Plano ${profissionalData?.planos?.nome ?? ''}`}
              </span>
              <button
                onClick={() => navigate(`${isPreview ? '/vitrine' : ''}/planos`)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Gerenciar plano
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Laudos utilizados</span>
              <span className="text-sm text-muted-foreground">
                {isPreview ? '3' : profissionalData?.laudos_usados}/{isPreview ? '10' : profissionalData?.laudos_limite}
              </span>
            </div>
            <Progress value={isPreview ? 30 : usagePercent} className="h-2" />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pacientes</span>
              <span className="text-sm text-muted-foreground">
                {pacientes.length}
              </span>
            </div>
          </div>
        )}

        {/* Search + New Patient */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary/70 transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Buscar paciente por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-14 pl-12 pr-12 text-base bg-card border-2 border-border rounded-xl shadow-sm transition-all placeholder:text-muted-foreground/70 hover:border-primary/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:shadow-md"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {!ehInstitucional && (
            <Button onClick={handleNovaPaciente} className="shrink-0">
              <Plus className="h-4 w-4" />
              Nova Paciente
            </Button>
          )}

        </div>

        {/* Toggle: mostrar fichas encerradas */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {!isPreview ? <RealtimeIndicator status={rtStatus} /> : <span />}
          <div className="flex items-center gap-2">
          <Switch
            id="show-encerradas"
            checked={showEncerradas}
            onCheckedChange={(v) => { setShowEncerradas(v); setPage(1); }}
          />
          <label
            htmlFor="show-encerradas"
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            Mostrar fichas encerradas
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Inclui pacientes com status "Resultado do parto", "DMG afastado" e "Associar endocrino".
            </TooltipContent>
          </Tooltip>
          </div>
        </div>

        {/* Patient list */}
        {loadingPacientes ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : paginated.length === 0 && !search ? (
          /* Empty state */
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <User className="mx-auto h-14 w-14 text-muted-foreground/30" />
            <p className="mt-4 font-heading text-lg font-semibold text-foreground">
              Você ainda não tem pacientes cadastradas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clique em "+Nova Paciente" para começar.
            </p>
            <Button className="mt-6" onClick={handleNovaPaciente}>
              <Plus className="h-4 w-4" />
              Nova Paciente
            </Button>
          </div>
        ) : paginated.length === 0 && search ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma paciente encontrada para "{search}".
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                    <th className="w-8 px-2 py-4" aria-label="Atenção"></th>
                    <th className="w-auto px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80">Paciente</th>
                    <th className="w-[88px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">IG hoje</th>
                    <th className="w-[120px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">Última consulta</th>
                    <th className="w-[160px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">Status</th>
                    <th className="w-[220px] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">Retorno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((pac) => {
                    const returnBadge = getReturnBadge(pac);
                    const statusCfg = STATUS_CONFIG[pac.status_ficha] || STATUS_CONFIG.aguardando_gj;

                    return (
                      <tr
                        key={pac.id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => navigate(`${isPreview ? '/vitrine' : ''}/paciente/${pac.id}`)}
                      >
                        {/* 38B-C (#15): ícone de atenção em coluna própria — nomes alinhados. */}
                        <td className="w-8 px-2 py-3 align-middle">
                          {pac.dmg_gestacao_anterior && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>Histórico de DMG em gestação anterior.</TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          <div className="min-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="truncate font-medium text-foreground hover:text-primary">{pac.nome}</p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{pac.nome}</TooltipContent>
                            </Tooltip>
                            {pac.numero_identificacao && (
                              <p className="truncate text-xs text-muted-foreground">{pac.numero_identificacao}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatIg(igMap.get(pac.id) ?? null)}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {pac.data_ultima_consulta
                            ? formatDateBR(pac.data_ultima_consulta)
                            : '—'}
                        </td>

                        <td className="px-4 py-3">
                          {/* 38B-C (#7): Overt lê o cenário do registro, não o status. */}
                          {overtIds.has(pac.id) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#B91C1C] px-2.5 py-0.5 text-xs font-medium text-white whitespace-nowrap">
                                  OVERT DM
                                  <Info className="h-3 w-3 opacity-70" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">Diabete pré-existente diagnosticado na gestação (OVERT DM). Conduta distinta do DMG gestacional.</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white whitespace-nowrap ${statusCfg.color}`}>
                                  {statusCfg.label}
                                  <Info className="h-3 w-3 opacity-70" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{statusCfg.meaning}</TooltipContent>
                            </Tooltip>

                          )}
                        </td>
                        <td className="px-4 py-3">
                          {returnBadge && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                                  returnBadge.type === 'vencido'
                                    ? 'bg-red-100 text-red-700'
                                    : returnBadge.type === 'proximo'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-muted text-muted-foreground'
                                }`}>

                                  {returnBadge.type === 'vencido'
                                    ? <Clock className="h-3 w-3 shrink-0" />
                                    : <CalendarCheck className="h-3 w-3 shrink-0" />}
                                  {returnBadge.label}
                                  <Info className="h-3 w-3 opacity-70" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{returnBadge.tooltip}</TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((pac) => {
                const returnBadge = getReturnBadge(pac);
                const statusCfg = STATUS_CONFIG[pac.status_ficha] || STATUS_CONFIG.aguardando_gj;

                return (
                  <button
                    key={pac.id}
                    onClick={() => navigate(`${isPreview ? '/vitrine' : ''}/paciente/${pac.id}`)}
                    className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* 38B-C (#15): slot fixo do ícone — nomes alinhados com ou sem ⚠. */}
                        <div className="flex w-4 shrink-0 justify-center">
                          {pac.dmg_gestacao_anterior && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{pac.nome}</p>
                          {pac.numero_identificacao && (
                            <p className="text-xs text-muted-foreground">{pac.numero_identificacao}</p>
                          )}
                        </div>
                      </div>
                      {overtIds.has(pac.id) ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-[#B91C1C] px-2 py-0.5 text-xs font-medium text-white">
                          OVERT DM
                        </span>
                      ) : (
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>IG: {formatIg(igMap.get(pac.id) ?? null)}</span>
                      <span>
                        Última: {pac.data_ultima_consulta
                          ? formatDateBR(pac.data_ultima_consulta)
                          : '—'}
                      </span>
                    </div>
                    {returnBadge && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          returnBadge.type === 'vencido'
                            ? 'bg-red-100 text-red-700'
                            : returnBadge.type === 'proximo'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {returnBadge.type === 'vencido'
                            ? <Clock className="h-3 w-3 shrink-0" />
                            : <CalendarCheck className="h-3 w-3 shrink-0" />}
                          {returnBadge.label}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Blocking modal for plan upgrade */}
      <BlockingModal
        open={showBlockingModal}
        onClose={() => setShowBlockingModal(false)}
        planoNome={profissionalData?.planos?.nome}
      />
    </div>
  );
}
