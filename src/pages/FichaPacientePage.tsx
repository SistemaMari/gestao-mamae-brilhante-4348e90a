import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
// Realtime intencionalmente removido nesta tela (34B.1 — Fonte 4 do Bug B).
// O componente RealtimeIndicator continua importado: o status fica fixo em 'idle'
// e o indicador deixa de aparecer (RealtimeIndicator esconde o estado idle).
import RealtimeIndicator from '@/components/RealtimeIndicator';
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
  AlertTriangle, Calendar, Clock, FileText, Pencil, Plus, User, Loader2, MessageCircle, ChevronDown,
} from 'lucide-react';
import {
  mascararWhatsappBR,
  validarWhatsappBR,
  paraFormatoCanonico,
  deCanonicoParaInput,
  formatarWhatsappExibicao,
} from '@/lib/whatsapp';
import Retorno1Form from '@/components/Retorno1Form';
import Consulta1ResultCard from '@/components/Consulta1ResultCard';
import CarimboAtendimento from '@/components/clinico/CarimboAtendimento';
import Retorno1ResultCard from '@/components/Retorno1ResultCard';
import GttForm from '@/components/GttForm';
import GttResultCard from '@/components/GttResultCard';
import FichaACForm from '@/components/FichaACForm';
import FichaACResultCard from '@/components/FichaACResultCard';
import FichaACReadOnlyGrid from '@/components/FichaACReadOnlyGrid';
import FichaBDForm from '@/components/FichaBDForm';
import FichaBDResultCard from '@/components/FichaBDResultCard';
import FichaBDReadOnlyGrid from '@/components/FichaBDReadOnlyGrid';

import RegistroPartoForm from '@/components/RegistroPartoForm';
import RegistroPartoReadOnlyCard from '@/components/RegistroPartoReadOnlyCard';
import UsgManagerCard from '@/components/UsgManagerCard';
import { calcIdadeGestacionalStruct, type UsgRefInput } from '@/lib/fichaUtils';
import LaudoCompleto from '@/components/laudo/LaudoCompleto';
import { mapearCenario } from '@/lib/laudoMapping';
import { useLaudoIA } from '@/hooks/useLaudoIA';
import { useAutoriaFicha } from '@/hooks/useAutoriaFicha';
import AutoriaRodape from '@/components/clinico/AutoriaRodape';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { differenceInYears, differenceInDays, addDays, format } from 'date-fns';
import { parseDateLocal, formatDateBR } from '@/lib/dateUtils';

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
  // Registro do parto NÃO é numerado como RETORNO N — é evento final
  if (c.tipo === 'registro_parto') {
    return 'REGISTRO DO PARTO';
  }
  const prefix = index === 0 ? 'CASO NOVO' : `RETORNO ${index}`;

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
  const isReadOnly =
    location.pathname.startsWith('/gestao/fichas/') ||
    location.pathname.startsWith('/vitrine/gestao/fichas/');
  const fichasBackPath = location.pathname.startsWith('/vitrine')
    ? '/vitrine/gestao/fichas'
    : '/gestao/fichas';
  useAuth();
  useProfissionalData();

  const [paciente, setPaciente] = useState<PreviewPaciente | null>(null);
  const [consultas, setConsultas] = useState<PreviewConsulta[]>([]);
  const [usgs, setUsgs] = useState<UsgRefInput[]>([]);
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
  const [showRegistroParto, setShowRegistroParto] = useState(false);

  // Editing state for last consultation — tracks which consultation is being edited inline
  const [editingConsultaId, setEditingConsultaId] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editNumeroId, setEditNumeroId] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState(''); // mascarado, sem DDI
  const [editDmgAnterior, setEditDmgAnterior] = useState<boolean>(false);
  const [editDataConsulta, setEditDataConsulta] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editDum, setEditDum] = useState(''); // DUM editável (yyyy-MM-dd ou vazio)

  const fetchPaciente = useCallback(async () => {
    if (!id || isPreview) return;

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

      const consultaIds = (cons ?? []).map((c: any) => c.id);
      const { data: exames } = consultaIds.length
        ? await supabase
            .from('exames_glicemia')
            .select('consulta_id, valor_mgdl, tipo_exame, data_exame')
            .in('consulta_id', consultaIds)
        : { data: [] as any[] };

      // 33B: carrega USGs do paciente para resolver a referência ativa em runtime.
      const { data: usgsData } = await supabase
        .from('exames_usg' as any)
        .select('id, data_exame, ig_semanas, ig_dias, ordem')
        .eq('paciente_id', id)
        .order('ordem', { ascending: true });
      setUsgs((usgsData ?? []) as unknown as UsgRefInput[]);

      const exameByConsulta = new Map<string, any>(
        (exames ?? []).map((e: any) => [e.consulta_id, e]),
      );

      setConsultas(
        (cons || []).map((c: any) => {
          const ex = exameByConsulta.get(c.id);
          return {
            id: c.id,
            tipo: c.tipo,
            numero_sequencial: c.numero_sequencial,
            data: c.data,
            ig_semanas: c.ig_semanas,
            ig_dias: c.ig_dias,
            observacoes: c.observacoes,
            status_gerado: c.status_gerado,
            status_ficha: c.status_ficha ?? null,
            ...(c.tipo === 'retorno_1' && ex
              ? {
                  retorno1_valor_gj: ex.valor_mgdl ?? null,
                  retorno1_tipo_exame: ex.tipo_exame ?? null,
                  retorno1_data_exame: ex.data_exame ?? null,
                }
              : {}),
          };
        })
      );
    }
    setLoading(false);
  }, [id, isPreview]);

  useEffect(() => {
    if (!id) return;

    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
        // 33B: preview não popula exames_usg — listagem dinâmica fica vazia,
        // o cálculo de IG cai pro snapshot/DUM (comportamento legado).
        setUsgs([]);
      }
      setLoading(false);
      return;
    }

    fetchPaciente();
  }, [id, isPreview, fetchPaciente]);

  // Realtime DESLIGADO nesta tela (Fonte 4, 34B.1).
  //
  // Antes: subscription em pacientes/consultas/exames/perfis/laudos chamava
  // fetchPaciente a cada evento. Ao voltar foco de aba, o WS reconectava e
  // entregava bursts de eventos catch-up — cada um disparava re-render que
  // sobrescrevia state local dos forms (Bug B).
  //
  // Aqui o usuário está digitando dados clínicos. Frescor automático não compensa
  // o risco de perda. Refresh acontece via:
  //   1. Após salvar (fetchPaciente é chamado pelos callbacks onSaved dos forms)
  //   2. Botão "atualizar" (TODO 34B.2) — quando o usuário decide pedir refresh manual
  //
  // Listagens (Dashboard, HistoricoLaudos) seguem usando Realtime normalmente.
  // Indicador "Ao vivo" fica fixo em 'idle' nesta tela (não renderiza nada).
  const rtStatus: 'idle' | 'connecting' | 'live' | 'error' = 'idle';

  const idade = useMemo(() => {
    if (!paciente?.data_nascimento) return null;
    const nasc = parseDateLocal(paciente.data_nascimento);
    return nasc ? differenceInYears(new Date(), nasc) : null;
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

  // === IA: Blocos 2 e 3 (Justificativa + Conduta) ===
  const laudoIA = useLaudoIA({ isPreview });
  const autoriaFicha = useAutoriaFicha(paciente?.id);

  // Reset estado IA ao trocar de paciente
  useEffect(() => {
    laudoIA.resetar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Carrega laudos persistidos para as consultas existentes (real mode)
  useEffect(() => {
    if (isPreview || !id || consultas.length === 0) return;
    const consultaIds = consultas.map((c) => c.id);
    void laudoIA.carregarLaudosExistentes(id, consultaIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isPreview, consultas]);

  // Auto-trigger geração para cenários elegíveis sem laudo ainda.
  // Ficha A/C inadequado (cenário 3) só dispara após confirmação do peso.
  //
  // 34B.2 (critério 15): adicionado gate por status_ficha. O sistema não tem
  // botão "Gerar laudo" clicável — o laudo é gerado automaticamente após salvar.
  // Para honrar a regra "só gera quando status_ficha=completa", a geração só
  // dispara para consultas com status_ficha === 'completa' ou 'laudo_gerado'.
  // Fichas legadas sem status_ficha populado (null/undefined) seguem o
  // comportamento anterior — assume-se que estão completas (backfill 34A).
  useEffect(() => {
    if (!paciente?.id) return;
    for (const c of consultas) {
      const sf = c.status_ficha;
      const aceitavel = sf == null || sf === 'completa' || sf === 'laudo_gerado';
      if (!aceitavel) continue; // rascunho/finalizada → não dispara

      const cenario = mapearCenario({
        tipo: c.tipo,
        status_gerado: c.status_gerado,
        decisao: (c as any).decisao,
        percentual_meta: (c as any).percentual_meta,
      });
      const isInadequadoAC =
        (c.tipo === 'ficha_a' || c.tipo === 'ficha_c') && ((c as any).percentual_meta ?? 0) < 70;
      if (isInadequadoAC) {
        const peso = (c as any).peso_kg;
        if (peso == null || peso <= 0) continue; // aguarda confirmação de peso
      }
      laudoIA.garantirLaudo(paciente.id, c.id, cenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id, consultas]);

  const _canShowRetorno1 = paciente?.status_ficha === 'aguardando_gj' && !!primeiraConsulta && !showRetorno1 && !retorno1Completed;
  // Only show form while actively filling — not after completion
  const canShowRetorno1Form = showRetorno1 && !!primeiraConsulta;

  // P3: Reload patient data without hiding the retorno form.
  //
  // 34B.1 follow-up: antes do 34B.1, o useRealtimeRefresh disparava fetchPaciente
  // automaticamente quando o banco mudava, mascarando o fato de que reloadPaciente
  // em modo real só mexia em flags de UI. Com Realtime desligado nesta tela
  // (Fonte 4 do Bug B), o refetch precisa ser explícito.
  const reloadPaciente = () => {
    if (!id) return;
    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
      }
    } else {
      void fetchPaciente();
    }
    setRetorno1Completed(true);
    setShowRetorno1(false);
  };

  // IG calculated from DUM
  const igNaConsulta1 = useMemo(() => {
    if (!paciente?.dum || !primeiraConsulta) return null;
    const consulta = parseDateLocal(primeiraConsulta.data);
    const dum = parseDateLocal(paciente.dum);
    if (!consulta || !dum) return null;
    const dias = differenceInDays(consulta, dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente?.dum, primeiraConsulta]);

  // 33B: respeita referência de IG ativa (DUM ou USG selecionada por referencia_usg_id).
  // Fallback silencioso: referencia_ig='usg' + referencia_usg_id=NULL → USG ordem=1.
  const igAtual = useMemo(() => {
    if (!paciente) return null;
    return calcIdadeGestacionalStruct({
      dum: paciente.dum,
      usg_data: paciente.usg_data,
      usg_ig_semanas: paciente.usg_ig_semanas,
      usg_ig_dias: paciente.usg_ig_dias,
      referencia_ig: paciente.referencia_ig ?? null,
      referencia_usg_id: paciente.referencia_usg_id ?? null,
      usgs,
    });
  }, [paciente, usgs]);

  const dumDate = useMemo(() => {
    if (!paciente?.dum) return null;
    return parseDateLocal(paciente.dum);
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
    setEditWhatsapp(deCanonicoParaInput((paciente as any).whatsapp));
    setEditDmgAnterior(!!paciente.dmg_gestacao_anterior);
    setEditDataConsulta(primeiraConsulta.data);
    setEditObservacoes(primeiraConsulta.observacoes || '');
    setEditDum(paciente.dum ?? ''); // pode ficar vazio quando DUM é desconhecida
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = async () => {
    if (!paciente || !primeiraConsulta || !id) return;

    const whatsappValid = validarWhatsappBR(editWhatsapp);
    if (!whatsappValid.ok) {
      toast.error(whatsappValid.mensagem || 'WhatsApp inválido.');
      return;
    }
    const whatsappCanonico = paraFormatoCanonico(editWhatsapp);

    setEditSaving(true);

    // DUM editável: vazio = manter "não sei" (null), valor = atualizar.
    const dumNormalizado: string | null = editDum && editDum.length > 0 ? editDum : null;

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
        dum: dumNormalizado,
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
        whatsapp: whatsappCanonico,
        dmg_gestacao_anterior: editDmgAnterior,
        dum: dumNormalizado,
      } as any)
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

    const { carimbarAtendimento } = await import('@/lib/carimbar');
    await carimbarAtendimento({
      pacienteId: id!,
      tipoOperacao: 'editar_dados_paciente',
      recursoTipo: 'paciente',
    });

    setPaciente((prev) =>
      prev
        ? {
            ...prev,
            nome: editNome.trim(),
            data_nascimento: editDataNascimento,
            numero_identificacao: editNumeroId.trim() || null,
            whatsapp: whatsappCanonico,
            dmg_gestacao_anterior: editDmgAnterior,
            dum: dumNormalizado,
          } as any
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
    const nasc = parseDateLocal(editDataNascimento);
    return nasc ? differenceInYears(new Date(), nasc) : null;
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

  // 34C.2 (§3.4): sinal de "ficha aberta em edição" — usado para colapsar o
  // histórico por padrão. Nesta tela não há status_ficha de rascunho; o estado
  // real de edição é dado pelos flags de formulário ativo / consulta em edição.
  const hasFichaEmEdicao =
    showRetorno1 || showFichaAC || showFichaBD || showGtt || showRegistroParto || editingConsultaId !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isReadOnly && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2 print:hidden">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => navigate(fichasBackPath)}
              className="text-[#7C4DBA] hover:underline font-medium"
            >
              Fichas da unidade
            </button>
            <span className="text-muted-foreground">›</span>
            <span className="text-foreground font-medium truncate">{paciente.nome}</span>
          </div>
          <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20 shrink-0">
            Modo visualização
          </Badge>
        </div>
      )}

      {/* Banner "Atendendo como" — apenas para institucional/gestor/gestor geral */}
      {!isPreview && paciente?.id && (
        <CarimboAtendimento
          variant="banner"
          unidadeContextoId={(paciente as any).unidade_id ?? null}
        />
      )}

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
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
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
            {!isPreview && <RealtimeIndicator status={rtStatus} className="mr-1" />}
            {status && (
              <Badge className={`${status.color} text-white border-0 shrink-0`}>
                {status.label}
              </Badge>
            )}
            {!editing && !isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                className="border-[#7C4DBA] text-[#7C4DBA] hover:bg-[#E8E0FF] gap-1.5 print:hidden"
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
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-foreground">WhatsApp (opcional)</label>
                <div className="flex items-stretch gap-2">
                  <span className="flex shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                    +55
                  </span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(mascararWhatsappBR(e.target.value))}
                    placeholder="(11) 91234-5678"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Data da caso novo</label>
                <Input
                  type="date"
                  value={editDataConsulta}
                  onChange={(e) => setEditDataConsulta(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  DUM (Data da última menstruação)
                </label>
                <Input
                  type="date"
                  value={editDum}
                  onChange={(e) => setEditDum(e.target.value)}
                  placeholder="Deixe em branco se desconhecida"
                />
                <p className="text-[10px] text-muted-foreground">
                  Atualizar a DUM recalcula automaticamente as IGs e o card de Referência de IG.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">DMG em gestação anterior</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDmgAnterior(true)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                      editDmgAnterior
                        ? 'border-[#7C4DBA] bg-[#7C4DBA]/10 text-[#7C4DBA]'
                        : 'border-border bg-card text-muted-foreground hover:border-[#7C4DBA]/60'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDmgAnterior(false)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                      !editDmgAnterior
                        ? 'border-[#7C4DBA] bg-[#7C4DBA]/10 text-[#7C4DBA]'
                        : 'border-border bg-card text-muted-foreground hover:border-[#7C4DBA]/60'
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
                className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
              >
                {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 34C.1 (3.2.1): campos clínicos primários — sempre visíveis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">DUM:</span>{' '}
                  {paciente.dum ? formatDateBR(paciente.dum) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Data da caso novo:</span>{' '}
                  {primeiraConsulta ? formatDateBR(primeiraConsulta.data) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">IG no caso novo:</span>{' '}
                  {igNaConsulta1
                    ? `${igNaConsulta1.semanas}s ${igNaConsulta1.dias}d`
                    : '—'}
                </span>
              </div>
            </div>

            {/* 34C.1 (3.2.2): dados administrativos em accordion colapsado por padrão.
                Estado de expansão NÃO é persistido — remonta colapsado a cada visita. */}
            <Accordion type="single" collapsible className="border-t border-border">
              <AccordionItem value="dados-identificacao" className="border-none">
                <AccordionTrigger className="py-2 text-xs font-medium text-foreground hover:no-underline">
                  Dados de identificação
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">Nascimento:</span>{' '}
                        {paciente.data_nascimento ? formatDateBR(paciente.data_nascimento) : '—'}
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
                      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">WhatsApp:</span>{' '}
                        {(paciente as any).whatsapp
                          ? `+55 ${deCanonicoParaInput((paciente as any).whatsapp)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {primeiraConsulta?.observacoes && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground mb-1">Observações clínicas:</p>
                <p className="text-sm text-muted-foreground italic">{primeiraConsulta.observacoes}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bloco 3 + 4 + 33B: gestor de USGs e referência de IG (qualquer USG selecionável) */}
      {!isReadOnly && paciente && (
        <UsgManagerCard
          pacienteId={paciente.id}
          dum={paciente.dum}
          referenciaIg={paciente.referencia_ig ?? null}
          referenciaUsgId={paciente.referencia_usg_id ?? null}
          isPreview={isPreview}
          onChanged={fetchPaciente}
        />
      )}

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
          <div className="rounded-xl border-2 border-[#7C4DBA] bg-[#E8E0FF] p-4 flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[#7C4DBA]" />
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
      {consultas.length === 1 && paciente.status_ficha === 'aguardando_gj' && !showRetorno1 && primeiraConsulta && (() => {
        const cenarioStandalone = mapearCenario({ tipo: 'consulta_1', status_gerado: paciente.status_ficha });
        const estadoStandalone = laudoIA.getEstado(primeiraConsulta.id);
        const autoriaC1 = autoriaFicha.getAutoria({
          recursoId: primeiraConsulta.id,
          tipoOperacao: 'consulta_inicial',
        });
        const autoriaLaudoStandalone = autoriaFicha.getAutoria({
          recursoId: estadoStandalone.laudoId ?? null,
          tipoOperacao: 'gerar_laudo',
        });
        return (
        <LaudoCompleto
          paciente={{ nome: paciente.nome }}
          igSemanas={igNaConsulta1?.semanas ?? 0}
          igDias={igNaConsulta1?.dias ?? 0}
          dataLaudo={parseDateLocal(primeiraConsulta.data) ?? new Date()}
          cenario={cenarioStandalone}
          bloco2={estadoStandalone.bloco2}
          bloco3={estadoStandalone.bloco3}
          statusIA={estadoStandalone.statusIA}
          erroIA={estadoStandalone.erroIA}
          onTentarNovamente={() => laudoIA.tentarNovamente(paciente.id, primeiraConsulta.id, cenarioStandalone)}
          proximaFichaTexto={janelaGTT ? `GTT 75g entre ${format(janelaGTT.inicio, 'dd/MM/yyyy')} e ${format(janelaGTT.fim, 'dd/MM/yyyy')}.` : null}
        >
          <Consulta1ResultCard janelaGTT={janelaGTT} igMaior24={igMaior24} />
          <AutoriaRodape registro={autoriaC1} label="Atendimento registrado por" />
          {estadoStandalone.statusIA === 'pronto' && (
            <AutoriaRodape registro={autoriaLaudoStandalone} label="Laudo gerado por" />
          )}
        </LaudoCompleto>
        );
      })()}


      {/* Ficha aberta no momento (34C.2 §3.3, ordem #5): renderizada ANTES do
          histórico para manter a ficha em edição acima da dobra. O Contexto
          Clínico (ordem #4) é renderizado dentro de cada form. */}
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
                // 34B.1 follow-up: refetch explícito (Realtime desligado nesta tela)
                void fetchPaciente();
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
                // 34B.1 follow-up: refetch explícito (Realtime desligado nesta tela)
                void fetchPaciente();
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
              } else {
                // 34B.1 follow-up: refetch explícito (Realtime desligado nesta tela)
                void fetchPaciente();
              }
            }}
            onCancel={() => setShowGtt(false)}
          />
        </div>
      )}

      {/* Registro do parto form */}
      {showRegistroParto && paciente && (
        <div className="print:hidden">
          <RegistroPartoForm
            paciente={paciente}
            consultas={consultas}
            isPreview={isPreview}
            onSaved={() => {
              setShowRegistroParto(false);
              if (isPreview && id) {
                const p = getPreviewPacienteById(id);
                if (p) {
                  setPaciente(p);
                  setConsultas(p.consultas || []);
                }
              } else {
                // 34B.1 follow-up: refetch explícito (Realtime desligado nesta tela)
                void fetchPaciente();
              }
            }}
            onCancel={() => setShowRegistroParto(false)}
          />
        </div>
      )}

      {/* Histórico de consultas (34C.2 §3.3 ordem #6 + §3.4 colapso por padrão) */}
      {consultasHistorico.length > 0 && (
        <Collapsible
          defaultOpen={!hasFichaEmEdicao}
          key={`hist-collapse-${hasFichaEmEdicao}`}
          className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm print:shadow-none"
        >
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#7C4DBA]" />
              Histórico de consultas ({consultasHistorico.length})
            </h2>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
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
                const cData = parseDateLocal(c.data);
                const cDum = parseDateLocal(paciente.dum);
                const diasFromDum = (cData && cDum) ? differenceInDays(cData, cDum) : -1;
                if (diasFromDum >= 0) {
                  igDisplay = { semanas: Math.floor(diasFromDum / 7), dias: diasFromDum % 7 };
                }
              }

              return (
              <AccordionItem
                key={c.id}
                value={c.id}
                className={`rounded-lg border border-border px-3 py-0 ${
                  c.tipo === 'consulta_1' ? 'border-l-4 border-l-[#7C4DBA]' : ''
                }`}
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full flex-col pr-2 gap-1">
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-medium text-foreground leading-tight text-left">
                        {displayName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatDateBR(c.data)}
                      </span>
                    </div>
                    {igDisplay && (
                      <span className="inline-flex self-start rounded-md bg-[#E8E0FF] px-2 py-0.5 text-[10px] font-medium text-[#7C3AED]">
                        IG: {igDisplay.semanas}s {igDisplay.dias}d
                      </span>
                    )}
                    {(c.data_inicio && c.data_fim) && (
                      <span className="text-[10px] text-[#64748B] self-start">
                        Período do perfil: {formatDateBR(c.data_inicio)} a {formatDateBR(c.data_fim)}
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
                      } else {
                        // 34B.1 follow-up: refetch explícito (Realtime desligado nesta tela)
                        void fetchPaciente();
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
                    const igLaudo = igDisplay ?? igAtual ?? { semanas: 0, dias: 0 };
                    const dataLaudo = parseDateLocal(c.data) ?? new Date();
                    const cenario = mapearCenario({
                      tipo: c.tipo,
                      status_gerado: c.status_gerado,
                      decisao: c.decisao,
                      percentual_meta: c.percentual_meta,
                    });

                    const renderCardBloco1 = () => {
                      if (c.tipo === 'consulta_1') {
                        return <Consulta1ResultCard janelaGTT={janelaGTT} igMaior24={igMaior24} />;
                      }
                      if (c.tipo === 'retorno_1') {
                        return <Retorno1ResultCard consulta={c} janelaGTT={janelaGTT} igHoje={igAtual} />;
                      }
                      if (c.tipo === 'ficha_a' || c.tipo === 'ficha_c') {
                        return (
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
                              pacienteId={paciente.id}
                              consultaId={c.id}
                              isPreview={isPreview}
                              isReadOnly={isReadOnly}
                              onWeightSaved={() => {
                                if (isPreview) {
                                  const p = getPreviewPacienteById(paciente.id);
                                  if (p) {
                                    setPaciente(p);
                                    setConsultas(p.consultas || []);
                                  }
                                }
                                // Dispara geração da IA agora que o peso/dose foram confirmados
                                const cenarioPeso = mapearCenario({
                                  tipo: c.tipo,
                                  status_gerado: c.status_gerado,
                                  decisao: (c as any).decisao,
                                  percentual_meta: (c as any).percentual_meta,
                                });
                                laudoIA.tentarNovamente(paciente.id, c.id, cenarioPeso);
                              }}
                            />
                          </>
                        );
                      }
                      if (c.tipo === 'ficha_b' || c.tipo === 'ficha_d') {
                        return (
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
                        );
                      }
                      if (c.tipo === 'retorno_gtt') {
                        return <GttResultCard consulta={c} igHoje={igAtual} />;
                      }
                      if (c.tipo === 'registro_parto') {
                        return <RegistroPartoReadOnlyCard consulta={c} />;
                      }
                      return (
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
                      );
                    };

                    return (
                      <>
                        {/* Edit button — only for last consultation */}
                        {canEdit && !isReadOnly && (
                          <div className="no-print flex justify-end mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingConsultaId(c.id)}
                              className="text-[#7C4DBA] hover:text-[#7E69AB] hover:bg-[#E8E0FF] gap-1.5"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="text-xs">Editar valores</span>
                            </Button>
                          </div>
                        )}

                        {(() => {
                          const estadoC = laudoIA.getEstado(c.id);
                          const tipoOpConsulta =
                            c.tipo === 'consulta_1' ? 'consulta_inicial'
                            : c.tipo === 'retorno_1' ? 'retorno'
                            : c.tipo === 'retorno_gtt' ? 'preencher_gtt'
                            : (c.tipo === 'ficha_a' || c.tipo === 'ficha_c') ? 'preencher_ficha_ac'
                            : (c.tipo === 'ficha_b' || c.tipo === 'ficha_d') ? 'preencher_ficha_bd'
                            : c.tipo === 'registro_parto' ? 'registrar_parto'
                            : null;
                          const autoriaConsulta = autoriaFicha.getAutoria({
                            recursoId: c.id,
                            tipoOperacao: tipoOpConsulta,
                          });
                          const autoriaLaudo = autoriaFicha.getAutoria({
                            recursoId: estadoC.laudoId ?? null,
                            tipoOperacao: 'gerar_laudo',
                          });
                          return (
                            <LaudoCompleto
                              paciente={{ nome: paciente.nome }}
                              igSemanas={igLaudo.semanas}
                              igDias={igLaudo.dias}
                              dataLaudo={dataLaudo}
                              cenario={cenario}
                              bloco2={estadoC.bloco2}
                              bloco3={estadoC.bloco3}
                              statusIA={estadoC.statusIA}
                              erroIA={estadoC.erroIA}
                              onTentarNovamente={() => laudoIA.tentarNovamente(paciente.id, c.id, cenario)}
                              janelaGTT={c.tipo === 'retorno_1' ? janelaGTT : null}
                              igMaior24={igMaior24}
                            >
                              {renderCardBloco1()}
                              <AutoriaRodape registro={autoriaConsulta} label="Atendimento registrado por" />
                              {estadoC.statusIA === 'pronto' && (
                                <AutoriaRodape registro={autoriaLaudo} label="Laudo gerado por" />
                              )}
                            </LaudoCompleto>
                          );
                        })()}
                      </>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
              );
            })}
          </Accordion>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Standalone results removed — results appear only inside history accordion */}
      {/* Cenário 5 (encerramento) renderizado somente dentro da ficha expansível do histórico */}

      {/* Next step button — hidden in print and read-only */}
      <div className="print:hidden">
        {!isReadOnly && (() => {
          if (showRetorno1 || showFichaAC || showFichaBD || showGtt || showRegistroParto) return null;
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
              className="w-full text-left bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
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
        {!isReadOnly && canShowRegistroParto(paciente.status_ficha) && !showRetorno1 && !showFichaAC && !showFichaBD && !showGtt && !showRegistroParto && (
          <Button
            variant="outline"
            className="w-full mt-2 border-[#7C4DBA] text-[#7C4DBA] hover:bg-[#E8E0FF] hover:text-[#7E69AB]"
            onClick={() => setShowRegistroParto(true)}
          >
            <FileText className="mr-2 h-4 w-4 shrink-0" />
            + Registrar parto
          </Button>
        )}

        {paciente?.id && (
          <div className="mt-6">
            <CarimboAtendimento variant="lista" pacienteId={paciente.id} />
          </div>
        )}
      </div>
    </div>
  );
}
