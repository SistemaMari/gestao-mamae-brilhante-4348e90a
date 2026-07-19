import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { differenceInDays } from 'date-fns';
import { parseDateLocal, formatDateBR } from '@/lib/dateUtils';
import { getStatusPacienteChip, isPacienteEncerrada } from '@/lib/fichaUtils';
import { useIgBatch, formatIg } from '@/lib/getIg';

interface Paciente extends PreviewPaciente {}

// 38B-C (#16): semáforo de 3 estados a partir de data_proximo_retorno.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

function getReturnBadge(paciente: Paciente, t: TFunc): {
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
      label: t('dashboard.returnBadge.overdueLabel', { count: dias }),
      tooltip: t('dashboard.returnBadge.overdueTooltip', { count: dias, date: dataLimite }),
    };
  }

  if (diff <= 3) {
    return {
      type: 'proximo',
      label: t('dashboard.returnBadge.soonLabel', { date: dataLimite }),
      tooltip: t('dashboard.returnBadge.soonTooltip', { count: diff, date: dataLimite }),
    };
  }

  return {
    type: 'em_dia',
    label: t('dashboard.returnBadge.onTrackLabel', { date: dataLimite }),
    tooltip: t('dashboard.returnBadge.onTrackTooltip', { date: dataLimite }),
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
  const { t, i18n } = useTranslation();
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const { profile, user } = useAuth();
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
  const [aniversario, setAniversario] = useState<string | null>(null);

  const DICAS_FALLBACK = useMemo(() => [
    t('dashboard.tips.tip1'),
    t('dashboard.tips.tip2'),
    t('dashboard.tips.tip3'),
    t('dashboard.tips.tip4'),
    t('dashboard.tips.tip5'),
    t('dashboard.tips.tip6'),
    t('dashboard.tips.tip7'),
    t('dashboard.tips.tip8'),
    t('dashboard.tips.tip9'),
  ], [t]);
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
    if (!user?.id) {
      setAniversario(null);
      return;
    }
    supabase.from('profissionais').select('data_aniversario').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setAniversario((data as any)?.data_aniversario ?? null));
  }, [user?.id]);

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
      .select('id, nome, numero_identificacao, dum, usg_data, usg_ig_semanas, usg_ig_dias, status_ficha, motivo_encerramento, dmg_gestacao_anterior, data_ultima_consulta, data_proximo_retorno, tipo_retorno')
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

  const filtered = useMemo(() => {
    let list = pacientes;
    if (!showEncerradas) {
      // Ajustes V3 item 6 — encerramento agora inclui os motivos (parto/aborto/…)
      // e a insulinização, não só os status_ficha terminais legados.
      list = list.filter((p) => !isPacienteEncerrada(p));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.nome.toLowerCase().includes(q));
    }
    // Ajustes V3 item 7 — painel de pacientes em ordem alfabética (por nome).
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
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

  const pacientesMax = profissionalData?.planos?.pacientes_max ?? null;
  const usagePercent = profissionalData && pacientesMax
    ? Math.round((profissionalData.pacientes_usados / pacientesMax) * 100)
    : 0;

  if (profLoading && !isPreview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const nomeExibicao = (() => {
    const partes = (profissionalData?.nome || '').trim().split(/\s+/).filter(Boolean);
    const honorificos = /^(dr|dra|dr\.|dra\.|prof|prof\.|sr|sra|sr\.|sra\.)$/i;
    const primeiro = partes.find((p) => !honorificos.test(p));
    if (!primeiro) return t('dashboard.welcomeFallback');
    // Se havia um honorífico antes, mostra "Dr. Nome"
    const temHonorifico = partes[0] && honorificos.test(partes[0]);
    return temHonorifico ? `${partes[0]} ${primeiro}` : primeiro;
  })();
  const hora = new Date().getHours();
  const saudacaoHorario = hora < 12
    ? t('dashboard.greetingMorning')
    : hora < 18
      ? t('dashboard.greetingAfternoon')
      : t('dashboard.greetingEvening');
  const dataExtenso = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const diaDoAno = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const dicaHoje = dicasPool[diaDoAno % dicasPool.length];

  const hojeAniversario = (() => {
    if (!aniversario) return false;
    const d = new Date(aniversario + 'T00:00:00');
    const h = new Date();
    return d.getUTCMonth() === h.getMonth() && d.getUTCDate() === h.getDate();
  })();


  return (
    <div>
      {(ehInstitucional || profile === 'consultorio') && (
        <section className="mb-8">
          <div
            className="pb-6 border-b"
            style={{
              borderColor: hojeAniversario ? '#E8E0FF' : '#E2E8F0',
              background: hojeAniversario ? 'linear-gradient(90deg, #F5F0FF, #FFFFFF)' : undefined,
              borderRadius: hojeAniversario ? 16 : undefined,
              padding: hojeAniversario ? '20px 24px' : undefined,
            }}
          >
            <h1
              className="text-4xl md:text-5xl font-bold tracking-tight"
              style={{ color: hojeAniversario ? '#7E69AB' : '#1E293B', fontFamily: 'Sora, sans-serif' }}
            >
              {hojeAniversario
                ? t('dashboard.birthdayTitle', { name: nomeExibicao })
                : t('dashboard.greetingTitle', { name: nomeExibicao })}
            </h1>
            <p className="mt-2 text-base" style={{ color: hojeAniversario ? '#7E69AB' : '#64748B' }}>
              {hojeAniversario
                ? t('dashboard.birthdayMessage')
                : t('dashboard.greetingSubtitle', { greeting: saudacaoHorario })}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4 flex items-start gap-3" style={{ borderColor: '#E2E8F0' }}>
              <div className="rounded-xl p-2" style={{ background: '#F5F0FF' }}>
                <Building2 className="h-5 w-5" style={{ color: '#9b87f5' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{t('dashboard.yourUnit')}</div>
                <div className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>
                  {profissionalData?.unidade_id ? (unidadeNome ?? t('common.loading')) : t('dashboard.privateOffice')}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 flex items-start gap-3" style={{ borderColor: '#E2E8F0' }}>
              <div className="rounded-xl p-2" style={{ background: '#F5F0FF' }}>
                <CalendarDays className="h-5 w-5" style={{ color: '#9b87f5' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{t('dashboard.todayIs')}</div>
                <div className="text-sm font-medium capitalize" style={{ color: '#1E293B' }}>{dataExtenso}</div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{t('dashboard.todaySubtitle')}</div>
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
                <div className="text-xs uppercase tracking-wide font-semibold text-white/80">{t('dashboard.quickAction')}</div>
                <div className="text-base font-semibold text-white">{t('dashboard.registerNewPatient')}</div>
                <div className="text-xs text-white/80 mt-0.5">{t('dashboard.startNewFile')}</div>
              </div>
            </button>
          </div>

          <div
            className="mt-6 rounded-2xl border p-4 flex items-start gap-3"
            style={{ background: '#F5F0FF', borderColor: '#E9E3FA' }}
          >
            <Sparkles className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#7E69AB' }} />
            <div>
              <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#7E69AB' }}>{t('dashboard.tipOfTheDay')}</div>
              <div className="text-sm" style={{ color: '#1E293B' }}>{dicaHoje}</div>
            </div>
          </div>

          <div className="mt-8 border-b" style={{ borderColor: '#E2E8F0' }} />
        </section>
      )}


      {/* Usage warning banner */}
      {profissionalData && !ehInstitucional && (
        <UsageWarningBanner
          usados={profissionalData.pacientes_usados}
          limite={pacientesMax}
        />
      )}



      <div>

        {/* Plan usage bar */}
        {(profissionalData || isPreview) && !ehInstitucional && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                {isPreview ? t('dashboard.testPlan') : t('dashboard.planName', { name: profissionalData?.planos?.nome ?? '' })}
              </span>
              <button
                onClick={() => navigate(`${isPreview ? '/vitrine' : ''}/planos`)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('dashboard.managePlan')}
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t('dashboard.patientsUsed')}</span>
              <span className="text-sm text-muted-foreground">
                {isPreview ? '3' : profissionalData?.pacientes_usados}/{isPreview ? '10' : (pacientesMax ?? '∞')}
              </span>
            </div>
            <Progress value={isPreview ? 30 : usagePercent} className="h-2" />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.reportsGeneratedInfo')}</span>
              <span className="text-sm text-muted-foreground">
                {isPreview ? pacientes.length : profissionalData?.laudos_usados ?? 0}
              </span>
            </div>
          </div>
        )}

        {/* Search + New Patient */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary/70 transition-colors group-focus-within:text-primary" />
            <Input
              placeholder={t('dashboard.searchPlaceholder')}
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
            {t('dashboard.showClosedFiles')}
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t('dashboard.showClosedFilesTooltip')}
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
              {t('dashboard.noPatients')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('dashboard.noPatientsHint')}
            </p>
            <Button className="mt-6" onClick={handleNovaPaciente}>
              <Plus className="h-4 w-4" />
              {t('dashboard.newPatient')}
            </Button>
          </div>
        ) : paginated.length === 0 && search ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              {t('dashboard.noResults', { search })}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-8" />
                  <col />
                  <col className="w-[88px]" />
                  <col className="w-[120px]" />
                  <col className="w-[180px]" />
                  <col className="w-[170px]" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                    <th className="px-3 py-4" aria-label={t('dashboard.attention')}></th>
                    <th className="px-7 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80">{t('dashboard.colPatient')}</th>
                    <th className="border-l border-primary/15 px-7 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">{t('dashboard.colGaToday')}</th>
                    <th className="border-l border-primary/15 px-7 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">{t('dashboard.colLastConsultation')}</th>
                    <th className="border-l border-primary/15 px-7 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">{t('common.status')}</th>
                    <th className="border-l border-primary/15 px-7 py-4 text-left text-xs font-semibold uppercase tracking-wider text-foreground/80 whitespace-nowrap">{t('dashboard.colReturn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((pac) => {
                    const returnBadge = getReturnBadge(pac, t);
                    const statusCfg = getStatusPacienteChip(pac);

                    return (
                      <tr
                        key={pac.id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => navigate(`${isPreview ? '/vitrine' : ''}/paciente/${pac.id}`)}
                      >
                        {/* 38B-C (#15): ícone de atenção em coluna própria — nomes alinhados. */}
                        <td className="px-3 py-3 align-middle">
                          {pac.dmg_gestacao_anterior && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>{t('dashboard.dmgPriorTooltip')}</TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                        <td className="px-7 py-3 min-w-0">
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
                        <td className="border-l border-border/70 px-7 py-3 text-muted-foreground whitespace-nowrap">{formatIg(igMap.get(pac.id) ?? null)}</td>
                        <td className="border-l border-border/70 px-7 py-3 text-muted-foreground whitespace-nowrap">
                          {pac.data_ultima_consulta
                            ? formatDateBR(pac.data_ultima_consulta)
                            : t('dashboard.noDate')}
                        </td>

                        <td className="border-l border-border/70 px-7 py-3">
                          {/* 38B-C (#7): Overt lê o cenário do registro, não o status. */}
                          {overtIds.has(pac.id) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#B91C1C] px-2.5 py-0.5 text-xs font-medium text-white whitespace-nowrap">
                                  OVERT DM
                                  <Info className="h-3 w-3 opacity-70" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">{t('dashboard.overtTooltip')}</TooltipContent>
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
                        <td className="border-l border-border/70 px-7 py-3">
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
                const returnBadge = getReturnBadge(pac, t);
                const statusCfg = getStatusPacienteChip(pac);

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
                      <span>{t('dashboard.gaShort')}: {formatIg(igMap.get(pac.id) ?? null)}</span>
                      <span>
                        {t('dashboard.lastShort')}: {pac.data_ultima_consulta
                          ? formatDateBR(pac.data_ultima_consulta)
                          : t('dashboard.noDate')}
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
                  {t('dashboard.previous')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('dashboard.pageOf', { page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('dashboard.next')}
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
