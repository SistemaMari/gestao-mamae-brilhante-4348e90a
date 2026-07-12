import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
import StatusFichaBadge from '@/components/ficha/StatusFichaBadge';
import CamposPendentesBanner from '@/components/ficha/CamposPendentesBanner';
import DateInput from '@/components/ficha/DateInput';
import {
  updatePreviewPaciente,
  getPreviewPacienteById,
  type PreviewPaciente,
  type PreviewConsulta,
} from '@/lib/previewPatients';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Info, Loader2, AlertTriangle, CheckCircle2, XCircle, Printer } from 'lucide-react';
// 34C-B2: differenceInDays removido — cálculo de IG agora é centralizado
// em `@/lib/getIg` (RPC calcular_ig).
import { todayLocalISO } from '@/lib/dateUtils';
import { useIg, descreverReferenciaIg } from '@/lib/getIg';

function todayISO() {
  return todayLocalISO();
}

type GttDiagResult = {
  tipo: 'negativo' | 'positivo' | 'overt';
  label: string;
  texto: string;
  // Chaves i18n para exibição (label/texto acima ficam em pt para gravação em observacoes no banco).
  labelKey: string;
  textoKey: string;
  cor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  cenario: string | null;
  statusFicha: string;
};

function calcularGttDiagnostico(
  jejum: number,
  h1: number | null,
  h2: number | null,
  recursoLimitado: boolean,
  igSemanas: number | null,
): GttDiagResult {
  // Overt check
  if (jejum >= 126 || (h2 != null && h2 >= 200)) {
    return {
      tipo: 'overt',
      label: 'OVERT DM — Diabete pré-existente diagnosticado na gestação',
      texto: `Diagnóstico de Diabete pré-existente diagnosticado durante a gestação.`,
      labelKey: 'gtt.diag.overtLabel',
      textoKey: 'gtt.diag.overtTexto',
      cor: 'text-red-800',
      bgColor: 'bg-[#FEE2E2]',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      cenario: '8',
      statusFicha: 'dmg_confirmado',
    };
  }

  const jejumAlterado = jejum >= 92;
  const h1Alterado = h1 != null && h1 >= 180;
  const h2Alterado = h2 != null && h2 >= 153;

  if (jejumAlterado || h1Alterado || h2Alterado) {
    const cenario = (igSemanas ?? 0) > 28 ? '6B' : '6';
    return {
      tipo: 'positivo',
      label: 'GTT 75g ALTERADO — Diagnóstico de DMG confirmado',
      texto: recursoLimitado
        ? `Diagnóstico realizado em cenário de recurso limitado (sem GTT 75g completo). Este método alcança aproximadamente 66% dos diagnósticos — cerca de 34% dos casos podem não ser detectados.`
        : `Qualquer valor alterado no GTT 75g já confirma o diagnóstico de Diabete Mellitus Gestacional.`,
      labelKey: 'gtt.diag.positivoLabel',
      textoKey: recursoLimitado ? 'gtt.diag.positivoTextoRecursoLimitado' : 'gtt.diag.positivoTexto',
      cor: 'text-orange-800',
      bgColor: 'bg-[#FEF3C7]',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      cenario,
      statusFicha: 'dmg_confirmado',
    };
  }

  return {
    tipo: 'negativo',
    label: 'GTT 75g NORMAL — DMG afastado',
    texto: recursoLimitado
      ? 'Glicemia de jejum dentro dos parâmetros normais. O diagnóstico de DMG está afastado neste exame. Nota: sem o GTT 75g completo, cerca de 34% dos casos podem não ser detectados.'
      : 'Todos os valores do GTT 75g estão dentro dos parâmetros normais. O diagnóstico de Diabete Mellitus Gestacional está AFASTADO. Seguir pré-natal normal.',
    labelKey: 'gtt.diag.negativoLabel',
    textoKey: recursoLimitado ? 'gtt.diag.negativoTextoRecursoLimitado' : 'gtt.diag.negativoTexto',
    cor: 'text-emerald-800',
    bgColor: 'bg-[#DCFCE7]',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    cenario: null,
    statusFicha: 'dmg_afastado',
  };
}

interface GttFormProps {
  paciente: PreviewPaciente;
  consultas: PreviewConsulta[];
  isPreview: boolean;
  onSaved: () => void;
  onCancel: () => void;
  editingConsulta?: PreviewConsulta | null;
}

export default function GttForm({
  paciente,
  consultas,
  isPreview,
  onSaved,
  onCancel,
  editingConsulta,
}: GttFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profissionalData } = useProfissionalData();

  const [recursoLimitado, setRecursoLimitado] = useState(editingConsulta?.gtt_recurso_limitado ?? false);
  const [valorJejum, setValorJejum] = useState(editingConsulta?.gtt_jejum != null ? String(editingConsulta.gtt_jejum) : '');
  const [valor1h, setValor1h] = useState(editingConsulta?.gtt_1h != null ? String(editingConsulta.gtt_1h) : '');
  const [valor2h, setValor2h] = useState(editingConsulta?.gtt_2h != null ? String(editingConsulta.gtt_2h) : '');
  const [dataExame, setDataExame] = useState(editingConsulta?.gtt_data_exame ?? todayISO());
  const [dataConsulta, setDataConsulta] = useState(editingConsulta?.data ?? todayISO());
  const [igSemanas, setIgSemanas] = useState(editingConsulta?.ig_semanas != null ? String(editingConsulta.ig_semanas) : '');
  const [igDias, setIgDias] = useState(editingConsulta?.ig_dias != null ? String(editingConsulta.ig_dias) : '');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [resultado, setResultado] = useState<GttDiagResult | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // 34C-B2: IG na data do GTT 75g vem da fonte única (RPC calcular_ig na
  // data do exame). Respeita a âncora vigente — sem DUM-diff local.
  const igCalculadaQuery = useIg(paciente.id, dataExame || null);
  const igCalculada = igCalculadaQuery.data ?? null;

  // 34D — pré-preenche a IG (ficha nova OU reabertura p/ editar) com o valor AO VIVO
  // na data do exame, calculado pela âncora ATUAL (não o congelado da época). Refaz
  // só quando a data muda (igPrefilledForDateRef); o refetch ao focar a aba não
  // sobrescreve o que o médico digitou. Sem âncora (igCalculada=null) mantém o seed.
  const igPrefilledForDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!igCalculada) return;
    if (igPrefilledForDateRef.current === dataExame) return;
    igPrefilledForDateRef.current = dataExame;
    setIgSemanas(String(igCalculada.semanas));
    setIgDias(String(igCalculada.dias));
  }, [igCalculada, dataExame]);

  // 34C-B2: "IG hoje" via fonte única — usada apenas para o texto da
  // recomendação ("ultrassom para datar..." se < 20s; senão "para crescimento").
  const hojeISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const igHojeQuery = useIg(paciente.id, hojeISO);
  const igHoje = igHojeQuery.data ?? null;

  const jejumNum = parseInt(valorJejum, 10);
  const h1Num = parseInt(valor1h, 10);
  const h2Num = parseInt(valor2h, 10);

  const jejumValido = !isNaN(jejumNum) && jejumNum >= 1 && jejumNum <= 400;
  const h1Valido = recursoLimitado || (!isNaN(h1Num) && h1Num >= 1 && h1Num <= 400);
  const h2Valido = recursoLimitado || (!isNaN(h2Num) && h2Num >= 1 && h2Num <= 400);

  const isValid = jejumValido && h1Valido && h2Valido && dataExame && dataConsulta;

  // 34B.2 — status + pendentes.
  const statusFichaLocal: string = editingConsulta?.status_ficha ?? 'rascunho';
  // Rascunho NÃO é sinalizado durante o preenchimento: badge "Rascunho" + banner de
  // pendentes só aparecem ao reabrir uma ficha JÁ salva (reflete o status real).
  const fichaPersistida = !!editingConsulta;
  const camposPendentes = useMemo<string[]>(() => {
    const f: string[] = [];
    if (!jejumValido) f.push(t('gtt.pendentes.glicemiaJejum'));
    if (!recursoLimitado) {
      if (!h1Valido) f.push(t('gtt.pendentes.glicemia1h'));
      if (!h2Valido) f.push(t('gtt.pendentes.glicemia2h'));
    }
    if (!dataExame) f.push(t('gtt.pendentes.dataExame'));
    if (!dataConsulta) f.push(t('gtt.pendentes.dataConsulta'));
    return f;
  }, [jejumValido, h1Valido, h2Valido, recursoLimitado, dataExame, dataConsulta, t]);

  // 34B.3 seção 3.10 — bloqueia submit se data inválida.
  const [dataExameValida, setDataExameValida] = useState(true);
  const [dataConsultaValida, setDataConsultaValida] = useState(true);
  const todasDatasValidas = dataExameValida && dataConsultaValida;


  const igFinal = useMemo(() => {
    const s = parseInt(igSemanas, 10);
    if (!isNaN(s)) return { semanas: s, dias: parseInt(igDias, 10) || 0 };
    return igCalculada;
  }, [igSemanas, igDias, igCalculada]);

  // 34B.1 — Bug A: useAutosave removido. Persistência só via submit explícito (handleSubmit).
  const draftConsultaIdRef = useRef<string | null>(editingConsulta?.id ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) {
      toast.error(t('gtt.toast.fillRequired'));
      return;
    }

    setSaving(true);

    const diag = calcularGttDiagnostico(
      jejumNum,
      recursoLimitado ? null : h1Num,
      recursoLimitado ? null : h2Num,
      recursoLimitado,
      igFinal?.semanas ?? null,
    );

    if (isPreview) {
      const current = getPreviewPacienteById(paciente.id);
      if (current) {
        const obsText = [
          `GTT 75g: jejum ${jejumNum}`,
          !recursoLimitado ? `1h ${h1Num}` : null,
          !recursoLimitado ? `2h ${h2Num}` : null,
          recursoLimitado ? '(recurso limitado)' : null,
          `— ${diag.label}`,
          observacoes.trim() ? `| ${observacoes.trim()}` : null,
        ].filter(Boolean).join(', ');

        if (editingConsulta) {
          // Update existing consultation
          const updatedConsultas = (current.consultas || []).map(c =>
            c.id === editingConsulta.id
              ? {
                  ...c,
                  data: dataConsulta,
                  ig_semanas: igFinal?.semanas ?? null,
                  ig_dias: igFinal?.dias ?? null,
                  observacoes: obsText,
                  status_gerado: diag.statusFicha,
                  gtt_jejum: jejumNum,
                  gtt_1h: recursoLimitado ? null : h1Num,
                  gtt_2h: recursoLimitado ? null : h2Num,
                  gtt_recurso_limitado: recursoLimitado,
                  gtt_data_exame: dataExame,
                  cenario_clinico: diag.cenario,
                }
              : c
          );
          updatePreviewPaciente(paciente.id, {
            status_ficha: diag.statusFicha,
            data_ultima_consulta: dataConsulta,
            consultas: updatedConsultas,
          });
        } else {
          const newConsulta: PreviewConsulta = {
            id: crypto.randomUUID(),
            tipo: 'gtt',
            numero_sequencial: (current.consultas?.length || 1) + 1,
            data: dataConsulta,
            ig_semanas: igFinal?.semanas ?? null,
            ig_dias: igFinal?.dias ?? null,
            observacoes: obsText,
            status_gerado: diag.statusFicha,
            gtt_jejum: jejumNum,
            gtt_1h: recursoLimitado ? null : h1Num,
            gtt_2h: recursoLimitado ? null : h2Num,
            gtt_recurso_limitado: recursoLimitado,
            gtt_data_exame: dataExame,
            cenario_clinico: diag.cenario,
          };

          updatePreviewPaciente(paciente.id, {
            status_ficha: diag.statusFicha,
            data_ultima_consulta: dataConsulta,
            consultas: [...(current.consultas || []), newConsulta],
          });
        }
        window.dispatchEvent(new Event('preview-pacientes-updated'));
      }

      setSaving(false);
      setResultado(diag);
      if (diag.tipo !== 'negativo') {
        setShowPopup(true);
      }
      return;
    }

    // Real mode
    if (!profissionalData || !user) {
      toast.error(t('gtt.toast.mustBeLoggedIn'));
      setSaving(false);
      return;
    }

    const consultaPayload = {
      paciente_id: paciente.id,
      profissional_id: profissionalData.id,
      tipo: 'gtt',
      numero_sequencial: (consultas.length || 1) + 1,
      data: dataConsulta,
      ig_semanas: igFinal?.semanas ?? null,
      ig_dias: igFinal?.dias ?? null,
      observacoes: `GTT 75g: jejum ${jejumNum}${!recursoLimitado ? `, 1h ${h1Num}, 2h ${h2Num}` : ' (recurso limitado)'}. ${diag.label}.`,
      status_gerado: diag.statusFicha,
      cenario_clinico: diag.cenario,
      is_rascunho: false,
      // 34B.2 — finaliza ficha. Default do banco era 'rascunho' até este save.
      status_ficha: 'completa',
    };

    let consErr: unknown = null;
    let novaConsultaId: string | null = null;
    if (draftConsultaIdRef.current) {
      const { error } = await supabase
        .from('consultas').update(consultaPayload as any).eq('id', draftConsultaIdRef.current);
      consErr = error;
    } else {
      const { data: novaCons, error } = await supabase
        .from('consultas').insert(consultaPayload as any).select('id').single();
      consErr = error;
      novaConsultaId = novaCons?.id ?? null;
    }

    if (consErr) {
      toast.error(t('gtt.toast.consultaError'));
      console.error(consErr);
      setSaving(false);
      return;
    }

    // PROMPT 38A — persistir GTT 75g em estrutura consultável (exames_glicemia, tipo_exame='gtt')
    // Antes ficava apenas no texto livre de consultas.observacoes.
    // Recupera o consulta_id (insert acima não retornou; busca pelo draft ou pelo único GTT 75g desta consulta)
    let gttConsultaId: string | null = draftConsultaIdRef.current ?? novaConsultaId;
    if (!gttConsultaId) {
      const { data: cRow } = await supabase
        .from('consultas')
        .select('id')
        .eq('paciente_id', paciente.id)
        .eq('tipo', 'gtt')
        .eq('data', dataConsulta)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      gttConsultaId = cRow?.id ?? null;
    }

    if (gttConsultaId) {
      // 1 GTT 75g por consulta — apaga linha anterior (idempotente em edição)
      await supabase
        .from('exames_glicemia')
        .delete()
        .eq('consulta_id', gttConsultaId)
        .eq('tipo_exame', 'gtt');

      const examePayload = {
        consulta_id: gttConsultaId,
        paciente_id: paciente.id,
        profissional_id: profissionalData.id,
        tipo_exame: 'gtt',
        data_exame: dataConsulta,
        ig_semanas_na_data: igFinal?.semanas ?? null,
        ig_dias_na_data: igFinal?.dias ?? null,
        // valor_mgdl mantido por compat (queries existentes filtram tipo_exame='gtt' e leem valor_mgdl)
        valor_mgdl: jejumNum,
        gtt_jejum: jejumNum,
        gtt_1h: recursoLimitado ? null : h1Num,
        gtt_2h: recursoLimitado ? null : h2Num,
        gtt_recurso_limitado: recursoLimitado,
      };
      const { error: examErr } = await supabase
        .from('exames_glicemia')
        .insert(examePayload as any);
      if (examErr) {
        console.error('Erro ao persistir GTT 75g estruturado:', examErr);
        // não bloqueia o save da consulta — observacoes já preservou o histórico
      }
    }

    await supabase.from('pacientes').update({
      status_ficha: diag.statusFicha,
      data_ultima_consulta: dataConsulta,
    }).eq('id', paciente.id);

    const { carimbarAtendimento } = await import('@/lib/carimbar');
    await carimbarAtendimento({
      pacienteId: paciente.id,
      // 40B (3.4): criação carimba só no 1º save; reabrir/reeditar → reabrir_consulta
      tipoOperacao: editingConsulta ? 'reabrir_consulta' : 'preencher_gtt',
      recursoId: gttConsultaId ?? undefined,
      recursoTipo: editingConsulta ? 'consulta' : 'gtt',
    });

    // Persiste o laudo desta consulta → contador + histórico. Fire-and-forget,
    // não-bloqueante (idempotente por consulta; institucional é ilimitado).
    const laudoConsultaId = gttConsultaId;
    if (laudoConsultaId) {
      void import('@/lib/registrarLaudo').then(({ registrarLaudo }) =>
        registrarLaudo(paciente.id, laudoConsultaId),
      );
    }

    setSaving(false);
    setResultado(diag);
    if (diag.tipo !== 'negativo') {
      setShowPopup(true);
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    onSaved();
  };

  const fieldError = (valid: boolean) =>
    touched && !valid ? 'border-destructive ring-1 ring-destructive' : '';

  const errorMsg = (valid: boolean) =>
    touched && !valid ? (
      <span className="text-xs text-destructive">{t('gtt.requiredField')}</span>
    ) : null;

  // Build values table for result
  const buildValoresTable = () => {
    const valores: { label: string; valor: number; meta: string; alterado: boolean }[] = [
      { label: t('gtt.valores.jejum'), valor: jejumNum, meta: '< 92 mg/dL', alterado: jejumNum >= 92 },
    ];
    if (!recursoLimitado) {
      valores.push({ label: t('gtt.valores.pos1h'), valor: h1Num, meta: '< 180 mg/dL', alterado: h1Num >= 180 });
      valores.push({ label: t('gtt.valores.pos2h'), valor: h2Num, meta: '< 153 mg/dL', alterado: h2Num >= 153 });
    }
    return valores;
  };

  // ── Result view ──
  if (resultado) {
    const valores = buildValoresTable();
    const isTardio = resultado.cenario === '6B';

    return (
      <div className="space-y-4">
        {/* Values table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-foreground">{t('gtt.tabela.dosagem')}</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.tabela.resultado')}</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.tabela.meta')}</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.tabela.status')}</th>
              </tr>
            </thead>
            <tbody>
              {valores.map((v) => (
                <tr key={v.label} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{v.label}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${v.alterado ? 'text-red-600' : 'text-emerald-600'}`}>
                    {v.valor} mg/dL
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{v.meta}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.alterado ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {v.alterado ? t('gtt.status.alterado') : t('gtt.status.normal')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recursoLimitado && (
          <div className="rounded-lg border border-amber-200 bg-[#FEF3C7] p-3">
            <p className="text-xs text-amber-800">
              <strong>{t('gtt.recursoLimitado.resultTitle')}</strong> {t('gtt.recursoLimitado.resultText')}
            </p>
          </div>
        )}

        {/* Result card */}
        <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5 space-y-4`}>
          <div className="flex items-start gap-3">
            {resultado.tipo === 'negativo' ? (
              <CheckCircle2 className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
            ) : (
              <AlertTriangle className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
            )}
            <div>
              <h2 className={`text-base font-bold ${resultado.cor}`}>{t(resultado.labelKey)}</h2>
              <p className={`mt-1 text-sm ${resultado.cor}`}>{t(resultado.textoKey)}</p>
            </div>
          </div>

          {isTardio && (
            <div className="rounded-lg bg-red-100/80 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-800">
                {t('gtt.diagnosticoTardio')}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-white/70 p-4 space-y-2">
            <p className={`text-sm font-semibold ${resultado.cor}`}>{t('gtt.conduta.title')}</p>
            {resultado.tipo === 'negativo' ? (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>{t('gtt.conduta.negativo1')}</li>
                <li>{t('gtt.conduta.negativo2')}</li>
              </ul>
            ) : (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>{t('gtt.conduta.positivo1')}</li>
                <li>{t('gtt.conduta.positivo2')}</li>
                <li>{t('gtt.conduta.positivo3')}</li>
                <li>{t('gtt.conduta.positivoUsg')}{igHoje && igHoje.semanas < 20 ? t('gtt.conduta.usgDatar') : t('gtt.conduta.usgCrescimento')}</li>
              </ul>
            )}
          </div>

          {/* Placeholder Blocos 2 e 3 */}
          <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
            <p className="text-sm font-bold text-foreground">{t('gtt.laudoCompleto.title')}</p>
            <p className="text-xs italic text-[#94A3B8]">{t('gtt.laudoCompleto.bloco2')}</p>
            <p className="text-xs italic text-[#94A3B8]">{t('gtt.laudoCompleto.bloco3')}</p>
          </div>
        </div>

        {/* Notas técnicas */}
        <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
          <p className="text-sm font-semibold text-foreground mb-2">{t('gtt.notasTecnicas.title')}</p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
            <li>{t('gtt.notasTecnicas.nota1')}</li>
            <li>{t('gtt.notasTecnicas.nota2')}</li>
            <li>{t('gtt.notasTecnicas.nota3')}</li>
            <li>{t('gtt.notasTecnicas.nota4')}</li>
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Printer className="h-3.5 w-3.5" />
          <span>{t('gtt.printHint')}</span>
        </div>

        {/* Impact popup — only for positive/overt */}
        <AlertDialog open={showPopup}>
          <AlertDialogContent className={`border-2 ${resultado.tipo === 'positivo' ? 'border-orange-400' : 'border-red-400'}`}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-lg">
                <span className={`flex items-center justify-center gap-2 ${resultado.tipo === 'positivo' ? 'text-orange-600' : 'text-red-600'}`}>
                  <XCircle className="h-5 w-5" />
                  {resultado.tipo === 'positivo'
                    ? t('gtt.popup.positivo')
                    : t('gtt.popup.overt')}
                </span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-base font-medium text-foreground">
                {t('gtt.popup.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction
                onClick={handlePopupClose}
                className={resultado.tipo === 'positivo' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}
              >
                {t('gtt.popup.action')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Form view ──
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">
            {t('gtt.formTitle')}
          </h2>
          {fichaPersistida && <StatusFichaBadge status={statusFichaLocal} />}
        </div>
        <CamposPendentesBanner
          pendentes={camposPendentes}
          ativo={fichaPersistida && statusFichaLocal === 'rascunho'}
        />


        {/* Recurso limitado checkbox */}
        <div className={`rounded-lg border-2 p-4 transition-colors ${recursoLimitado ? 'border-amber-400 bg-amber-50/50' : 'border-border bg-card'}`}>
          <div className="flex items-start gap-3">
            <Checkbox
              id="recurso-limitado"
              checked={recursoLimitado}
              onCheckedChange={(checked) => {
                setRecursoLimitado(!!checked);
                if (checked) {
                  setValor1h('');
                  setValor2h('');
                }
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="recurso-limitado" className="text-sm font-medium text-foreground cursor-pointer">
                {t('gtt.recursoLimitado.checkboxLabel')}
              </Label>
              {recursoLimitado && (
                <div className="rounded-lg border border-amber-200 bg-[#FEF3C7] p-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-amber-800">
                    <strong>{t('gtt.recursoLimitado.warningTitle')}</strong> {t('gtt.recursoLimitado.warningText')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* IG na data do GTT 75g */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">{t('gtt.ig.label')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('gtt.ig.tooltipPre')} {descreverReferenciaIg(igCalculada)} {t('gtt.ig.tooltipPost')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={45}
              value={igSemanas}
              onChange={(e) => setIgSemanas(e.target.value)}
              placeholder={t('gtt.ig.weeksPlaceholder')}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{t('gtt.ig.weeks')}</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={igDias}
              onChange={(e) => setIgDias(e.target.value)}
              placeholder={t('gtt.ig.daysPlaceholder')}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{t('gtt.ig.days')}</span>
          </div>
        </div>

        {/* Glicemia de jejum */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">{t('gtt.jejum.label')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('gtt.jejum.tooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            min={1}
            max={400}
            value={valorJejum}
            onChange={(e) => setValorJejum(e.target.value)}
            placeholder={t('gtt.jejum.placeholder')}
            className={fieldError(jejumValido)}
          />
          {errorMsg(jejumValido)}
        </div>

        {/* 1h pós-sobrecarga — hidden when recurso limitado */}
        {!recursoLimitado && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-foreground">{t('gtt.pos1h.label')}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {t('gtt.pos1h.tooltip')}
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              type="number"
              min={1}
              max={400}
              value={valor1h}
              onChange={(e) => setValor1h(e.target.value)}
              placeholder={t('gtt.pos1h.placeholder')}
              className={fieldError(h1Valido)}
            />
            {errorMsg(h1Valido)}
          </div>
        )}

        {/* 2h pós-sobrecarga — hidden when recurso limitado */}
        {!recursoLimitado && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-foreground">{t('gtt.pos2h.label')}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {t('gtt.pos2h.tooltip')}
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              type="number"
              min={1}
              max={400}
              value={valor2h}
              onChange={(e) => setValor2h(e.target.value)}
              placeholder={t('gtt.pos2h.placeholder')}
              className={fieldError(h2Valido)}
            />
            {errorMsg(h2Valido)}
          </div>
        )}

        {/* Data do exame */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">{t('gtt.dataExame.label')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('gtt.dataExame.tooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <DateInput
            value={dataExame}
            onChange={setDataExame}
            onValidityChange={setDataExameValida}
            className={fieldError(!!dataExame)}
          />
        </div>

        {/* Data da consulta de retorno */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">{t('gtt.dataConsulta.label')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('gtt.dataConsulta.tooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <DateInput
            value={dataConsulta}
            onChange={setDataConsulta}
            onValidityChange={setDataConsultaValida}
            className={fieldError(!!dataConsulta)}
          />
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">{t('gtt.observacoes.label')}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {t('gtt.observacoes.tooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder={t('gtt.observacoes.placeholder')}
            rows={3}
          />
        </div>

        {/* Reference table — diagnostic criteria */}
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">{t('gtt.ref.title')}</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-foreground">{t('gtt.ref.dosagem')}</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.ref.normal')}</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.ref.dmg')}</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">{t('gtt.ref.overt')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{t('gtt.ref.jejum')}</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 92</td>
                  <td className="px-3 py-2 text-center text-orange-600">92–125</td>
                  <td className="px-3 py-2 text-center text-red-600">≥ 126</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{t('gtt.ref.pos1h')}</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 180</td>
                  <td className="px-3 py-2 text-center text-orange-600">≥ 180</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">—</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">{t('gtt.ref.pos2h')}</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 153</td>
                  <td className="px-3 py-2 text-center text-orange-600">153–199</td>
                  <td className="px-3 py-2 text-center text-red-600">≥ 200</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {t('gtt.ref.footnote')}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={saving}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={saving || !todasDatasValidas}
          className="flex-1 bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('gtt.saveButton')}
        </Button>
      </div>
    </form>
  );
}
