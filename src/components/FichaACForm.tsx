import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';
import { useIg, descreverReferenciaIg } from '@/lib/getIg';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
import StatusFichaBadge from '@/components/ficha/StatusFichaBadge';
import CamposPendentesBanner from '@/components/ficha/CamposPendentesBanner';
import DateInput from '@/components/ficha/DateInput';
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
import { calcularIntervaloRetornoDias } from '@/lib/retornoInterval';
import CondutaCard from '@/components/ficha/CondutaCard';
import { aplicarRegrasFichaA, type DecisaoResultado } from '@/lib/fichaADecisao';

const POINTS = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
type Point = typeof POINTS[number];

// Jejum permanece estático — 35B só torna dinâmicos os pontos pós-prandiais (janela 1h/2h).
const META_JEJUM = 95;

const REFEICAO_POS: Record<Exclude<Point, 'jejum'>, 'café' | 'almoço' | 'jantar'> = {
  pos_cafe: 'café',
  pos_almoco: 'almoço',
  pos_jantar: 'jantar',
};

function pointLabel(point: Point, janela: JanelaPosPrandial, t: (k: string) => string): string {
  return point === 'jejum' ? t('fichaAC.pontos.jejum') : rotuloPosPrandial(REFEICAO_POS[point], janela);
}

function pointMeta(point: Point, janela: JanelaPosPrandial): number {
  return point === 'jejum' ? META_JEJUM : metaPosPrandial(janela);
}

function pointTooltip(point: Point, janela: JanelaPosPrandial, t: (k: string) => string): string {
  return point === 'jejum' ? t('fichaAC.pontos.jejumTooltip') : tooltipPosPrandial(janela);
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
  const { t, i18n } = useTranslation();
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

  // 34D — pré-preenche a IG (ficha nova OU reabertura p/ editar) com o valor AO VIVO
  // na data da consulta, pela âncora ATUAL (não o congelado da época). Refaz só
  // quando a data muda; o refetch ao focar a aba não sobrescreve o que foi digitado.
  // Sem âncora (igAtual=null) mantém o seed.
  const igPrefilledForDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!igAtual) return;
    if (igPrefilledForDateRef.current === dataConsulta) return;
    igPrefilledForDateRef.current = dataConsulta;
    setIgSemanas(String(igAtual.semanas));
    setIgDias(String(igAtual.dias));
  }, [igAtual, dataConsulta]);

  const igSemNum = parseInt(igSemanas) || 0;

  // Determine if this is the first Ficha A (no prior ficha_a/ficha_c consultations)
  const isFirstFichaA = !consultas.some(c => ['ficha_a', 'ficha_c'].includes(c.tipo));

  // Dynamic message about how many days to fill
  const dayMessage = useMemo(() => {
    if (isFirstFichaA) return t('fichaAC.dayMessage.first');
    if (igSemNum > 30) return t('fichaAC.dayMessage.upTo7');
    return t('fichaAC.dayMessage.upTo15');
  }, [isFirstFichaA, igSemNum, t]);

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
          alerts.push({ day: dayIdx + 1, point: pointLabel(p, janela, t), value: val });
        }
      }
    });
    return alerts;
  }, [grid, janela, t]);

  const isAdequado = percentual !== null && percentual >= 70;
  const isInadequado = percentual !== null && percentual < 70;

  // Insulin dose calculation moved to laudo (FichaACResultCard) — captured AFTER doctor sees Bloco 1.

  // 38B-C (#17): intervalo de retorno da regra central. A 1ª Ficha A/C
  // (1º perfil glicêmico pós-diagnóstico) usa 10 dias; demais, 15 (≤30) / 7 (>30).
  const ehPrimeiroPerfil = !consultas.some(
    c => c.id !== editingConsulta?.id && ['ficha_a', 'ficha_c', 'ficha_b', 'ficha_d', 'ficha_e'].includes(c.tipo),
  );
  const retornoDias = calcularIntervaloRetornoDias({ ehFichaE: false, ehPrimeiroPerfil, igSemanas: igSemNum });
  const dataConsultaLocal = parseDateLocal(dataConsulta);
  const dataProximoRetorno = dataConsultaLocal
    ? addDays(dataConsultaLocal, retornoDias).toLocaleDateString(i18n.language)
    : null;

  // Impact popup
  const [showImpact, setShowImpact] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    percentual: number;
    adequado: boolean;
    // 38B-B (#10): roteamento devolvido pelo motor — pop-up sensível ao desfecho.
    proximaFicha: string | null;
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

  // 42D — Motor de decisão (checklist + pactuação + memória) roda para a Ficha A
  // (≤30 sem) E a Ficha C (>30 sem): a avaliação de controle é idêntica. O motor é
  // bilateral (roteia por IG internamente); a única diferença A/C é o intervalo de
  // retorno (15d vs 7d), já ortogonal ao motor. isFichaAC substitui o antigo isFichaA.
  const isFichaAC = true;
  // 38B-A (#9): ao reabrir o Retorno 2, restaura as 6 respostas salvas
  // (decisoes_ficha_a hidratada no fetchPaciente). Ficha nova começa vazia.
  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    editingConsulta
      ? {
          dieta: editingConsulta.checklist_dieta ?? null,
          exercicio: editingConsulta.checklist_exercicio ?? null,
          ganho_peso: editingConsulta.checklist_ganho_peso ?? null,
          pfe_us: editingConsulta.checklist_pfe_us ?? null,
          ca: editingConsulta.checklist_ca ?? null,
          la: editingConsulta.checklist_la ?? null,
        }
      : CHECKLIST_VAZIO,
  );
  const [pactuacao, setPactuacao] = useState<'aceita' | 'recusa' | null>(null);
  const [memoria, setMemoria] = useState<'confirma' | 'nao_confirma' | null>(null);

  // 38B-A.1 (HOTFIX): o useState do checklist inicializa UMA vez na montagem; quando
  // editingConsulta hidrata de forma assíncrona (fetchPaciente), o estado não
  // re-sincronizava e o checklist voltava em branco ao reabrir um Retorno 2 salvo.
  // Este efeito re-hidrata os 6 botões quando editingConsulta chega/muda — como a
  // grade e o resultado já fazem ao serem lidos no render. Usar ?? (nunca ||): os
  // itens 1-3 são boolean e "Não" = false; com || o false viraria null (botão vazio).
  useEffect(() => {
    if (!editingConsulta) return;
    setChecklist({
      dieta: editingConsulta.checklist_dieta ?? null,
      exercicio: editingConsulta.checklist_exercicio ?? null,
      ganho_peso: editingConsulta.checklist_ganho_peso ?? null,
      pfe_us: editingConsulta.checklist_pfe_us ?? null,
      ca: editingConsulta.checklist_ca ?? null,
      la: editingConsulta.checklist_la ?? null,
    });
  }, [editingConsulta]);

  // 42F — teto de pactuação única: conta as pactuações de MEV aceitas ANTERIORES da
  // paciente (regra_2 + aceita), lidas do histórico persistido (consultas hidratadas
  // com decisoes_ficha_a), excluindo a ficha em edição. > 0 → o motor força insulina.
  const pactuacoesPrevias = useMemo(
    () => consultas.filter(
      (c) => c.regra_aplicada === 'regra_2' && c.pactuacao_adesao === 'aceita' && c.id !== editingConsulta?.id,
    ).length,
    [consultas, editingConsulta?.id],
  );

  const decisaoFichaA = useMemo<DecisaoResultado | null>(() => {
    if (!isFichaAC || !isChecklistCompleto(checklist) || percentual == null) return null;
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
      pactuacoesPrevias,
    );
  }, [isFichaAC, checklist, memoria, pactuacao, percentual, editingConsulta?.peso_kg, igSemNum, pactuacoesPrevias]);

  // Validation — peso não é mais obrigatório aqui (capturado no laudo, após o Bloco 1)
  const canSave = useMemo(() => {
    if (!dataInicio || !dataFim || !dataConsulta) return false;
    if (!igSemanas) return false;
    if (totalPreenchidos === 0) return false;
    if (hasNegativeValues) return false;
    // 36B REV3 — Ficha A exige checklist completo + caminho clínico fechado (sem pendências de pactuação/memória)
    if (isFichaAC) {
      if (!isChecklistCompleto(checklist)) return false;
      if (decisaoFichaA && decisaoFichaA.pendencias.some(p => p === 'pactuacao_adesao' || p === 'memoria_glicosimetro')) return false;
    }
    return true;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues, isFichaAC, checklist, decisaoFichaA]);

  // 34B.2 — status + pendentes (badge e banner).
  const statusFichaLocal: string = editingConsulta?.status_ficha ?? 'rascunho';
  // Rascunho NÃO é sinalizado durante o preenchimento: badge "Rascunho" + banner de
  // pendentes só aparecem ao reabrir uma ficha JÁ salva (reflete o status real).
  // Não mexe na trava do "Gerar Laudo".
  const fichaPersistida = !!editingConsulta;
  const camposPendentes = useMemo<string[]>(() => {
    const f: string[] = [];
    if (!dataInicio) f.push(t('fichaAC.pendentes.dataInicio'));
    if (!dataFim) f.push(t('fichaAC.pendentes.dataFim'));
    if (!dataConsulta) f.push(t('fichaAC.pendentes.dataConsulta'));
    if (!igSemanas) f.push(t('fichaAC.pendentes.igSemanas'));
    if (totalPreenchidos === 0) f.push(t('fichaAC.pendentes.aoMenosUmValor'));
    if (hasNegativeValues) f.push(t('fichaAC.pendentes.valoresNegativos'));
    if (isFichaAC && !isChecklistCompleto(checklist)) f.push(t('fichaAC.pendentes.checklist'));
    if (isFichaAC && decisaoFichaA?.pendencias.includes("pactuacao_adesao")) f.push(t('fichaAC.pendentes.pactuacao'));
    if (isFichaAC && decisaoFichaA?.pendencias.includes("memoria_glicosimetro")) f.push(t('fichaAC.pendentes.memoria'));
    return f;
  }, [dataInicio, dataFim, dataConsulta, igSemanas, totalPreenchidos, hasNegativeValues, isFichaAC, checklist, decisaoFichaA, t]);

  // 34B.3 seção 3.10 — bloqueia submit quando alguma data clínica é inválida.
  const [dataInicioValida, setDataInicioValida] = useState(true);
  const [dataFimValida, setDataFimValida] = useState(true);
  const [dataConsultaValida, setDataConsultaValida] = useState(true);
  const todasDatasValidas = dataInicioValida && dataFimValida && dataConsultaValida;


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

    // PROMPT 42H — insulinização terminal: quando a decisão da Ficha A/C roteia
    // para insulina (proxima ∈ {ficha_b, ficha_d}), o Retorno 2 ENCERRA a paciente
    // na hora — espelha o gate da edge salvar-ficha-retorno:689-691, sem invocá-la.
    // Demais desfechos seguem o ciclo normal. O status_gerado da CONSULTA segue
    // 'dmg_confirmado' (diagnóstico); só o status_ficha da PACIENTE vira encerramento.
    // Toda a supressão de telas/botões + card já reage a isso (gates do 42E).
    const iniciaInsulina =
      decisaoFichaA?.proxima_ficha_recomendada === 'ficha_b' ||
      decisaoFichaA?.proxima_ficha_recomendada === 'ficha_d';
    const pacienteStatusFicha = iniciaInsulina ? 'encerrada_insulinizacao' : newStatus;
    // Paciente encerrada não tem próximo retorno (jornada terminal).
    const proximoRetornoISO = iniciaInsulina
      ? null
      : (dataConsultaLocal ? format(addDays(dataConsultaLocal, retornoDias), 'yyyy-MM-dd') : null);

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
        // 42F — persiste pactuação/memória p/ o teto contar pactuações no histórico.
        pactuacao_adesao: pactuacao,
        memoria_glicosimetro: memoria,
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
        // 42H — no preview grava só status_ficha; o resolverMotivoEfetivo do 42E
        // faz a ponte 'encerrada_insulinizacao' → motivo 'insulinizacao'.
        status_ficha: pacienteStatusFicha,
        data_ultima_consulta: dataConsulta,
        data_proximo_retorno: proximoRetornoISO,
      });

      window.dispatchEvent(new Event('preview-pacientes-updated'));

      setSavedResult({
        percentual: percentual!,
        adequado: isAdequado,
        proximaFicha: decisaoFichaA?.proxima_ficha_recomendada ?? null,
      });

      setSaving(false);
      setShowImpact(true);
      return;
    }

    // Real mode — save to Supabase
    try {
      const profId = profissionalData?.id;
      if (!profId) throw new Error(t('fichaAC.errors.noProfessional'));

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
        if (consErr || !newConsulta) throw consErr || new Error(t('fichaAC.errors.createConsulta'));
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
        percentual_meta: totalPreenchidos > 0 ? (percentual ?? 0) : null,
        // PROMPT 38A — agregado de controle (fonte única; card/cabeçalho/laudo leem daqui)
        total_preenchidos: totalPreenchidos,
        na_meta: dentroMeta,
        decisao: totalPreenchidos > 0 ? decisao : null,
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
        if (perfErr || !newPerfil) throw perfErr || new Error(t('fichaAC.errors.createPerfil'));
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
          status_ficha: pacienteStatusFicha,
          // 42H — encerramento por insulinização (espelha salvar-ficha-retorno:689-691).
          ...(iniciaInsulina
            ? { motivo_encerramento: 'insulinizacao', data_encerramento: dataConsulta }
            : {}),
          data_ultima_consulta: dataConsulta,
          data_proximo_retorno: proximoRetornoISO,
        })
        .eq('id', paciente.id);

      const { carimbarAtendimento } = await import('@/lib/carimbar');
      await carimbarAtendimento({
        pacienteId: paciente.id,
        // 40B (3.4): criação carimba só no 1º save; reabrir/reeditar → reabrir_consulta
        tipoOperacao: editingConsulta ? 'reabrir_consulta' : 'preencher_ficha_ac',
        recursoId: consultaId ?? undefined,
        recursoTipo: editingConsulta ? 'consulta' : 'ficha',
      });

      // Persiste o laudo desta consulta → contador + histórico. Fire-and-forget,
      // não-bloqueante (idempotente por consulta; institucional é ilimitado).
      const laudoConsultaId = consultaId;
      if (laudoConsultaId) {
        void import('@/lib/registrarLaudo').then(({ registrarLaudo }) =>
          registrarLaudo(paciente.id, laudoConsultaId),
        );
      }

      // 36B REV3 — Persistência auditável da decisão (apenas Ficha A com checklist completo)
      if (isFichaAC && decisaoFichaA && consultaId) {
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

      setSavedResult({ percentual: percentual!, adequado: isAdequado, proximaFicha: decisaoFichaA?.proxima_ficha_recomendada ?? null });
      setSaving(false);
      setShowImpact(true);
    } catch (err: any) {
      console.error(err);
      toast.error(t('fichaAC.errors.saveError', { error: err?.message || t('fichaAC.errors.unknown') }));
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
              ? t('fichaAC.header.titleRetorno2')
              : igSemNum > 30
                ? t('fichaAC.header.titleFichaC')
                : t('fichaAC.header.titleFichaA')}
          </h2>
          {fichaPersistida && <StatusFichaBadge status={statusFichaLocal} />}
        </div>
        <p className="text-xs text-[#6D28D9]">
          {t('fichaAC.header.subtitle')}
        </p>
        {/* 35B — janela pactuada, read-only (não há como alterar depois nesta ficha) */}
        <div className="inline-flex items-center gap-1 rounded-full bg-[#E8E0FF] px-3 py-1 text-xs font-semibold text-[#5B21B6]">
          {t('fichaAC.header.posPrandialBadge', { janela: prefixoHora(janela) })}
        </div>
      </div>

      <CamposPendentesBanner
        pendentes={camposPendentes}
        ativo={fichaPersistida && statusFichaLocal === 'rascunho'}
      />


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
            {t('fichaAC.hypo.alertTitle')}
          </p>
          {hypoAlerts.map((a, i) => (
            <p key={i} className="text-xs text-red-700">
              {t('fichaAC.hypo.alertLine', { value: a.value, day: a.day, point: a.point })}
            </p>
          ))}
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">{t('fichaAC.fields.dataInicioLabel')}</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{t('fichaAC.fields.dataInicioTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataInicio} onChange={setDataInicio} onValidityChange={setDataInicioValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">{t('fichaAC.fields.dataFimLabel')}</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{t('fichaAC.fields.dataFimTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataFim} onChange={setDataFim} onValidityChange={setDataFimValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">{t('fichaAC.fields.dataConsultaLabel')}</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{t('fichaAC.fields.dataConsultaTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <DateInput value={dataConsulta} onChange={setDataConsulta} onValidityChange={setDataConsultaValida} />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-foreground">{t('fichaAC.fields.igLabel')}</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{t('fichaAC.fields.igTooltipBefore')} {descreverReferenciaIg(igAtual)} {t('fichaAC.fields.igTooltipAfter')}</p>
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
              placeholder={t('fichaAC.fields.weeksPlaceholder')}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">{t('fichaAC.fields.weeksPlus')}</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={igDias}
              onChange={e => setIgDias(e.target.value)}
              placeholder={t('fichaAC.fields.daysPlaceholder')}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">{t('fichaAC.fields.days')}</span>
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
              {t('fichaAC.control.detail', { percentual: percentual.toFixed(1), dentroMeta, total: totalPreenchidos })}
            </p>
            <p className={`text-xs mt-1 italic ${percentual >= 70 ? 'text-[#16A34A]' : 'text-[#64748B]'}`}>
              {t('fichaAC.control.target')}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs mt-1 italic text-[#64748B]">
              {t('fichaAC.control.target')}
            </p>
          </>
        )}
      </div>

      {/* 4-point × 15-day grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-2 py-2 text-xs font-medium text-foreground text-left w-16">{t('fichaAC.grid.day')}</th>
              {POINTS.map(p => (
                <th key={p} className="px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xs font-medium text-foreground">{pointLabel(p, janela, t)}</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{pointTooltip(p, janela, t)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t('fichaAC.grid.metaValue', { value: pointMeta(p, janela) })}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIdx) => (
              <tr key={day} className="border-t border-border">
                <td className="px-2 py-1 text-xs font-medium text-foreground">{t('fichaAC.grid.dayN', { day })}</td>
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
                        aria-label={t('fichaAC.grid.cellAria', { day, point: pointLabel(p, janela, t) })}
                      />
                      {isNeg && (
                        <span className="text-[9px] text-red-600 block text-center">{t('fichaAC.grid.invalid')}</span>
                      )}
                      {isHigh && (
                        <span className="text-[9px] text-amber-600 block text-center">{t('fichaAC.grid.verify')}</span>
                      )}
                      {isHypo && (
                        <span className="text-[9px] text-red-600 block text-center">{t('fichaAC.grid.hypo')}</span>
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
      {isFichaAC && (
        <ChecklistRetorno2 value={checklist} onChange={setChecklist} disabled={saving} />
      )}

      {/* 36B REV3 — Conduta gerada pelo motor de decisão (apenas Ficha A) */}
      {isFichaAC && decisaoFichaA && (
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
          <label className="text-xs font-medium text-foreground">{t('fichaAC.observations.label')}</label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{t('fichaAC.observations.tooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder={t('fichaAC.observations.placeholder')}
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 print:hidden">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave || saving || !todasDatasValidas}
          className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('fichaAC.actions.save')}
        </Button>
      </div>

      {/* High value confirmation dialog */}
      <AlertDialog open={showHighValueConfirm} onOpenChange={setShowHighValueConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('fichaAC.highValue.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('fichaAC.highValue.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowHighValueConfirm(false)}>
              {t('fichaAC.highValue.review')}
            </Button>
            <AlertDialogAction
              onClick={() => {
                setShowHighValueConfirm(false);
                handleSave();
              }}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {t('fichaAC.highValue.confirmSave')}
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
                <span className="text-[#16A34A]">{t('fichaAC.impact.adequado')}</span>
              ) : (
                <span className="text-[#D97706]">{t('fichaAC.impact.inadequado')}</span>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p className="text-base font-semibold">
                {t('fichaAC.impact.percentual', { percentual: savedResult?.percentual?.toFixed(1) })}
              </p>
              {savedResult?.adequado ? (
                <p className="text-sm">
                  {savedResult?.proximaFicha === 'ficha_e'
                    ? t('fichaAC.impact.adequadoFichaE')
                    : t('fichaAC.impact.adequadoDefault')}
                </p>
              ) : (
                <p className="text-sm">
                  {t('fichaAC.impact.inadequadoConduta')}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={handleCloseImpact}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {t('fichaAC.impact.close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
      )}
    </>
  );
}
