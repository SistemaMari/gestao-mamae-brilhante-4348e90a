import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreviewPacienteById,
  updatePreviewPaciente,
  type PreviewPaciente,
  type PreviewConsulta,
} from '@/lib/previewPatients';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle, Calendar, Clock, FileText, Pencil, Plus, User, Loader2,
} from 'lucide-react';
import Retorno1Form from '@/components/Retorno1Form';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { differenceInYears, differenceInDays, addDays, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aguardando_gj: { label: 'Aguardando GJ', color: 'bg-gray-500' },
  aguardando_gtt: { label: 'Aguardando GTT', color: 'bg-blue-500' },
  dmg_afastado: { label: 'DMG afastado', color: 'bg-emerald-500' },
  dmg_confirmado: { label: 'DMG confirmado', color: 'bg-orange-500' },
  resultado_parto: { label: 'Resultado do parto', color: 'bg-purple-500' },
  encaminhada_endocrino: { label: 'Associar endocrino', color: 'bg-red-500' },
};

// P6: Full names for consultation types
const CONSULTA_NAMES: Record<string, string> = {
  consulta_1: 'CONSULTA 1 — Hora de rastrear o DMG (glicemia plasmática de jejum)',
  retorno_1: 'RETORNO 1 — Hora de confirmar o diagnóstico e iniciar o tratamento',
  retorno_gtt: 'RETORNO GTT 75g (24-28 semanas)',
  retorno_2: 'RETORNO 2 — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo',
  retorno_3: 'RETORNO 3 — Hora de ver o resultado da insulina (Perfil Glicêmico de 6 pontos) e definir próximo passo',
  ficha_a: 'FICHA A — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × 15 dias)',
  ficha_b: 'FICHA B — Acompanhamento com insulina (Perfil Glicêmico de 6 pontos × 15 dias)',
  ficha_c: 'FICHA C — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × 7 dias)',
  ficha_d: 'FICHA D — Acompanhamento com insulina (Perfil Glicêmico de 6 pontos × 7 dias)',
  registro_parto: 'FICHA DE REGISTRO DO PARTO',
};

/**
 * Determines the next step button text and form type based on:
 * - status_ficha
 * - consultation history
 * - insulin usage (future)
 * - current IG (future)
 */
function getNextStepInfo(
  statusFicha: string,
  consultas: PreviewConsulta[],
  igAtual: { semanas: number; dias: number } | null,
): { label: string; formType: string } | null {
  const _hasRetorno1 = consultas.some(c => c.tipo === 'retorno_1');
  const _hasRetornoGtt = consultas.some(c => c.tipo === 'retorno_gtt');
  const hasRetorno2 = consultas.some(c => c.tipo === 'retorno_2');
  const hasRetorno3 = consultas.some(c => c.tipo === 'retorno_3');

  switch (statusFicha) {
    case 'aguardando_gj':
      return {
        label: '+ RETORNO 1 — Hora de confirmar o diagnóstico e iniciar o tratamento',
        formType: 'retorno_1',
      };

    case 'aguardando_gtt':
      return {
        label: '+ RETORNO GTT 75g (24-28 semanas)',
        formType: 'retorno_gtt',
      };

    case 'dmg_confirmado': {
      // After Retorno 1 positive or GTT positive, next is Retorno 2
      if (!hasRetorno2) {
        return {
          label: '+ RETORNO 2 — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo',
          formType: 'retorno_2',
        };
      }
      // After Retorno 2 with inadequate control → Retorno 3
      if (!hasRetorno3) {
        // TODO: check if insulin was started — for now assume inadequate control path
        return {
          label: '+ RETORNO 3 — Hora de ver o resultado da insulina (Perfil Glicêmico de 6 pontos) e definir próximo passo',
          formType: 'retorno_3',
        };
      }
      // After Retorno 2/3 with adequate control → Ficha A/B/C/D based on insulin + IG
      // For now, show ficha based on IG (insulin logic TBD)
      const igSem = igAtual?.semanas ?? 0;
      if (igSem <= 30) {
        return {
          label: '+ FICHA A — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × 15 dias)',
          formType: 'ficha_a',
        };
      }
      return {
        label: '+ FICHA C — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × 7 dias)',
        formType: 'ficha_c',
      };
    }

    case 'dmg_afastado':
      return null; // No next step

    case 'resultado_parto':
      return null; // No next step

    case 'encaminhada_endocrino':
      return null; // Only parto registration available (shown as secondary)

    default:
      return null;
  }
}

/** Check if the secondary "Registro do Parto" button should show */
function canShowRegistroParto(statusFicha: string): boolean {
  return statusFicha === 'dmg_confirmado' || statusFicha === 'encaminhada_endocrino';
}

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isPreview = location.pathname.startsWith('/vitrine');
  useAuth();
  useProfissionalData();

  const [paciente, setPaciente] = useState<PreviewPaciente | null>(null);
  const [consultas, setConsultas] = useState<PreviewConsulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRetorno1, setShowRetorno1] = useState(false);
  // P3: Track whether retorno1 result is being displayed
  const [retorno1Completed, setRetorno1Completed] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editNumeroId, setEditNumeroId] = useState('');
  const [editDmgAnterior, setEditDmgAnterior] = useState<boolean>(false);
  const [editDataConsulta, setEditDataConsulta] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');

  useEffect(() => {
    if (!id) return;

    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
      }
      setLoading(false);
      return;
    }

    (async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', id)
        .single();

      if (pac) {
        setPaciente({
          ...pac,
          data_nascimento: pac.data_nascimento || null,
          consultas: [],
        } as any);

        const { data: cons } = await supabase
          .from('consultas')
          .select('*')
          .eq('paciente_id', id)
          .order('data', { ascending: true });

        setConsultas(
          (cons || []).map((c: any) => ({
            id: c.id,
            tipo: c.tipo,
            numero_sequencial: c.numero_sequencial,
            data: c.data,
            ig_semanas: c.ig_semanas,
            ig_dias: c.ig_dias,
            observacoes: c.observacoes,
            status_gerado: c.status_gerado,
          }))
        );
      }
      setLoading(false);
    })();
  }, [id, isPreview]);

  const idade = useMemo(() => {
    if (!paciente?.data_nascimento) return null;
    return differenceInYears(new Date(), new Date(paciente.data_nascimento));
  }, [paciente?.data_nascimento]);

  const primeiraConsulta = consultas.find((c) => c.tipo === 'consulta_1');
  const ultimaConsulta = consultas.length > 0 ? consultas[consultas.length - 1] : null;

  // P5/P6: History shows ALL previous consultations (everything except the active/current one)
  // When retorno1 is completed and showing result, history = all consultations except last
  const consultasHistorico = useMemo(() => {
    if (retorno1Completed && consultas.length > 1) {
      // Show all but the last (which is the retorno_1 being displayed as result card)
      return consultas.slice(0, -1).reverse();
    }
    if (consultas.length > 1) {
      return consultas.slice(0, -1).reverse();
    }
    return [];
  }, [consultas, retorno1Completed]);

  const _canShowRetorno1 = paciente?.status_ficha === 'aguardando_gj' && !!primeiraConsulta && !showRetorno1 && !retorno1Completed;
  const canShowRetorno1Form = (showRetorno1 || retorno1Completed) && !!primeiraConsulta;

  // P3: Reload patient data without hiding the retorno form
  const reloadPaciente = () => {
    if (!id) return;
    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
      }
    }
    // Mark retorno1 as completed (result card stays visible)
    setRetorno1Completed(true);
    setShowRetorno1(false);
  };

  // IG calculated from DUM
  const igNaConsulta1 = useMemo(() => {
    if (!paciente?.dum || !primeiraConsulta) return null;
    const dias = differenceInDays(new Date(primeiraConsulta.data), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente?.dum, primeiraConsulta]);

  const igAtual = useMemo(() => {
    if (!paciente?.dum) return null;
    const dias = differenceInDays(new Date(), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente?.dum]);

  const dumDate = useMemo(() => {
    if (!paciente?.dum) return null;
    return new Date(paciente.dum);
  }, [paciente?.dum]);

  // GTT window: 24-28 weeks from DUM
  const janelaGTT = useMemo(() => {
    if (!dumDate) return null;
    const inicio = addDays(dumDate, 24 * 7);
    const fim = addDays(dumDate, 28 * 7);
    return { inicio, fim };
  }, [dumDate]);

  const igMaior24 = igAtual ? igAtual.semanas >= 24 : false;

  const status = paciente ? STATUS_CONFIG[paciente.status_ficha] : null;

  // Edit mode helpers
  const startEditing = () => {
    if (!paciente || !primeiraConsulta) return;
    setEditNome(paciente.nome);
    setEditDataNascimento(paciente.data_nascimento || '');
    setEditNumeroId(paciente.numero_identificacao || '');
    setEditDmgAnterior(!!paciente.dmg_gestacao_anterior);
    setEditDataConsulta(primeiraConsulta.data);
    setEditObservacoes(primeiraConsulta.observacoes || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = async () => {
    if (!paciente || !primeiraConsulta || !id) return;
    setEditSaving(true);

    if (isPreview) {
      const updatedConsultas = consultas.map((c) =>
        c.id === primeiraConsulta.id
          ? { ...c, data: editDataConsulta, observacoes: editObservacoes.trim() || null }
          : c
      );
      updatePreviewPaciente(id, {
        nome: editNome.trim(),
        data_nascimento: editDataNascimento,
        numero_identificacao: editNumeroId.trim() || null,
        dmg_gestacao_anterior: editDmgAnterior,
        consultas: updatedConsultas,
      });
      const updated = getPreviewPacienteById(id);
      if (updated) {
        setPaciente(updated);
        setConsultas(updated.consultas || []);
      }
      window.dispatchEvent(new Event('preview-pacientes-updated'));
      toast.success('Dados atualizados com sucesso.');
      setEditing(false);
      setEditSaving(false);
      return;
    }

    const { error: pacErr } = await supabase
      .from('pacientes')
      .update({
        nome: editNome.trim(),
        data_nascimento: editDataNascimento,
        numero_identificacao: editNumeroId.trim() || null,
        dmg_gestacao_anterior: editDmgAnterior,
      })
      .eq('id', id);

    const { error: consErr } = await supabase
      .from('consultas')
      .update({
        data: editDataConsulta,
        observacoes: editObservacoes.trim() || null,
      })
      .eq('id', primeiraConsulta.id);

    setEditSaving(false);

    if (pacErr || consErr) {
      console.error(pacErr, consErr);
      toast.error('Erro ao atualizar dados.');
      return;
    }

    setPaciente((prev) =>
      prev
        ? {
            ...prev,
            nome: editNome.trim(),
            data_nascimento: editDataNascimento,
            numero_identificacao: editNumeroId.trim() || null,
            dmg_gestacao_anterior: editDmgAnterior,
          }
        : prev
    );
    setConsultas((prev) =>
      prev.map((c) =>
        c.id === primeiraConsulta.id
          ? { ...c, data: editDataConsulta, observacoes: editObservacoes.trim() || null }
          : c
      )
    );

    toast.success('Dados atualizados com sucesso.');
    setEditing(false);
  };

  const editIdade = useMemo(() => {
    if (!editDataNascimento) return null;
    return differenceInYears(new Date(), new Date(editDataNascimento));
  }, [editDataNascimento]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-muted-foreground">Paciente não encontrada.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate(isPreview ? '/vitrine/dashboard' : '/dashboard')}
        >
          Voltar ao dashboard
        </Button>
      </div>
    );
  }

  // Check if the retorno_1 is the most recent consultation (for edit button)
  const retorno1IsLast = ultimaConsulta?.tipo === 'retorno_1' && consultas.length <= 2;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* DMG anterior banner */}
      {(editing ? editDmgAnterior : paciente.dmg_gestacao_anterior) && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-orange-400 bg-orange-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <p className="text-sm font-semibold text-orange-800">
            ATENÇÃO — Histórico de DMG em gestação anterior. Fator de risco elevado para recorrência. Monitorar com atenção redobrada.
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {editing ? (
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="text-xl font-bold"
                placeholder="Nome completo"
              />
            ) : (
              <>
                <h1 className="font-heading text-xl font-bold text-foreground">{paciente.nome}</h1>
                {idade !== null && (
                  <span className="text-sm text-muted-foreground">{idade} anos</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <Badge className={`${status.color} text-white border-0 shrink-0`}>
                {status.label}
              </Badge>
            )}
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                className="border-[#9b87f5] text-[#9b87f5] hover:bg-[#E8E0FF] gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Data de nascimento</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={editDataNascimento}
                    onChange={(e) => setEditDataNascimento(e.target.value)}
                  />
                  {editIdade !== null && (
                    <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                      {editIdade} anos
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Número de identificação</label>
                <Input
                  value={editNumeroId}
                  onChange={(e) => setEditNumeroId(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Data da consulta 1</label>
                <Input
                  type="date"
                  value={editDataConsulta}
                  onChange={(e) => setEditDataConsulta(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">DMG em gestação anterior</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDmgAnterior(true)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                      editDmgAnterior
                        ? 'border-[#9b87f5] bg-[#9b87f5]/10 text-[#9b87f5]'
                        : 'border-border bg-card text-muted-foreground hover:border-[#9b87f5]/60'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDmgAnterior(false)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                      !editDmgAnterior
                        ? 'border-[#9b87f5] bg-[#9b87f5]/10 text-[#9b87f5]'
                        : 'border-border bg-card text-muted-foreground hover:border-[#9b87f5]/60'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Observações clínicas</label>
              <Textarea
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" size="sm" onClick={cancelEditing} disabled={editSaving}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={saveEditing}
                disabled={editSaving || !editNome.trim()}
                className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
              >
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Nascimento:</span>{' '}
                  {paciente.data_nascimento ? format(new Date(paciente.data_nascimento), 'dd/MM/yyyy') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Identificação:</span>{' '}
                  {paciente.numero_identificacao
                    ? `${(paciente as any).tipo_identificacao?.toUpperCase() || ''}: ${paciente.numero_identificacao}`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">IG na consulta 1:</span>{' '}
                  {igNaConsulta1
                    ? `${igNaConsulta1.semanas}s ${igNaConsulta1.dias}d`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">IG hoje:</span>{' '}
                  {igAtual ? `${igAtual.semanas} sem + ${igAtual.dias} dias` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Data da consulta 1:</span>{' '}
                  {primeiraConsulta ? format(new Date(primeiraConsulta.data), 'dd/MM/yyyy') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">DUM:</span>{' '}
                  {paciente.dum ? format(new Date(paciente.dum), 'dd/MM/yyyy') : '—'}
                </span>
              </div>
            </div>

            {primeiraConsulta?.observacoes && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground mb-1">Observações clínicas:</p>
                <p className="text-sm text-muted-foreground italic">{primeiraConsulta.observacoes}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* CORREÇÃO 3: Card fixo de destaque da janela do GTT — aparece entre cabeçalho e histórico */}
      {paciente.status_ficha === 'aguardando_gtt' && janelaGTT && igAtual && (() => {
        const igSem = igAtual.semanas;
        if (igSem > 28) {
          // Estado 3 — Crítico
          return (
            <div className="rounded-xl border-2 border-[#EF4444] bg-[#FEE2E2] p-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  ATENÇÃO: Janela do GTT ultrapassada. Solicitar imediatamente.
                </p>
                <p className="mt-1 text-xs text-red-700">
                  A janela ideal (24-28 sem) já foi ultrapassada. Realizar o quanto antes.
                </p>
              </div>
            </div>
          );
        }
        if (igSem >= 24) {
          // Estado 2 — Na janela (urgência)
          return (
            <div className="rounded-xl border-2 border-[#F59E0B] bg-[#FEF3C7] p-4 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
              <div>
                <p className="text-sm font-bold text-amber-800">
                  O GTT 75g já está na janela — solicitar o mais breve possível.
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Janela: até 28 semanas (limite: <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>).
                </p>
              </div>
            </div>
          );
        }
        // Estado 1 — IG < 24 semanas (normal)
        return (
          <div className="rounded-xl border-2 border-[#9b87f5] bg-[#E8E0FF] p-4 flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[#9b87f5]" />
            <div>
              <p className="text-sm font-bold text-[#5B21B6]">
                GTT 75g deverá ser realizado entre <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>
              </p>
              <p className="mt-1 text-xs text-[#6D28D9]">
                O mais próximo possível da 24ª semana.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Confirmation card — green — only when status is still aguardando_gj and no retorno form active */}
      {paciente.status_ficha === 'aguardando_gj' && !showRetorno1 && !retorno1Completed && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
            <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pedido de exame — Consulta 1
            </h2>

            <div className="rounded-lg bg-white/70 p-3">
              <p className="text-sm font-semibold text-emerald-900">Orientação do exame</p>
              <p className="mt-1 text-xs text-emerald-800">
                Consulta 1 registrada com sucesso. Solicitar glicemia plasmática de jejum. Jejum de 8 a 12 horas. Coleta venosa processada em laboratório — glicemia capilar em ponta de dedo não é válida para fins diagnósticos.
              </p>
            </div>

            {janelaGTT && (
              <div className="rounded-lg bg-white/70 p-3">
                <p className="text-sm font-semibold text-emerald-900">Janela para GTT 75g</p>
                <p className="mt-1 text-xs text-emerald-800">
                  {igMaior24 ? (
                    'O GTT 75g já está na janela — solicitar o mais breve possível.'
                  ) : (
                    <>
                      O GTT 75g deverá ser realizado o mais próximo possível da 24ª semana (entre{' '}
                      <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                      <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>
                      ). Oriente a paciente desde já.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
            <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
              <li>Não repetir glicemia de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.</li>
              <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.</li>
              <li>Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.</li>
            </ul>
          </div>
        </>
      )}

      {/* Histórico de consultas */}
      {consultasHistorico.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de consultas
          </h2>

          <Accordion type="multiple" className="space-y-2">
            {consultasHistorico.map((c) => (
              <AccordionItem key={c.id} value={c.id} className="rounded-lg border border-border px-3 py-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between pr-2">
                    <span className="text-xs font-medium text-foreground leading-tight text-left">
                      {CONSULTA_NAMES[c.tipo] || c.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(c.data), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 space-y-2">
                  {c.tipo === 'consulta_1' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Data:</span>{' '}
                          {format(new Date(c.data), 'dd/MM/yyyy')}
                        </div>
                        {igNaConsulta1 && (
                          <div>
                            <span className="font-medium text-foreground">IG na consulta:</span>{' '}
                            {igNaConsulta1.semanas}s {igNaConsulta1.dias}d
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-foreground">Exame solicitado:</span>{' '}
                          Glicemia plasmática de jejum
                        </div>
                        {janelaGTT && (
                          <div>
                            <span className="font-medium text-foreground">GTT 75g entre:</span>{' '}
                            {format(janelaGTT.inicio, 'dd/MM/yyyy')} e {format(janelaGTT.fim, 'dd/MM/yyyy')}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-foreground">DMG anterior:</span>{' '}
                          {paciente.dmg_gestacao_anterior ? 'Sim' : 'Não'}
                        </div>
                      </div>
                    </>
                  )}

                  {c.tipo !== 'consulta_1' && c.ig_semanas != null && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">IG:</span> {c.ig_semanas}s {c.ig_dias || 0}d
                    </p>
                  )}

                  {c.status_gerado && STATUS_CONFIG[c.status_gerado] && (
                    <Badge className={`${STATUS_CONFIG[c.status_gerado].color} text-white border-0 text-[10px]`}>
                      {STATUS_CONFIG[c.status_gerado].label}
                    </Badge>
                  )}

                  {c.observacoes ? (
                    <p className="text-xs text-muted-foreground italic">{c.observacoes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem observações.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Retorno 1 form / result card — stays mounted after saving */}
      {canShowRetorno1Form && primeiraConsulta && paciente && (
        <div>
          <Retorno1Form
            paciente={paciente}
            primeiraConsulta={primeiraConsulta}
            isPreview={isPreview}
            onSaved={reloadPaciente}
            onCancel={() => setShowRetorno1(false)}
            isLastConsulta={retorno1IsLast}
          />
        </div>
      )}

      {/* CORREÇÃO 1+2: Next step button — dynamic based on status + history + IG */}
      {(() => {
        // Don't show button if retorno1 form is active
        if (showRetorno1) return null;
        // Don't show if status has no next step
        if (paciente.status_ficha === 'dmg_afastado' || paciente.status_ficha === 'resultado_parto') return null;

        const nextStep = getNextStepInfo(paciente.status_ficha, consultas, igAtual);
        if (!nextStep) return null;

        const isRetorno1Button = nextStep.formType === 'retorno_1';

        // If retorno1 is completed, don't show retorno1 button again
        if (isRetorno1Button && retorno1Completed) return null;
        // If showing retorno1 form, don't show
        if (isRetorno1Button && canShowRetorno1Form) return null;

        return (
          <Button
            variant="outline"
            className="w-full text-left"
            onClick={() => {
              if (isRetorno1Button) {
                setShowRetorno1(true);
              } else {
                toast('Próximo retorno ainda não implementado.');
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{nextStep.label}</span>
          </Button>
        );
      })()}

      {/* CORREÇÃO 2: Botão secundário — Registro do Parto */}
      {canShowRegistroParto(paciente.status_ficha) && (
        <button
          type="button"
          className="w-full text-center text-sm font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors py-2"
          onClick={() => toast('Registro do parto ainda não implementado.')}
        >
          + FICHA DE REGISTRO DO PARTO
        </button>
      )}
    </div>
  );
}
