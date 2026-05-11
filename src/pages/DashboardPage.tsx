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
  User, Info, Loader2
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { parseDateLocal, formatDateBR } from '@/lib/dateUtils';
import { STATUS_CONFIG, calcIdadeGestacional } from '@/lib/fichaUtils';

interface Paciente extends PreviewPaciente {}

function getReturnBadge(paciente: Paciente): { type: 'proximo' | 'vencido'; tooltip: string } | null {
  if (paciente.status_ficha !== 'dmg_confirmado') return null;
  if (!paciente.data_proximo_retorno) return null;

  const retornoDate = parseDateLocal(paciente.data_proximo_retorno);
  if (!retornoDate) return null;
  const today = new Date();
  const diff = differenceInDays(retornoDate, today);

  if (diff < 0) {
    return {
      type: 'vencido',
      tooltip: 'O prazo de retorno já foi ultrapassado. Este badge NÃO pode ser fechado ou ocultado.',
    };
  }

  if (diff <= 2) {
    return {
      type: 'proximo',
      tooltip: 'Faltam 2 dias ou menos para o prazo de retorno esperado.',
    };
  }

  return null;
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

  const fetchPacientes = useCallback(async () => {
    if (!profissionalData || isPreview) return;

    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, numero_identificacao, dum, usg_data, usg_ig_semanas, usg_ig_dias, status_ficha, dmg_gestacao_anterior, data_ultima_consulta, data_proximo_retorno, tipo_retorno')
      .eq('is_rascunho', false)
      .order('data_ultima_consulta', { ascending: false, nullsFirst: false });

    setPacientes((data as Paciente[]) || []);
    setLoadingPacientes(false);
  }, [profissionalData, isPreview]);

  useEffect(() => {
    if (isPreview) {
      setPacientes(getPreviewPacientes());
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
      setPacientes(getPreviewPacientes());
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

  return (
    <div>
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleNovaPaciente} className="shrink-0">
            <Plus className="h-4 w-4" />
            Nova Paciente
          </Button>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Paciente</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">IG hoje</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Última consulta</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Retorno</th>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {pac.dmg_gestacao_anterior && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Histórico de DMG em gestação anterior.</TooltipContent>
                              </Tooltip>
                            )}
                            <div>
                              <p className="font-medium text-foreground hover:text-primary">{pac.nome}</p>
                              {pac.numero_identificacao && (
                                <p className="text-xs text-muted-foreground">{pac.numero_identificacao}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{calcIdadeGestacional(pac)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {pac.data_ultima_consulta
                            ? formatDateBR(pac.data_ultima_consulta)
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${statusCfg.color}`}>
                                {statusCfg.label}
                                <Info className="h-3 w-3 opacity-70" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{statusCfg.meaning}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-4 py-3">
                          {returnBadge && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  returnBadge.type === 'vencido'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {returnBadge.type === 'vencido' ? (
                                    <><Clock className="h-3 w-3" /> Vencido</>
                                  ) : (
                                    <><CalendarCheck className="h-3 w-3" /> Próximo</>
                                  )}
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
                        {pac.dmg_gestacao_anterior && (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{pac.nome}</p>
                          {pac.numero_identificacao && (
                            <p className="text-xs text-muted-foreground">{pac.numero_identificacao}</p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>IG: {calcIdadeGestacional(pac)}</span>
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
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {returnBadge.type === 'vencido' ? (
                            <><Clock className="h-3 w-3" /> Retorno vencido</>
                          ) : (
                            <><CalendarCheck className="h-3 w-3" /> Retorno próximo</>
                          )}
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
