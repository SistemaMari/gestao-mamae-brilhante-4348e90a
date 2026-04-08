import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import UsageWarningBanner from '@/components/UsageWarningBanner';
import BlockingModal from '@/components/BlockingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getPreviewPacientes, type PreviewPaciente } from '@/lib/previewPatients';
import {
  Plus, Search, X, AlertTriangle, Clock, CalendarCheck,
  User, Info, Loader2
} from 'lucide-react';
import { differenceInDays, format, addDays } from 'date-fns';

interface Paciente extends PreviewPaciente {}

const STATUS_CONFIG: Record<string, { label: string; color: string; meaning: string }> = {
  aguardando_gj: {
    label: 'Aguardando GJ',
    color: 'bg-gray-500',
    meaning: 'Consulta 1 registrada. Aguardando resultado da glicemia de jejum.',
  },
  aguardando_gtt: {
    label: 'Aguardando GTT',
    color: 'bg-blue-500',
    meaning: 'GJ normal (< 92). Aguardando GTT 75g entre 24-28 semanas.',
  },
  dmg_afastado: {
    label: 'DMG afastado',
    color: 'bg-emerald-500',
    meaning: 'GTT normal. Diagnóstico de DMG descartado. Pré-natal normal.',
  },
  dmg_confirmado: {
    label: 'DMG confirmado',
    color: 'bg-orange-500',
    meaning: 'Diabete Mellitus Gestacional confirmado. Paciente em acompanhamento ativo.',
  },
  resultado_parto: {
    label: 'Resultado do parto',
    color: 'bg-purple-500',
    meaning: 'Parto realizado. Desfecho perinatal registrado.',
  },
  encaminhada_endocrino: {
    label: 'Encaminhada — endocrino',
    color: 'bg-red-500',
    meaning: 'Cenário 7: controle inadequado com insulina. Acompanhamento compartilhado GO + endocrinologista.',
  },
};

function calcIdadeGestacional(paciente: Paciente): string {
  let refDate: Date | null = null;

  if (paciente.usg_data && paciente.usg_ig_semanas != null) {
    const usgDate = new Date(paciente.usg_data);
    const diasNaUsg = (paciente.usg_ig_semanas * 7) + (paciente.usg_ig_dias || 0);
    refDate = addDays(usgDate, -diasNaUsg); // DUM corrigida
  } else if (paciente.dum) {
    refDate = new Date(paciente.dum);
  }

  if (!refDate) return '—';

  const today = new Date();
  const totalDias = differenceInDays(today, refDate);
  if (totalDias < 0) return '—';

  const semanas = Math.floor(totalDias / 7);
  const dias = totalDias % 7;
  return `${semanas} sem + ${dias} dias`;
}

function getReturnBadge(paciente: Paciente): { type: 'proximo' | 'vencido'; tooltip: string } | null {
  if (paciente.status_ficha !== 'dmg_confirmado') return null;
  if (!paciente.data_proximo_retorno) return null;

  const retornoDate = new Date(paciente.data_proximo_retorno);
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
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [search, setSearch] = useState('');
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [page, setPage] = useState(1);

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

    fetchPacientes();
  }, [isPreview, profissionalData]);

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

  const fetchPacientes = async () => {
    if (!profissionalData || isPreview) return;
    setLoadingPacientes(true);

    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, numero_identificacao, dum, usg_data, usg_ig_semanas, usg_ig_dias, status_ficha, dmg_gestacao_anterior, data_ultima_consulta, data_proximo_retorno, tipo_retorno')
      .order('data_ultima_consulta', { ascending: false, nullsFirst: false });

    setPacientes((data as Paciente[]) || []);
    setLoadingPacientes(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return pacientes;
    const q = search.toLowerCase();
    return pacientes.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pacientes, search]);

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
      {profissionalData && (
        <UsageWarningBanner
          laudosUsados={profissionalData.laudos_usados}
          laudosLimite={profissionalData.laudos_limite}
        />
      )}

      <div>

        {/* Plan usage bar */}
        {profissionalData && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Laudos utilizados</span>
              <span className="text-sm text-muted-foreground">{profissionalData.laudos_usados}/{profissionalData.laudos_limite}</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">IG</th>
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
                            ? format(new Date(pac.data_ultima_consulta), 'dd/MM/yyyy')
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
                          ? format(new Date(pac.data_ultima_consulta), 'dd/MM/yyyy')
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
        tipo="pacientes"
      />
    </div>
  );
}
