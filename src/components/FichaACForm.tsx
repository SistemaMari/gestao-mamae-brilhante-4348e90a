import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { differenceInDays, addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
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
  jejum: 90,
  pos_cafe: 140,
  pos_almoco: 140,
  pos_jantar: 140,
};

const POINT_TOOLTIPS: Record<Point, string> = {
  jejum: 'Coleta antes de qualquer refeição, após pelo menos 8 horas sem comer. Meta: < 90 mg/dL. Usar glicômetro capilar para acompanhamento — diferente do diagnóstico, onde é obrigatório plasma venoso.',
  pos_cafe: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL.',
  pos_almoco: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL.',
  pos_jantar: 'Coleta exatamente 1 hora após o início da refeição. Meta: < 140 mg/dL.',
};

const DAYS = Array.from({ length: 15 }, (_, i) => i + 1);

interface FichaACFormProps {
  paciente: PreviewPaciente;
  consultas: PreviewConsulta[];
  isPreview: boolean;
  onSaved: () => void;
  onCancel: () => void;
}

export default function FichaACForm({
  paciente, consultas, isPreview, onSaved, onCancel,
}: FichaACFormProps) {
  const { profissionalData } = useProfissionalData();

  // Grid state: grid[day-1][point] = string value
  const [grid, setGrid] = useState<Record<string, string>[]>(
    DAYS.map(() => Object.fromEntries(POINTS.map(p => [p, ''])))
  );

  // Form fields
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataConsulta, setDataConsulta] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState('');
  const [peso, setPeso] = useState('');
  const [saving, setSaving] = useState(false);

  // IG auto-calculated
  const igAtual = useMemo(() => {
    if (!paciente.dum) return null;
    const dias = differenceInDays(new Date(dataConsulta), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum, dataConsulta]);

  const [igSemanas, setIgSemanas] = useState('');
  const [igDias, setIgDias] = useState('');

  useEffect(() => {
    if (igAtual) {
      setIgSemanas(String(igAtual.semanas));
      setIgDias(String(igAtual.dias));
    }
  }, [igAtual]);

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
        if (val >= 1 && val <= 400) {
          total++;
          if (val < POINT_METAS[p]) ok++;
        } else if (val > 400) {
          total++;
          if (val < POINT_METAS[p]) ok++;
        }
      }
    }
    return {
      totalPreenchidos: total,
      dentroMeta: ok,
      percentual: total > 0 ? Math.round((ok / total) * 1000) / 10 : null,
    };
  }, [grid]);

  const isAdequado = percentual !== null && percentual >= 70;
  const isInadequado = percentual !== null && percentual < 70;

  // Weight becomes required when < 70%
  const pesoRequired = isInadequado;
  const pesoNum = parseFloat(peso) || 0;

  // Insulin dose calculation
  const doseTotal = pesoNum > 0 ? Math.round(0.5 * pesoNum * 10) / 10 : null;
  const doseManha = doseTotal ? Math.round((doseTotal * 2 / 3) * 10) / 10 : null;
  const doseNoite = doseTotal ? Math.round((doseTotal * 1 / 3) * 10) / 10 : null;

  // Next return interval
  const retornoDias = igSemNum > 30 ? 7 : 15;
  const dataProximoRetorno = dataConsulta
    ? format(addDays(new Date(dataConsulta), retornoDias), 'dd/MM/yyyy')
    : null;

  // Impact popup
  const [showImpact, setShowImpact] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    percentual: number;
    adequado: boolean;
    doseTotal: number | null;
    doseManha: number | null;
    doseNoite: number | null;
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

  // Validation
  const canSave = useMemo(() => {
    if (!dataInicio || !dataFim || !dataConsulta) return false;
    if (!igSemanas) return false;
    if (totalPreenchidos === 0) return false;
    if (hasNegativeValues) return false;
    if (pesoRequired && (!peso || pesoNum <= 0)) return false;
    return true;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues, pesoRequired, peso, pesoNum]);

  // Confirm high values
  const [showHighValueConfirm, setShowHighValueConfirm] = useState(false);

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
      const newConsulta: PreviewConsulta = {
        id: crypto.randomUUID(),
        tipo: fichaType,
        numero_sequencial: nextSeq,
        data: dataConsulta,
        ig_semanas: igS,
        ig_dias: igD,
        observacoes: observacoes.trim() || null,
        status_gerado: newStatus,
        percentual_meta: percentual,
        total_preenchidos: totalPreenchidos,
        dentro_meta: dentroMeta,
        peso_kg: pesoNum > 0 ? pesoNum : null,
        dose_total: isInadequado ? doseTotal : null,
        dose_manha: isInadequado ? doseManha : null,
        dose_noite: isInadequado ? doseNoite : null,
        retorno_dias: retornoDias,
        data_proximo_retorno_formatted: dataProximoRetorno,
        grid_valores: grid,
        decisao,
      };

      const updatedConsultas = [...consultas, newConsulta];
      updatePreviewPaciente(paciente.id, {
        consultas: updatedConsultas,
        status_ficha: newStatus,
        data_ultima_consulta: dataConsulta,
        data_proximo_retorno: format(addDays(new Date(dataConsulta), retornoDias), 'yyyy-MM-dd'),
      });

      window.dispatchEvent(new Event('preview-pacientes-updated'));

      setSavedResult({
        percentual: percentual!,
        adequado: isAdequado,
        doseTotal: isInadequado ? doseTotal : null,
        doseManha: isInadequado ? doseManha : null,
        doseNoite: isInadequado ? doseNoite : null,
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

      // 1. Create consulta
      const { data: newConsulta, error: consErr } = await supabase
        .from('consultas')
        .insert({
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
        })
        .select('id')
        .single();

      if (consErr || !newConsulta) throw consErr || new Error('Falha ao criar consulta');

      // 2. Create perfil_glicemico
      const { data: newPerfil, error: perfErr } = await supabase
        .from('perfis_glicemicos' as any)
        .insert({
          consulta_id: newConsulta.id,
          paciente_id: paciente.id,
          profissional_id: profId,
          tipo_perfil: '4_pontos',
          peso_paciente_kg: pesoNum > 0 ? pesoNum : null,
          data_inicio: dataInicio,
          data_fim: dataFim,
          percentual_meta: percentual ?? 0,
          decisao,
          dose_insulina_calculada: isInadequado && doseTotal ? doseTotal : null,
        })
        .select('id')
        .single();

      if (perfErr || !newPerfil) throw perfErr || new Error('Falha ao criar perfil');

      // 3. Create valores_perfil
      const valores: any[] = [];
      grid.forEach((row, dayIdx) => {
        POINTS.forEach(point => {
          const val = parseInt(row[point]);
          if (val && val > 0) {
            valores.push({
              perfil_id: (newPerfil as any).id,
              dia: dayIdx + 1,
              ponto: point,
              valor_mgdl: val,
            });
          }
        });
      });

      if (valores.length > 0) {
        const { error: valErr } = await supabase
          .from('valores_perfil' as any)
          .insert(valores);
        if (valErr) throw valErr;
      }

      // 4. Update patient status
      await supabase
        .from('pacientes')
        .update({
          status_ficha: newStatus,
          data_ultima_consulta: dataConsulta,
          data_proximo_retorno: format(addDays(new Date(dataConsulta), retornoDias), 'yyyy-MM-dd'),
        })
        .eq('id', paciente.id);

      setSavedResult({
        percentual: percentual!,
        adequado: isAdequado,
        doseTotal: isInadequado ? doseTotal : null,
        doseManha: isInadequado ? doseManha : null,
        doseNoite: isInadequado ? doseNoite : null,
      });

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
      <div className="rounded-xl border border-[#9b87f5] bg-[#F1F0FB] p-4 space-y-1">
        <h2 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {isFirstFichaA
            ? 'RETORNO 2 — Hora de ver o resultado inicial do tratamento (Perfil Glicêmico de 4 pontos) e definir próximo passo'
            : igSemNum > 30
              ? 'FICHA C — Acompanhamento sem insulina, após a 30ª semana (Perfil Glicêmico de 4 pontos × 7 dias)'
              : 'FICHA A — Acompanhamento sem insulina, até a 30ª semana (Perfil Glicêmico de 4 pontos × 15 dias)'}
        </h2>
        <p className="text-xs text-[#6D28D9]">
          Preencha a grade com as glicemias capilares registradas pela paciente.
        </p>
      </div>

      {/* Dynamic message */}
      <div className="rounded-lg border border-[#D6BCFA] bg-[#E8E0FF] p-3 flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-[#7E69AB]" />
        <p className="text-xs font-medium text-[#5B21B6]">{dayMessage}</p>
      </div>

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
                          focus:ring-2 focus:ring-[#9b87f5] focus:border-[#9b87f5]
                          ${isNeg ? 'bg-red-100 border-red-400 text-red-700' : ''}
                          ${isHigh ? 'bg-amber-50 border-amber-400' : ''}
                          ${!isNeg && !isHigh ? getCellBg(p, val) : ''}
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
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weight field — conditional */}
      {(pesoRequired || peso) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {/* Explanatory card when control < 70% */}
          {isInadequado && (
            <div className="rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                Controle glicêmico abaixo da meta
              </p>
              <p className="text-xs text-amber-700">
                O percentual de glicemias dentro do alvo ficou abaixo de 70%. A conduta indicada pelo protocolo é associar insulina NPH subcutânea. Informe o peso atual da paciente para que o sistema calcule a dose inicial.
              </p>
            </div>
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">
              Peso atual (kg) {pesoRequired && <span className="text-red-500">*</span>}
            </label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">O peso é necessário para calcular a dose inicial padrão de insulina: 0,5 UI/kg/dia. Essa dose é padronizada mundialmente para início de insulinoterapia em DMG. Ex: paciente de 70 kg → 35 UI/dia em 2-3 tomadas.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="number"
            min={30}
            max={300}
            step={0.1}
            value={peso}
            onChange={e => setPeso(e.target.value)}
            placeholder="Ex: 70"
            className="w-32"
          />

          {/* Insulin dose calculation */}
          {isInadequado && doseTotal && pesoNum > 0 && (
            <div className="rounded-lg bg-[#FEF3C7] border border-[#F59E0B] p-3 mt-2">
              <p className="text-xs font-semibold text-amber-800">
                Dose inicial de insulina NPH: {doseTotal} UI/dia (0,5 UI/kg/dia × {pesoNum} kg)
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Distribuição: {doseManha} UI pela manhã (ao acordar) e {doseNoite} UI às 22h.
              </p>
            </div>
          )}
        </div>
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
          disabled={!canSave || saving}
          className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
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
              className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
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
                  Manter dieta e atividade física. Próximo retorno em {retornoDias} dias com perfil glicêmico de 4 pontos.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm">
                    Associar insulina NPH subcutânea. Próximo retorno em {retornoDias} dias com perfil glicêmico de 6 pontos (inclui pré-prandiais).
                  </p>
                  {savedResult?.doseTotal && (
                    <p className="text-sm font-medium text-amber-800">
                      Dose inicial: {savedResult.doseTotal} UI/dia — {savedResult.doseManha} UI manhã + {savedResult.doseNoite} UI às 22h
                    </p>
                  )}
                </div>
              )}
              {dataProximoRetorno && (
                <p className="text-xs text-muted-foreground">
                  Próximo retorno sugerido: {dataProximoRetorno} ({retornoDias} dias)
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={handleCloseImpact}
              className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
            >
              Fechar e ver resultado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
