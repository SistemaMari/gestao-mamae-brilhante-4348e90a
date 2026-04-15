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
import Consulta1ResultCard from '@/components/Consulta1ResultCard';
import Retorno1ResultCard from '@/components/Retorno1ResultCard';
import GttForm from '@/components/GttForm';
import GttResultCard from '@/components/GttResultCard';
import FichaACForm from '@/components/FichaACForm';
import FichaACResultCard from '@/components/FichaACResultCard';
import FichaACReadOnlyGrid from '@/components/FichaACReadOnlyGrid';
import FichaBDForm from '@/components/FichaBDForm';
import FichaBDResultCard from '@/components/FichaBDResultCard';
import FichaBDReadOnlyGrid from '@/components/FichaBDReadOnlyGrid';
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

// Dynamic display name based on chronological index
function getDisplayName(c: PreviewConsulta, index: number, allConsultas: PreviewConsulta[]): string {
  const prefix = index === 0 ? 'CONSULTA 1' : `RETORNO ${index}`;

  switch (c.tipo) {
    case 'consulta_1':
      return `${prefix} — Hora de rastrear o DMG (glicemia plasmática de jejum)`;
    case 'retorno_1':
      return `${prefix} — Hora de confirmar o diagnóstico e iniciar o tratamento`;
    case 'retorno_gtt':
      return `${prefix} — GTT 75g (24-28 semanas)`;
    case 'ficha_a':
    case 'ficha_c': {
      const isFirst = !allConsultas.slice(0, index).some(prev => ['ficha_a', 'ficha_c'].includes(prev.tipo));
      if (isFirst) {
        return `${prefix} — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo`;
      }
      const dias = (c.ig_semanas ?? 0) > 30 ? 7 : 15;
      return `${prefix} — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × ${dias} dias)`;
    }
    case 'ficha_b':
    case 'ficha_d': {
      const isFirst = !allConsultas.slice(0, index).some(prev => ['ficha_b', 'ficha_d'].includes(prev.tipo));
      if (isFirst) {
        return `${prefix} — Hora de ver o resultado da insulina (Perfil Glicêmico de 6 pontos) e definir próximo passo`;
      }
      const dias = (c.ig_semanas ?? 0) > 30 ? 7 : 15;
      return `${prefix} — Acompanhamento com insulina (Perfil Glicêmico de 6 pontos × ${dias} dias)`;
    }
    case 'registro_parto':
      return `${prefix} — Registro do parto`;
    default:
      return `${prefix} — ${c.tipo}`;
  }
}

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
  const _hasRetorno2 = consultas.some(c => c.tipo === 'retorno_2');
  const _hasRetorno3 = consultas.some(c => c.tipo === 'retorno_3');

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
      const igSem = igAtual?.semanas ?? 0;
      const hasFichaAC = consultas.some(c => ['ficha_a', 'ficha_c'].includes(c.tipo));
      const hasFichaBD = consultas.some(c => ['ficha_b', 'ficha_d'].includes(c.tipo));
      const hasInsulin = consultas.some(c =>
        ['ficha_a', 'ficha_c'].includes(c.tipo) && c.decisao === 'controle_inadequado'
      );
      const nextRetornoNum = consultas.length;

      if (!hasFichaAC && !hasFichaBD) {
        return {
          label: `+ RETORNO ${nextRetornoNum} — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo`,
          formType: igSem <= 30 ? 'ficha_a' : 'ficha_c',
        };
      }

      if (hasInsulin) {
        if (!hasFichaBD) {
          return {
            label: `+ RETORNO ${nextRetornoNum} — Hora de ver o resultado da insulina (Perfil Glicêmico de 6 pontos) e definir próximo passo`,
            formType: igSem <= 30 ? 'ficha_b' : 'ficha_d',
          };
        }
        const dias = igSem <= 30 ? 15 : 7;
        return {
          label: `+ RETORNO ${nextRetornoNum} — Acompanhamento com insulina (Perfil Glicêmico de 6 pontos × ${dias} dias)`,
          formType: igSem <= 30 ? 'ficha_b' : 'ficha_d',
        };
      }

      const dias = igSem <= 30 ? 15 : 7;
      return {
        label: `+ RETORNO ${nextRetornoNum} — Acompanhamento sem insulina (Perfil Glicêmico de 4 pontos × ${dias} dias)`,
        formType: igSem <= 30 ? 'ficha_a' : 'ficha_c',
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
  const [retorno1Completed, setRetorno1Completed] = useState(false);
  const [showFichaAC, setShowFichaAC] = useState(false);
  const [fichaACCompleted, setFichaACCompleted] = useState(false);
  const [_fichaACResult, setFichaACResult] = useState<PreviewConsulta | null>(null);
  const [showFichaBD, setShowFichaBD] = useState(false);
  const [fichaBDCompleted, setFichaBDCompleted] = useState(false);
  const [_fichaBDResult, setFichaBDResult] = useState<PreviewConsulta | null>(null);
  const [showGtt, setShowGtt] = useState(false);
  const [gttCompleted, setGttCompleted] = useState(false);

  // Editing state for last consultation — tracks which consultation is being edited inline
  const [editingConsultaId, setEditingConsultaId] = useState<string | null>(null);

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

  // History: show all consultations when 2+ exist, most recent first
  const consultasHistorico = useMemo(() => {
    if (consultas.length >= 2) {
      return [...consultas].reverse();
    }
    return [];
  }, [consultas]);

  const _canShowRetorno1 = paciente?.status_ficha === 'aguardando_gj' && !!primeiraConsulta && !showRetorno1 && !retorno1Completed;
  // Only show form while actively filling — not after completion
  const canShowRetorno1Form = showRetorno1 && !!primeiraConsulta;

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
                className="border-[#9b87f5] text-[#9b87f5] hover:bg-[#E8E0FF] gap-1.5 print:hidden"
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

      {/* Standalone green card — only when 1 consultation (aguardando_gj), no retorno form */}
      {consultas.length === 1 && paciente.status_ficha === 'aguardando_gj' && !showRetorno1 && (
        <Consulta1ResultCard janelaGTT={janelaGTT} igMaior24={igMaior24} />
      )}

      {/* Histórico de consultas */}
      {consultasHistorico.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm print:shadow-none">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de consultas
          </h2>

          <Accordion
            type="multiple"
            defaultValue={[consultasHistorico[0]?.id].filter(Boolean)}
            key={`hist-${consultas.length}`}
            className="space-y-2"
          >
            {consultasHistorico.map((c) => {
              // Find chronological index for dynamic numbering
              const chronologicalIndex = consultas.findIndex(cx => cx.id === c.id);
              const displayName = getDisplayName(c, chronologicalIndex, consultas);

              // Calculate IG for display — use stored value or calculate from DUM
              let igDisplay: { semanas: number; dias: number } | null = null;
              if (c.ig_semanas != null) {
                igDisplay = { semanas: c.ig_semanas, dias: c.ig_dias || 0 };
              } else if (paciente?.dum) {
                const diasFromDum = differenceInDays(new Date(c.data), new Date(paciente.dum));
                if (diasFromDum >= 0) {
                  igDisplay = { semanas: Math.floor(diasFromDum / 7), dias: diasFromDum % 7 };
                }
              }

              return (
              <AccordionItem key={c.id} value={c.id} className="rounded-lg border border-border px-3 py-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full flex-col pr-2 gap-1">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-medium text-foreground leading-tight text-left">
                        {displayName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {format(new Date(c.data), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    {igDisplay && (
                      <span className="inline-flex self-start rounded-md bg-[#E8E0FF] px-2 py-0.5 text-[10px] font-medium text-[#7C3AED]">
                        IG: {igDisplay.semanas} semanas e {igDisplay.dias} dias
                      </span>
                    )}
                    {(c.data_inicio && c.data_fim) && (
                      <span className="text-[10px] text-[#64748B] self-start">
                        Período do perfil: {format(new Date(c.data_inicio), 'dd/MM/yyyy')} a {format(new Date(c.data_fim), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  {(() => {
                    const isLastConsulta = c.id === consultasHistorico[0]?.id;
                    const isEditing = editingConsultaId === c.id;
                    const noFormOpen = !showRetorno1 && !showFichaAC && !showFichaBD && !showGtt;
                    const canEdit = isLastConsulta && noFormOpen && c.tipo !== 'consulta_1';

                    // Handle edit save — reload data and close editing
                    const handleEditSaved = () => {
                      setEditingConsultaId(null);
                      if (isPreview && id) {
                        const p = getPreviewPacienteById(id);
                        if (p) {
                          setPaciente(p);
                          setConsultas(p.consultas || []);
                        }
                      }
                    };

                    // If editing this consultation, show the form inline
                    if (isEditing) {
                      if (c.tipo === 'retorno_1') {
                        return (
                          <Retorno1Form
                            paciente={paciente}
                            primeiraConsulta={primeiraConsulta!}
                            isPreview={isPreview}
                            onSaved={handleEditSaved}
                            onCancel={() => setEditingConsultaId(null)}
                            editingConsulta={c}
                          />
                        );
                      }
                      if (c.tipo === 'retorno_gtt') {
                        return (
                          <GttForm
                            paciente={paciente}
                            consultas={consultas}
                            isPreview={isPreview}
                            onSaved={handleEditSaved}
                            onCancel={() => setEditingConsultaId(null)}
                            editingConsulta={c}
                          />
                        );
                      }
                      if (c.tipo === 'ficha_a' || c.tipo === 'ficha_c') {
                        return (
                          <FichaACForm
                            paciente={paciente}
                            consultas={consultas}
                            isPreview={isPreview}
                            onSaved={handleEditSaved}
                            onCancel={() => setEditingConsultaId(null)}
                            editingConsulta={c}
                          />
                        );
                      }
                      if (c.tipo === 'ficha_b' || c.tipo === 'ficha_d') {
                        return (
                          <FichaBDForm
                            paciente={paciente}
                            consultas={consultas}
                            isPreview={isPreview}
                            onSaved={handleEditSaved}
                            onCancel={() => setEditingConsultaId(null)}
                            editingConsulta={c}
                          />
                        );
                      }
                    }

                    // Normal read-only view with edit button
                    return (
                      <>
                        {/* Edit button — only for last consultation */}
                        {canEdit && (
                          <div className="flex justify-end mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingConsultaId(c.id)}
                              className="text-[#9b87f5] hover:text-[#7E69AB] hover:bg-[#E8E0FF] gap-1.5"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="text-xs">Editar valores</span>
                            </Button>
                          </div>
                        )}

                        {c.tipo === 'consulta_1' && (
                          <Consulta1ResultCard janelaGTT={janelaGTT} igMaior24={igMaior24} />
                        )}
                        {c.tipo === 'retorno_1' && (
                          <Retorno1ResultCard consulta={c} janelaGTT={janelaGTT} igHoje={igAtual} />
                        )}
                        {(c.tipo === 'ficha_a' || c.tipo === 'ficha_c') && (
                          <>
                            {c.grid_valores && c.grid_valores.length > 0 && (
                              <FichaACReadOnlyGrid gridValores={c.grid_valores} />
                            )}
                            <FichaACResultCard
                              percentual={c.percentual_meta ?? 0}
                              adequado={(c.percentual_meta ?? 0) >= 70}
                              totalPreenchidos={c.total_preenchidos ?? 0}
                              dentroMeta={c.dentro_meta ?? 0}
                              doseTotal={c.dose_total}
                              doseManha={c.dose_manha}
                              doseNoite={c.dose_noite}
                              peso={c.peso_kg}
                              retornoDias={c.retorno_dias ?? ((c.ig_semanas ?? 0) > 30 ? 7 : 15)}
                              dataProximoRetorno={c.data_proximo_retorno_formatted}
                              fichaType={c.tipo}
                            />
                          </>
                        )}
                        {(c.tipo === 'ficha_b' || c.tipo === 'ficha_d') && (
                          <>
                            {c.grid_valores && c.grid_valores.length > 0 && (
                              <FichaBDReadOnlyGrid gridValores={c.grid_valores} />
                            )}
                            <FichaBDResultCard
                              percentual={c.percentual_meta ?? 0}
                              adequado={(c.percentual_meta ?? 0) >= 70}
                              totalPreenchidos={c.total_preenchidos ?? 0}
                              dentroMeta={c.dentro_meta ?? 0}
                              retornoDias={c.retorno_dias ?? ((c.ig_semanas ?? 0) > 30 ? 7 : 15)}
                              dataProximoRetorno={c.data_proximo_retorno_formatted}
                              fichaType={c.tipo}
                            />
                          </>
                        )}
                        {c.tipo === 'retorno_gtt' && (
                          <GttResultCard consulta={c} igHoje={igAtual} />
                        )}
                        {!['consulta_1', 'retorno_1', 'retorno_gtt', 'ficha_a', 'ficha_c', 'ficha_b', 'ficha_d'].includes(c.tipo) && (
                          <div className="space-y-2">
                            {c.ig_semanas != null && (
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
                          </div>
                        )}
                      </>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* Retorno 1 form — only while actively filling (unmounts after save + popup close) */}
      {canShowRetorno1Form && primeiraConsulta && paciente && (
        <div className="print:hidden">
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
      {/* Ficha A/C form */}
      {showFichaAC && paciente && (
        <div className="print:hidden">
          <FichaACForm
            paciente={paciente}
            consultas={consultas}
            isPreview={isPreview}
            onSaved={() => {
              setShowFichaAC(false);
              // Reload data
              if (isPreview && id) {
                const p = getPreviewPacienteById(id);
                if (p) {
                  setPaciente(p);
                  setConsultas(p.consultas || []);
                  // Find the last ficha_a/ficha_c consultation for standalone result
                  const lastFicha = [...(p.consultas || [])].reverse().find(c => ['ficha_a', 'ficha_c'].includes(c.tipo));
                  if (lastFicha) {
                    setFichaACResult(lastFicha);
                    setFichaACCompleted(true);
                  }
                }
              } else {
                setFichaACCompleted(true);
              }
            }}
            onCancel={() => setShowFichaAC(false)}
          />
        </div>
      )}
      {/* Ficha B/D form */}
      {showFichaBD && paciente && (
        <div className="print:hidden">
          <FichaBDForm
            paciente={paciente}
            consultas={consultas}
            isPreview={isPreview}
            onSaved={() => {
              setShowFichaBD(false);
              if (isPreview && id) {
                const p = getPreviewPacienteById(id);
                if (p) {
                  setPaciente(p);
                  setConsultas(p.consultas || []);
                  const lastFicha = [...(p.consultas || [])].reverse().find(c => ['ficha_b', 'ficha_d'].includes(c.tipo));
                  if (lastFicha) {
                    setFichaBDResult(lastFicha);
                    setFichaBDCompleted(true);
                  }
                }
              } else {
                setFichaBDCompleted(true);
              }
            }}
            onCancel={() => setShowFichaBD(false)}
          />
        </div>
      )}
      {/* GTT form */}
      {showGtt && paciente && (
        <div className="print:hidden">
          <GttForm
            paciente={paciente}
            consultas={consultas}
            isPreview={isPreview}
            onSaved={() => {
              setShowGtt(false);
              setGttCompleted(true);
              if (isPreview && id) {
                const p = getPreviewPacienteById(id);
                if (p) {
                  setPaciente(p);
                  setConsultas(p.consultas || []);
                }
              }
            }}
            onCancel={() => setShowGtt(false)}
          />
        </div>
      )}

      {/* Standalone results removed — results appear only inside history accordion */}

      {/* Next step button — hidden in print */}
      <div className="print:hidden">
        {(() => {
          if (showRetorno1 || showFichaAC || showFichaBD || showGtt) return null;
          if (paciente.status_ficha === 'dmg_afastado' || paciente.status_ficha === 'resultado_parto') return null;

          const nextStep = getNextStepInfo(paciente.status_ficha, consultas, igAtual);
          if (!nextStep) return null;

          const isRetorno1Button = nextStep.formType === 'retorno_1';
          if (isRetorno1Button && retorno1Completed) return null;
          if (isRetorno1Button && canShowRetorno1Form) return null;

          const isGttButton = nextStep.formType === 'retorno_gtt';
          if (isGttButton && gttCompleted) return null;

          const isFichaACButton = nextStep.formType === 'ficha_a' || nextStep.formType === 'ficha_c';
          if (isFichaACButton && fichaACCompleted && paciente.status_ficha === 'encaminhada_endocrino') return null;

          const isFichaBDButton = nextStep.formType === 'ficha_b' || nextStep.formType === 'ficha_d';
          if (isFichaBDButton && fichaBDCompleted && paciente.status_ficha === 'encaminhada_endocrino') return null;

          return (
            <Button
              className="w-full text-left bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
              onClick={() => {
                if (isRetorno1Button) {
                  setShowRetorno1(true);
                } else if (isGttButton) {
                  setShowGtt(true);
                } else if (isFichaACButton) {
                  setFichaACCompleted(false);
                  setFichaACResult(null);
                  setShowFichaAC(true);
                } else if (isFichaBDButton) {
                  setFichaBDCompleted(false);
                  setFichaBDResult(null);
                  setShowFichaBD(true);
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

        {/* Botão secundário — Registro do Parto */}
        {canShowRegistroParto(paciente.status_ficha) && !showRetorno1 && !showFichaAC && !showFichaBD && !showGtt && (
          <Button
            variant="outline"
            className="w-full mt-2 border-[#9b87f5] text-[#9b87f5] hover:bg-[#E8E0FF] hover:text-[#7E69AB]"
            onClick={() => toast('Registro do parto ainda não implementado.')}
          >
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            + Registrar parto
          </Button>
        )}
      </div>
    </div>
  );
}
