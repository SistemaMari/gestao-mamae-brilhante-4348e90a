import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { differenceInDays, addDays, format } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
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
import {
  Info, Loader2, FileText, AlertTriangle,
} from 'lucide-react';

const POINTS = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
type Point = typeof POINTS[number];

const POINT_LABELS: Record<Point, string> = {
  jejum: 'Jejum',
  pos_cafe: '1h pós café',
  pos_almoco: '1h pós almoço',
  pos_jantar: '1h pós jantar',
};

const POINT_METAS: Record<Point, number> = {
  jejum: 95,
  pos_cafe: 140,
  pos_almoco: 140,
  pos_jantar: 140,
};

const POINT_TOOLTIPS: Record<Point, string> = {
  jejum: 'Coleta antes de qualquer refeição, após pelo menos 8 horas sem comer. Meta: < 95 mg/dL. Usar glicômetro capilar para acompanhamento — diferente do diagnóstico, onde é obrigatório plasma venoso. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.',
  pos_cafe: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.',
  pos_almoco: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.',
  pos_jantar: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL. ATENÇÃO: valores < 70 mg/dL indicam hipoglicemia — avaliar imediatamente e informar ao especialista.',
};

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

  // IG auto-calculated
  const igAtual = useMemo(() => {
    if (!paciente.dum) return null;
    const consulta = parseDateLocal(dataConsulta);
    const dum = parseDateLocal(paciente.dum);
    if (!consulta || !dum) return null;
    const dias = differenceInDays(consulta, dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum, dataConsulta]);

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
        if (val < POINT_METAS[p]) ok++;
      }
    }
    return {
      totalPreenchidos: total,
      dentroMeta: ok,
      percentual: total > 0 ? Math.round((ok / total) * 1000) / 10 : null,
    };
  }, [grid]);

  // Hypoglycemia alerts — qualquer valor < 70 em qualquer ponto
  const hypoAlerts = useMemo(() => {
    const alerts: { day: number; point: string; value: number }[] = [];
    grid.forEach((row, dayIdx) => {
      for (const p of POINTS) {
        const val = parseInt(row[p]);
        if (!isNaN(val) && isHypoglycemia(val)) {
          alerts.push({ day: dayIdx + 1, point: POINT_LABELS[p], value: val });
        }
      }
    });
    return alerts;
  }, [grid]);

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
    if (num >= POINT_METAS[point]) return 'bg-[#FEE2E2]'; // above target
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

  // Validation — peso não é mais obrigatório aqui (capturado no laudo, após o Bloco 1)
  const canSave = useMemo(() => {
    if (!dataInicio || !dataFim || !dataConsulta) return false;
    if (!igSemanas) return false;
    if (totalPreenchidos === 0) return false;
    if (hasNegativeValues) return false;
    return true;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues]);

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
          {/* 34B.1 — AutosaveIndicator removido junto com o autosave. */}
        </div>
        <p className="text-xs text-[#6D28D9]">
          Preencha a grade com as glicemias capilares registradas pela paciente.
        </p>
      </div>

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
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
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
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
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
          <Input type="date" value={dataConsulta} onChange={e => setDataConsulta(e.target.value)} />
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
                    <span className="text-xs font-medium text-foreground">{POINT_LABELS[p]}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{POINT_TOOLTIPS[p]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{'< '}{POINT_METAS[p]} mg/dL</span>
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
                        aria-label={`Dia ${day} ${POINT_LABELS[p]}`}
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
          disabled={!canSave || saving}
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
  );
}
