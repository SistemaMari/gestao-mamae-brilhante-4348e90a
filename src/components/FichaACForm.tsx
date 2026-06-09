import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';
import { useIg } from '@/lib/getIg';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
import StatusFichaBadge from '@/components/ficha/StatusFichaBadge';
import CamposPendentesBanner from '@/components/ficha/CamposPendentesBanner';
import DateInput from '@/components/ficha/DateInput';
import ContextoClinicoCard from '@/components/ficha/ContextoClinicoCard';
import { useContextoCasoNovo } from '@/hooks/useContextoCasoNovo';
import {
  updatePreviewPaciente,
  type PreviewPaciente,
  type PreviewConsulta,
} from '@/lib/previewPatients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import PactuacaoPosPrandialModal from '@/components/ficha/PactuacaoPosPrandialModal';
import {
  type JanelaPosPrandial, metaPosPrandial, prefixoHora,
  rotuloPosPrandial, tooltipPosPrandial, normalizarJanela,
} from '@/lib/posPrandial';
import {
  Info, Loader2, FileText, AlertTriangle,
} from 'lucide-react';
import ChecklistRetorno2, { CHECKLIST_VAZIO, isChecklistCompleto, type ChecklistState } from '@/components/ficha/ChecklistRetorno2';
import CondutaCard from '@/components/ficha/CondutaCard';
import { aplicarRegrasFichaA, type DecisaoResultado } from '@/lib/fichaADecisao';

const POINTS = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
type Point = typeof POINTS[number];

// Jejum permanece estático — 35B só torna dinâmicos os pontos pós-prandiais (janela 1h/2h).
const LABEL_JEJUM = 'Jejum';
const META_JEJUM = 95;
const TOOLTIP_JEJUM = 'Coleta antes de qualquer refeição, após pelo menos 8 horas sem comer. Meta: < 95 mg/dL. Usar glicômetro capilar para acompanhamento — diferente do diagnóstico, onde é obrigatório plasma venoso. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.';

const REFEICAO_POS: Record<Exclude<Point, 'jejum'>, 'café' | 'almoço' | 'jantar'> = {
  pos_cafe: 'café',
  pos_almoco: 'almoço',
  pos_jantar: 'jantar',
};

function pointLabel(point: Point, janela: JanelaPosPrandial): string {
  return point === 'jejum' ? LABEL_JEJUM : rotuloPosPrandial(REFEICAO_POS[point], janela);
}

function pointMeta(point: Point, janela: JanelaPosPrandial): number {
  return point === 'jejum' ? META_JEJUM : metaPosPrandial(janela);
}

function pointTooltip(point: Point, janela: JanelaPosPrandial): string {
  return point === 'jejum' ? TOOLTIP_JEJUM : tooltipPosPrandial(janela);
}

function isHypoglycemia(value: number): boolean {
  return value > 0 && value < 70;
}

const DAYS = Array.from({ length: 15 }, (_, i) => i + 1);

interface FichaACFormProps {
  paciente: PreviewPaciente;
  consultas: PreviewConsulta[];
  isPreview: boolean;
  onSaved: () => void;
  onCancel: () => void;
  editingConsulta?: PreviewConsulta | null;
}

export default function FichaACForm({
  paciente, consultas, isPreview, onSaved, onCancel, editingConsulta,
}: FichaACFormProps) {
  const { profissionalData } = useProfissionalData();

  // 35B — Pactuação pós-prandial (1h/2h). Em edição, carrega a janela já gravada (loader
  // traz tipo_pos_prandial do banco); ficha antiga sem o campo cai em '1h'. Em ficha nova,
  // `pactuada` começa false → o corpo só renderiza após o modal de pactuação (sem flash de grade).
  const [janela, setJanela] = useState<JanelaPosPrandial>(
    () => normalizarJanela(editingConsulta?.tipo_pos_prandial),
  );
  const [pactuada, setPactuada] = useState<boolean>(() => !!editingConsulta);

  // Grid state: grid[day-1][point] = string value
  const [grid, setGrid] = useState<Record<string, string>[]>(() => {
    if (editingConsulta?.grid_valores && editingConsulta.grid_valores.length > 0) {
      // Pad to 15 days if needed
      const existing = editingConsulta.grid_valores.map(row => ({ ...row }));
      while (existing.length < 15) existing.push(Object.fromEntries(POINTS.map(p => [p, ''])));
      return existing;
    }
    return DAYS.map(() => Object.fromEntries(POINTS.map(p => [p, ''])));
  });

  // Form fields
  const [dataInicio, setDataInicio] = useState(editingConsulta?.data_inicio ?? '');
  const [dataFim, setDataFim] = useState(editingConsulta?.data_fim ?? '');
  const [dataConsulta, setDataConsulta] = useState(editingConsulta?.data ?? todayLocalISO());
  const [observacoes, setObservacoes] = useState(editingConsulta?.observacoes ?? '');
  const [saving, setSaving] = useState(false);

  // 34C-B2: IG vem da fonte única (RPC calcular_ig) na data da consulta.
  // Respeita a âncora vigente da paciente (DUM ou USG de referência) — nada
  // de DUM-diff ad-hoc. Quando a paciente não tem âncora, igAtual = null e
  // os campos ig_semanas/ig_dias ficam vazios (o backend pode bloquear via 34C-A).
  const igAtualQuery = useIg(paciente.id, dataConsulta);
  const igAtual = igAtualQuery.data ?? null;

  const [igSemanas, setIgSemanas] = useState(editingConsulta?.ig_semanas != null ? String(editingConsulta.ig_semanas) : '');
  const [igDias, setIgDias] = useState(editingConsulta?.ig_dias != null ? String(editingConsulta.ig_dias) : '');

  useEffect(() => {
    if (igAtual && !editingConsulta) {
      setIgSemanas(String(igAtual.semanas));
      setIgDias(String(igAtual.dias));
    }
  }, [igAtual, editingConsulta]);

  const igSemNum = parseInt(igSemanas) || 0;

  // Determine if this is the first Ficha A (no prior ficha_a/ficha_c consultations)
  const isFirstFichaA = !consultas.some(c => ['ficha_a', 'ficha_c'].includes(c.tipo));

  // Dynamic message about how many days to fill
  const dayMessage = useMemo(() => {
    if (isFirstFichaA) return 'Preencha de 7 a 10 dias de medições.';
    if (igSemNum > 30) return 'Preencha até 7 dias de medições.';
    return 'Preencha até 15 dias de medições.';
  }, [isFirstFichaA, igSemNum]);

  // Cell refs for navigation
  const cellRefs = useRef<(HTMLInputElement | null)[][]>(
    DAYS.map(() => Array(POINTS.length).fill(null))
  );

  const setCellRef = useCallback((day: number, col: number, el: HTMLInputElement | null) => {
    if (!cellRefs.current[day]) cellRefs.current[day] = Array(POINTS.length).fill(null);
    cellRefs.current[day][col] = el;
  }, []);

  // Compute control percentage in real time
  const { totalPreenchidos, dentroMeta, percentual } = useMemo(() => {
    let total = 0;
    let ok = 0;
    for (const row of grid) {
      for (const p of POINTS) {
        const val = parseInt(row[p]);
        if (!val || val <= 0) continue; // empty or 0 = skip
        total++;
        // Hipoglicemia (< 70) sempre conta como fora da meta, em qualquer ponto
        if (isHypoglycemia(val)) continue;
        if (val < pointMeta(p, janela)) ok++;
      }
    }
    return {
      totalPreenchidos: total,
      dentroMeta: ok,
      percentual: total > 0 ? Math.round((ok / total) * 1000) / 10 : null,
    };
  }, [grid, janela]);

  // Hypoglycemia alerts — qualquer valor < 70 em qualquer ponto
  const hypoAlerts = useMemo(() => {
    const alerts: { day: number; point: string; value: number }[] = [];
    grid.forEach((row, dayIdx) => {
      for (const p of POINTS) {
        const val = parseInt(row[p]);
        if (!isNaN(val) && isHypoglycemia(val)) {
          alerts.push({ day: dayIdx + 1, point: pointLabel(p, janela), value: val });
        }
      }
    });
    return alerts;
  }, [grid, janela]);

  const isAdequado = percentual !== null && percentual >= 70;
  const isInadequado = percentual !== null && percentual < 70;

  // Insulin dose calculation moved to laudo (FichaACResultCard) — captured AFTER doctor sees Bloco 1.

  // Next return interval
  const retornoDias = igSemNum > 30 ? 7 : 15;
  const dataConsultaLocal = parseDateLocal(dataConsulta);
  const dataProximoRetorno = dataConsultaLocal
    ? format(addDays(dataConsultaLocal, retornoDias), 'dd/MM/yyyy')
    : null;

  // Impact popup
  const [showImpact, setShowImpact] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    percentual: number;
    adequado: boolean;
  } | null>(null);

  // Cell value change
  const handleCellChange = (dayIdx: number, point: Point, value: string) => {
    // Only allow digits
    const cleaned = value.replace(/[^0-9]/g, '');
    setGrid(prev => {
      const next = [...prev];
      next[dayIdx] = { ...next[dayIdx], [point]: cleaned };
      return next;
    });
  };

  // Get cell color based on value
  const getCellBg = (point: Point, value: string) => {
    const num = parseInt(value);
    if (!num || num <= 0) return '';
    if (num < 0) return 'bg-red-100 border-red-300';
    if (isHypoglycemia(num)) return 'bg-[#FEE2E2] border-red-400'; // hypoglycemia
    if (num >= pointMeta(point, janela)) return 'bg-[#FEE2E2]'; // above target
    return 'bg-[#DCFCE7]'; // within target
  };

  // Keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    dayIdx: number,
    colIdx: number
  ) => {
    let nextDay = dayIdx;
    let nextCol = colIdx;

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      nextCol++;
      if (nextCol >= POINTS.length) {
        nextCol = 0;
        nextDay++;
      }
    } else if (e.key === 'ArrowRight') {
      nextCol = Math.min(colIdx + 1, POINTS.length - 1);
    } else if (e.key === 'ArrowLeft') {
      nextCol = Math.max(colIdx - 1, 0);
    } else if (e.key === 'ArrowDown') {
      nextDay = Math.min(dayIdx + 1, DAYS.length - 1);
    } else if (e.key === 'ArrowUp') {
      nextDay = Math.max(dayIdx - 1, 0);
    } else {
      return;
    }

    if (nextDay < DAYS.length && cellRefs.current[nextDay]?.[nextCol]) {
      cellRefs.current[nextDay][nextCol]?.focus();
    }
  };

  // Check for values > 400
  const hasHighValues = useMemo(() => {
    return grid.some(row => POINTS.some(p => {
      const v = parseInt(row[p]);
      return v > 400;
    }));
  }, [grid]);

  const hasNegativeValues = useMemo(() => {
    return grid.some(row => POINTS.some(p => {
      const v = parseInt(row[p]);
      return !isNaN(v) && v < 0;
    }));
  }, [grid]);

  // 36B REV3 — Checklist + pactuação + memória (somente Ficha A, ≤30 sem)
  const isFichaA = igSemNum <= 30;
  const [checklist, setChecklist] = useState<ChecklistState>(CHECKLIST_VAZIO);
  const [pactuacao, setPactuacao] = useState<'aceita' | 'recusa' | null>(null);
  const [memoria, setMemoria] = useState<'confirma' | 'nao_confirma' | null>(null);

  const decisaoFichaA = useMemo<DecisaoResultado | null>(() => {
    if (!isFichaA || !isChecklistCompleto(checklist) || percentual == null) return null;
    return aplicarRegrasFichaA(
      {
        checklist_dieta: checklist.dieta,
        checklist_exercicio: checklist.exercicio,
        checklist_ganho_peso: checklist.ganho_peso,
        checklist_pfe_us: checklist.pfe_us,
        checklist_ca: checklist.ca,
        checklist_la: checklist.la,
        memoria_glicosimetro: memoria,
        pactuacao_adesao: pactuacao,
      },
      percentual,
      editingConsulta?.peso_kg ?? null,
      igSemNum || null,
    );
  }, [isFichaA, checklist, memoria, pactuacao, percentual, editingConsulta?.peso_kg, igSemNum]);

  // Validation — peso não é mais obrigatório aqui (capturado no laudo, após o Bloco 1)
  const canSave = useMemo(() => {
    if (!dataInicio || !dataFim || !dataConsulta) return false;
    if (!igSemanas) return false;
    if (totalPreenchidos === 0) return false;
    if (hasNegativeValues) return false;
    // 36B REV3 — Ficha A exige checklist completo + caminho clínico fechado (sem pendências de pactuação/memória)
    if (isFichaA) {
      if (!isChecklistCompleto(checklist)) return false;
      if (decisaoFichaA && decisaoFichaA.pendencias.some(p => p === 'pactuacao_adesao' || p === 'memoria_glicosimetro')) return false;
    }
    return true;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues, isFichaA, checklist, decisaoFichaA]);

  // 34B.2 — status + pendentes (badge e banner).
  const statusFichaLocal: string = editingConsulta?.status_ficha ?? 'rascunho';
  // Em retorno NOVO intocado, esconde o badge "Rascunho" + banner de pendentes;
  // aparecem ao começar a preencher (ou ao editar ficha existente). Só visual —
  // não mexe na trava do "Gerar Laudo".
  const iniciouPreenchimento =
    !!editingConsulta || totalPreenchidos > 0 || !!dataInicio || !!dataFim;
  const camposPendentes = useMemo<string[]>(() => {
    const f: string[] = [];
    if (!dataInicio) f.push('Data de início do perfil');
    if (!dataFim) f.push('Data de fim do perfil');
    if (!dataConsulta) f.push('Data da consulta');
    if (!igSemanas) f.push('Idade gestacional (semanas)');
    if (totalPreenchidos === 0) f.push('Pelo menos 1 valor de glicemia preenchido');
    if (hasNegativeValues) f.push('Corrigir valores negativos na grade');
    if (isFichaA && !isChecklistCompleto(checklist)) f.push('Checklist clínico do Retorno 2 (6 itens)');
    if (isFichaA && decisaoFichaA?.pendencias.includes("pactuacao_adesao")) f.push('Pactuação com a paciente');
    if (isFichaA && decisaoFichaA?.pendencias.includes("memoria_glicosimetro")) f.push('Avaliação da memória do glicosímetro');
    return f;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues, isFichaA, checklist, decisaoFichaA]);

  // 34B.3 seção 3.10 — bloqueia submit quando alguma data clínica é inválida.
  const [dataInicioValida, setDataInicioValida] = useState(true);
  const [dataFimValida, setDataFimValida] = useState(true);
  const [dataConsultaValida, setDataConsultaValida] = useState(true);
  const todasDatasValidas = dataInicioValida && dataFimValida && dataConsultaValida;

  // 34B.3 seção 3.8 — contexto clínico do Caso Novo (extendido às demais fichas de retorno).
  const primeiraConsultaFicha = consultas.find((c) => c.tipo === 'consulta_1');
  const { contexto: contextoCasoNovo, loading: contextoLoading } = useContextoCasoNovo(
    paciente.id,
    isPreview,
    primeiraConsultaFicha ? { data: primeiraConsultaFicha.data, cenario_clinico: primeiraConsultaFicha.cenario_clinico } : null,
  );

  // Confirm high values
  const [showHighValueConfirm, setShowHighValueConfirm] = useState(false);

  // 34B.1 — Bug A: useAutosave removido. Persistência só via clique explícito em "Salvar retorno"
  // (handleSave abaixo). Os refs continuam declarados pois o botão handleSave os usa para
  // identificar consulta/perfil em edição (re-save sobre o mesmo registro).
  const draftConsultaIdRef = useRef<string | null>(editingConsulta?.id ?? null);
  const draftPerfilIdRef = useRef<string | null>(null);

  const handleSave = async () => {
    if (hasHighValues && !showHighValueConfirm) {
      setShowHighValueConfirm(true);
      return;
    }

    setSaving(true);

    const igS = parseInt(igSemanas) || 0;
    const igD = parseInt(igDias) || 0;
    const fichaType = igS > 30 ? 'ficha_c' : 'ficha_a';
    const cenario = isAdequado ? '2' : '3';
    const decisao = isAdequado ? 'controle_adequado' : 'controle_inadequado';
    const newStatus = isInadequado ? 'dmg_confirmado' : 'dmg_confirmado'; // stays dmg_confirmado

    if (isPreview) {
      // Preview mode — save to localStorage
      const nextSeq = (consultas.length || 0) + 1;
      const consultaData: PreviewConsulta = {
        id: editingConsulta?.id ?? crypto.randomUUID(),
        tipo: fichaType,
        numero_sequencial: editingConsulta?.numero_sequencial ?? nextSeq,
        data: dataConsulta,
        ig_semanas: igS,
        ig_dias: igD,
        observacoes: observacoes.trim() || null,
        status_gerado: newStatus,
        percentual_meta: percentual,
        total_preenchidos: totalPreenchidos,
        dentro_meta: dentroMeta,
        peso_kg: editingConsulta?.peso_kg ?? null,
        dose_total: editingConsulta?.dose_total ?? null,
        dose_manha: editingConsulta?.dose_manha ?? null,
        dose_noite: editingConsulta?.dose_noite ?? null,
        retorno_dias: retornoDias,
        data_proximo_retorno_formatted: dataProximoRetorno,
        grid_valores: grid,
        decisao,
        data_inicio: dataInicio,
        data_fim: dataFim,
        proxima_ficha_recomendada: decisaoFichaA?.proxima_ficha_recomendada ?? null,
        regra_aplicada: decisaoFichaA?.regra_aplicada ?? null,
        conduta_gerada: decisaoFichaA?.conduta_gerada ?? null,
        tipo_pos_prandial: janela,
      };

      let updatedConsultas: PreviewConsulta[];
      if (editingConsulta) {
        updatedConsultas = consultas.map(c => c.id === editingConsulta.id ? consultaData : c);
      } else {
        updatedConsultas = [...consultas, consultaData];
      }

      updatePreviewPaciente(paciente.id, {
        consultas: updatedConsultas,
        status_ficha: newStatus,
        data_ultima_consulta: dataConsulta,
        data_proximo_retorno: dataConsultaLocal ? format(addDays(dataConsultaLocal, retornoDias), 'yyyy-MM-dd') : null,
      });

      window.dispatchEvent(new Event('preview-pacientes-updated'));

      setSavedResult({
        percentual: percentual!,
        adequado: isAdequado,
      });

      setSaving(false);
      setShowImpact(true);
      return;
    }

    // Real mode — save to Supabase
    try {
      const profId = profissionalData?.id;
      if (!profId) throw new Error('Profissional não encontrado');

      const nextSeq = (consultas.length || 0) + 1;

      const consultaPayload = {
        paciente_id: paciente.id,
        profissional_id: profId,
        tipo: fichaType,
        numero_sequencial: nextSeq,
        data: dataConsulta,
        ig_semanas: igS,
        ig_dias: igD,
        observacoes: observacoes.trim() || null,
        status_gerado: newStatus,
        cenario_clinico: cenario,
        is_rascunho: false,
        // 34B.2 — finaliza ficha. Default do banco era 'rascunho' até este save.
        status_ficha: 'completa',
      };

      let consultaId = draftConsultaIdRef.current;
      if (consultaId) {
        const { error } = await supabase
          .from('consultas').update(consultaPayload as any).eq('id', consultaId);
        if (error) throw error;
      } else {
        const { data: newConsulta, error: consErr } = await supabase
          .from('consultas').insert(consultaPayload as any).select('id').single();
        if (consErr || !newConsulta) throw consErr || new Error('Falha ao criar consulta');
        consultaId = newConsulta.id;
      }

      const perfilPayload = {
        consulta_id: consultaId,
        paciente_id: paciente.id,
        profissional_id: profId,
        tipo_perfil: '4_pontos',
        peso_paciente_kg: editingConsulta?.peso_kg ?? null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        percentual_meta: percentual ?? 0,
        decisao,
        dose_insulina_calculada: editingConsulta?.dose_total ?? null,
        // 35B — janela pós-prandial. Gravada só no INSERT: o banco tem trigger de
        // imutabilidade (impedir_update_tipo_pos_prandial) que rejeita alteração em UPDATE.
        tipo_pos_prandial: janela,
      };

      let perfilId = draftPerfilIdRef.current;
      if (perfilId) {
        const { error } = await supabase
          .from('perfis_glicemicos' as any).update(perfilPayload as any).eq('id', perfilId);
        if (error) throw error;
      } else {
        const { data: newPerfil, error: perfErr } = await supabase
          .from('perfis_glicemicos' as any).insert(perfilPayload as any).select('id').single();
        if (perfErr || !newPerfil) throw perfErr || new Error('Falha ao criar perfil');
        perfilId = (newPerfil as any).id;
      }

      // Substitui valores
      await supabase.from('valores_perfil' as any).delete().eq('perfil_id', perfilId);
      const valores: any[] = [];
      grid.forEach((row, dayIdx) => {
        POINTS.forEach(point => {
          const val = parseInt(row[point]);
          if (val && val > 0) {
            valores.push({ perfil_id: perfilId, dia: dayIdx + 1, ponto: point, valor_mgdl: val });
          }
        });
      });
      if (valores.length > 0) {
        const { error: valErr } = await supabase.from('valores_perfil' as any).insert(valores);
        if (valErr) throw valErr;
      }

      await supabase
        .from('pacientes')
        .update({
          status_ficha: newStatus,
          data_ultima_consulta: dataConsulta,
          data_proximo_retorno: dataConsultaLocal ? format(addDays(dataConsultaLocal, retornoDias), 'yyyy-MM-dd') : null,
        })
        .eq('id', paciente.id);

      const { carimbarAtendimento } = await import('@/lib/carimbar');
      await carimbarAtendimento({
        pacienteId: paciente.id,
        tipoOperacao: 'preencher_ficha_ac',
        recursoId: consultaId ?? undefined,
        recursoTipo: 'ficha',
      });

      // 36B REV3 — Persistência auditável da decisão (apenas Ficha A com checklist completo)
      if (isFichaA && decisaoFichaA && consultaId) {
        await supabase
          .from('decisoes_ficha_a' as any)
          .upsert({
            consulta_id: consultaId,
            paciente_id: paciente.id,
            profissional_id: profId,
            checklist_dieta: checklist.dieta,
            checklist_exercicio: checklist.exercicio,
            checklist_ganho_peso: checklist.ganho_peso,
            checklist_pfe_us: checklist.pfe_us,
            checklist_ca: checklist.ca,
            checklist_la: checklist.la,
            percentual_meta: percentual,
            regra_aplicada: decisaoFichaA.regra_aplicada,
            conduta_gerada: decisaoFichaA.conduta_gerada,
            memoria_glicosimetro: memoria,
            pactuacao_adesao: pactuacao,
            dose_insulina_total: decisaoFichaA.dose_total,
            dose_insulina_manha: decisaoFichaA.dose_manha,
            dose_insulina_noite: decisaoFichaA.dose_noite,
            proxima_ficha_recomendada: decisaoFichaA.proxima_ficha_recomendada,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: 'consulta_id' });
      }

      setSavedResult({ percentual: percentual!, adequado: isAdequado });
      setSaving(false);
      setShowImpact(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err?.message || 'Erro desconhecido'));
      setSaving(false);
    }
  };

  // After closing impact popup
  const handleCloseImpact = () => {
    setShowImpact(false);
    onSaved();
  };

  return (
    <>
      {/* 35B — Passo de pactuação bloqueante. Só aparece em ficha NOVA (pactuada=false);
          na edição (pactuada=true) o modal não abre e o corpo já vem com a janela gravada. */}
      <PactuacaoPosPrandialModal
        open={!pactuada}
        onConfirm={(j) => { setJanela(j); setPactuada(true); }}
        onCancel={onCancel}
      />

      {pactuada && (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-[#7C4DBA] bg-[#F1F0FB] p-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isFirstFichaA
              ? 'RETORNO 2 — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo'
              : igSemNum > 30
                ? 'FICHA C — Acompanhamento sem insulina, após a 30ª semana (Perfil Glicêmico de 4 pontos × 7 dias)'
                : 'FICHA A — Acompanhamento sem insulina, até a 30ª semana (Perfil Glicêmico de 4 pontos × 15 dias)'}
          </h2>
          {iniciouPreenchimento && <StatusFichaBadge status={statusFichaLocal} />}
        </div>
        <p className="text-xs text-[#6D28D9]">
          Preencha a grade com as glicemias capilares registradas pela paciente.
        </p>
        {/* 35B — janela pactuada, read-only (não há como alterar depois nesta ficha) */}
        <div className="inline-flex items-center gap-1 rounded-full bg-[#E8E0FF] px-3 py-1 text-xs font-semibold text-[#5B21B6]">
          Pós-prandial: {prefixoHora(janela)}
        </div>
      </div>

      <CamposPendentesBanner
        pendentes={camposPendentes}
        ativo={iniciouPreenchimento && statusFichaLocal === 'rascunho'}
      />

      <ContextoClinicoCard loading={contextoLoading} contexto={contextoCasoNovo} />

      {/* Dynamic message */}
      <div className="rounded-lg border border-[#D6BCFA] bg-[#E8E0FF] p-3 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-[#7E69AB]" />
        <p className="text-xs font-medium text-[#5B21B6]">{dayMessage}</p>
      </div>

      {/* Hypoglycemia alerts */}
      {hypoAlerts.length > 0 && (
        <div className="rounded-xl border-2 border-[#EF4444] bg-[#FEE2E2] p-4 space-y-1">
          <p className="text-sm font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
            ALERTA DE HIPOGLICEMIA
          </p>
          {hypoAlerts.map((a, i) => (
            <p key={i} className="text-xs text-red-700">
              Valor de {a.value} mg/dL no Dia {a.day} ({a.point}). Avaliar imediatamente e informar ao especialista.
            </p>
          ))}
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">Data de início do perfil</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Primeiro dia em que a paciente começou a medir as glicemias.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataInicio} onChange={setDataInicio} onValidityChange={setDataInicioValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">Data de encerramento</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Último dia de medição do perfil.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataFim} onChange={setDataFim} onValidityChange={setDataFimValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">Data da consulta</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Data do retorno. Default: hoje. Editável.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataConsulta} onChange={setDataConsulta} onValidityChange={setDataConsultaValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">Idade gestacional atual</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">IG atual em semanas + dias. Usada para definir o intervalo do próximo retorno e para identificar se a paciente já passou da 30ª semana. Pré-preenchida com IG calculada automaticamente. Editável.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={45}
              value={igSemanas}
              onChange={e => setIgSemanas(e.target.value)}
              placeholder="sem"
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">sem +</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={igDias}
              onChange={e => setIgDias(e.target.value)}
              placeholder="dias"
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">dias</span>
          </div>
        </div>
      </div>

      {/* Real-time percentage display */}
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        {percentual !== null ? (
          <>
            <p className={`text-3xl font-bold ${percentual >= 70 ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
              {percentual.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Controle: {percentual.toFixed(1)}% das glicemias dentro da meta ({dentroMeta} de {totalPreenchidos} valores)
            </p>
            <p className={`text-xs mt-1 italic ${percentual >= 70 ? 'text-[#16A34A]' : 'text-[#64748B]'}`}>
              Meta: ≥ 70% das glicemias dentro do alvo
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs mt-1 italic text-[#64748B]">
              Meta: ≥ 70% das glicemias dentro do alvo
            </p>
          </>
        )}
      </div>

      {/* 4-point × 15-day grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-2 py-2 text-xs font-medium text-foreground text-left w-16">Dia</th>
              {POINTS.map(p => (
                <th key={p} className="px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-medium text-foreground">{pointLabel(p, janela)}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{pointTooltip(p, janela)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{'< '}{pointMeta(p, janela)} mg/dL</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIdx) => (
              <tr key={day} className="border-t border-border">
                <td className="px-2 py-1 text-xs font-medium text-foreground">Dia {day}</td>
                {POINTS.map((p, colIdx) => {
                  const val = grid[dayIdx][p];
                  const numVal = parseInt(val);
                  const isNeg = !isNaN(numVal) && numVal < 0;
                  const isHigh = !isNaN(numVal) && numVal > 400;
                  const isHypo = !isNaN(numVal) && isHypoglycemia(numVal);

                  return (
                    <td key={p} className="px-1 py-1">
                      <input
                        ref={el => setCellRef(dayIdx, colIdx, el)}
                        type="text"
                        inputMode="numeric"
                        value={val}
                        onChange={e => handleCellChange(dayIdx, p, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, dayIdx, colIdx)}
                        className={`w-full text-center text-sm rounded-md border px-1 py-1.5 outline-none transition-colors
                          focus:ring-2 focus:ring-[#7C4DBA] focus:border-[#7C4DBA]
                          ${isNeg ? 'bg-red-100 border-red-400 text-red-700' : ''}
                          ${isHigh ? 'bg-amber-50 border-amber-400' : ''}
                          ${isHypo ? 'bg-[#FEE2E2] border-red-400' : ''}
                          ${!isNeg && !isHigh && !isHypo ? getCellBg(p, val) : ''}
                          ${!val ? 'border-border' : ''}
                        `}
                        placeholder="—"
                        aria-label={`Dia ${day} ${pointLabel(p, janela)}`}
                      />
                      {isNeg && (
                        <span className="text-[9px] text-red-600 block text-center">Valor inválido</span>
                      )}
                      {isHigh && (
                        <span className="text-[9px] text-amber-600 block text-center">Verificar</span>
                      )}
                      {isHypo && (
                        <span className="text-[9px] text-red-600 block text-center">Hipoglicemia</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Peso e dose foram movidos para o LAUDO (FichaACResultCard) — capturados após o Bloco 1 */}

      {/* 36B REV3 — Checklist clínico do Retorno 2 (apenas Ficha A, ≤30 sem) */}
      {isFichaA && (
        <ChecklistRetorno2 value={checklist} onChange={setChecklist} disabled={saving} />
      )}

      {/* 36B REV3 — Conduta gerada pelo motor de decisão (apenas Ficha A) */}
      {isFichaA && decisaoFichaA && (
        <CondutaCard
          decisao={{
            regra_aplicada: decisaoFichaA.regra_aplicada,
            conduta_gerada: decisaoFichaA.conduta_gerada,
            proxima_ficha_recomendada: decisaoFichaA.proxima_ficha_recomendada,
            dose_total: decisaoFichaA.dose_total,
            dose_manha: decisaoFichaA.dose_manha,
            dose_noite: decisaoFichaA.dose_noite,
            pendencias: decisaoFichaA.pendencias,
          }}
          pactuacao={pactuacao}
          memoria={memoria}
          onPactuacao={setPactuacao}
          onMemoria={setMemoria}
          disabled={saving}
        />
      )}

      {/* Observations */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-foreground">Observações</label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">Anotações adicionais sobre este retorno.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Opcional"
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 print:hidden">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave || saving || !todasDatasValidas}
          className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar retorno
        </Button>
      </div>

      {/* High value confirmation dialog */}
      <AlertDialog open={showHighValueConfirm} onOpenChange={setShowHighValueConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Valores fora da faixa esperada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Existem valores acima de 400 mg/dL na grade. Verifique se os dados estão corretos antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowHighValueConfirm(false)}>
              Revisar
            </Button>
            <AlertDialogAction
              onClick={() => {
                setShowHighValueConfirm(false);
                handleSave();
              }}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              Confirmar e salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impact popup */}
      <AlertDialog open={showImpact}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg">
              {savedResult?.adequado ? (
                <span className="text-[#16A34A]">CONTROLE ADEQUADO</span>
              ) : (
                <span className="text-[#D97706]">CONTROLE INADEQUADO</span>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p className="text-base font-semibold">
                {savedResult?.percentual?.toFixed(1)}% das glicemias dentro da meta
              </p>
              {savedResult?.adequado ? (
                <p className="text-sm">
                  Orientações no laudo completo abaixo.
                </p>
              ) : (
                <p className="text-sm">
                  Conduta: iniciar insulina. Dose e orientações no laudo completo abaixo.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={handleCloseImpact}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              Fechar e ver laudo completo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
      )}
    </>
  );
}
