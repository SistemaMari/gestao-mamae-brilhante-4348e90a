import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { useAutosave } from '@/hooks/useAutosave';
import AutosaveIndicator from '@/components/AutosaveIndicator';
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
import { differenceInDays } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';

function todayISO() {
  return todayLocalISO();
}

type GttDiagResult = {
  tipo: 'negativo' | 'positivo' | 'overt';
  label: string;
  texto: string;
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
      label: 'OVERT DIABETES — Diabete pré-existente diagnosticado na gestação',
      texto: `Diagnóstico de Diabete pré-existente diagnosticado durante a gestação.`,
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
      label: 'GTT ALTERADO — Diagnóstico de DMG confirmado',
      texto: recursoLimitado
        ? `Diagnóstico realizado em cenário de recurso limitado (sem GTT 75g completo). Este método alcança aproximadamente 66% dos diagnósticos — cerca de 34% dos casos podem não ser detectados.`
        : `Qualquer valor alterado no GTT 75g já confirma o diagnóstico de Diabete Mellitus Gestacional.`,
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
    label: 'GTT NORMAL — DMG afastado',
    texto: recursoLimitado
      ? 'Glicemia de jejum dentro dos parâmetros normais. O diagnóstico de DMG está afastado neste exame. Nota: sem o GTT completo, cerca de 34% dos casos podem não ser detectados.'
      : 'Todos os valores do GTT 75g estão dentro dos parâmetros normais. O diagnóstico de Diabete Mellitus Gestacional está AFASTADO. Seguir pré-natal normal.',
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

  // Calculate IG at exam date
  const igCalculada = useMemo(() => {
    if (!paciente.dum || !dataExame) return null;
    const exam = parseDateLocal(dataExame);
    const dum = parseDateLocal(paciente.dum);
    if (!exam || !dum) return null;
    const dias = differenceInDays(exam, dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum, dataExame]);

  useEffect(() => {
    if (igCalculada && !editingConsulta) {
      setIgSemanas(String(igCalculada.semanas));
      setIgDias(String(igCalculada.dias));
    }
  }, [igCalculada, editingConsulta]);

  const igHoje = useMemo(() => {
    if (!paciente.dum) return null;
    const dum = parseDateLocal(paciente.dum);
    if (!dum) return null;
    const dias = differenceInDays(new Date(), dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum]);

  const jejumNum = parseInt(valorJejum, 10);
  const h1Num = parseInt(valor1h, 10);
  const h2Num = parseInt(valor2h, 10);

  const jejumValido = !isNaN(jejumNum) && jejumNum >= 1 && jejumNum <= 400;
  const h1Valido = recursoLimitado || (!isNaN(h1Num) && h1Num >= 1 && h1Num <= 400);
  const h2Valido = recursoLimitado || (!isNaN(h2Num) && h2Num >= 1 && h2Num <= 400);

  const isValid = jejumValido && h1Valido && h2Valido && dataExame && dataConsulta;

  const igFinal = useMemo(() => {
    const s = parseInt(igSemanas, 10);
    if (!isNaN(s)) return { semanas: s, dias: parseInt(igDias, 10) || 0 };
    return igCalculada;
  }, [igSemanas, igDias, igCalculada]);

  // Autosave (modo real, novas consultas)
  const draftConsultaIdRef = useRef<string | null>(null);

  const canAutosave =
    !isPreview && !editingConsulta && !!profissionalData && !!user &&
    jejumValido && (recursoLimitado || (h1Valido && h2Valido)) && !saving;

  const autosaveData = useMemo(() => ({
    jejumNum, h1Num, h2Num, recursoLimitado, dataExame, dataConsulta,
    igSemanas: igFinal?.semanas ?? null, igDias: igFinal?.dias ?? null,
    observacoes: observacoes.trim(),
  }), [jejumNum, h1Num, h2Num, recursoLimitado, dataExame, dataConsulta, igFinal, observacoes]);

  const { status: autosaveStatus } = useAutosave({
    data: autosaveData,
    enabled: canAutosave,
    onSave: async (d) => {
      if (!profissionalData) return;
      const payload = {
        paciente_id: paciente.id,
        profissional_id: profissionalData.id,
        tipo: 'gtt',
        numero_sequencial: (consultas.length || 1) + 1,
        data: d.dataConsulta,
        ig_semanas: d.igSemanas,
        ig_dias: d.igDias,
        observacoes: `GTT 75g (rascunho): jejum ${d.jejumNum}${!d.recursoLimitado ? `, 1h ${d.h1Num}, 2h ${d.h2Num}` : ' (recurso limitado)'}.${d.observacoes ? ' ' + d.observacoes : ''}`,
        status_gerado: paciente.status_ficha,
        is_rascunho: true,
      };
      if (!draftConsultaIdRef.current) {
        const { data: c, error } = await supabase
          .from('consultas').insert(payload as any).select('id').single();
        if (error || !c) throw error ?? new Error('Falha consulta GTT');
        draftConsultaIdRef.current = c.id;
      } else {
        const { error } = await supabase
          .from('consultas').update(payload as any).eq('id', draftConsultaIdRef.current);
        if (error) throw error;
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) {
      toast.error('Preencha todos os campos obrigatórios.');
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
            tipo: 'retorno_gtt',
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
      toast.error('Você precisa estar logado.');
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
    };

    let consErr: unknown = null;
    if (draftConsultaIdRef.current) {
      const { error } = await supabase
        .from('consultas').update(consultaPayload as any).eq('id', draftConsultaIdRef.current);
      consErr = error;
    } else {
      const { error } = await supabase.from('consultas').insert(consultaPayload as any);
      consErr = error;
    }

    if (consErr) {
      toast.error('Erro ao registrar consulta.');
      console.error(consErr);
      setSaving(false);
      return;
    }

    // Note: exames_gtt table insert would go here in production
    await supabase.from('pacientes').update({
      status_ficha: diag.statusFicha,
      data_ultima_consulta: dataConsulta,
    }).eq('id', paciente.id);

    const { carimbarAtendimento } = await import('@/lib/carimbar');
    await carimbarAtendimento({
      pacienteId: paciente.id,
      tipoOperacao: 'preencher_gtt',
      recursoTipo: 'gtt',
    });

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
      <span className="text-xs text-destructive">Campo obrigatório</span>
    ) : null;

  // Build values table for result
  const buildValoresTable = () => {
    const valores: { label: string; valor: number; meta: string; alterado: boolean }[] = [
      { label: 'Glicemia de jejum', valor: jejumNum, meta: '< 92 mg/dL', alterado: jejumNum >= 92 },
    ];
    if (!recursoLimitado) {
      valores.push({ label: '1h pós-sobrecarga', valor: h1Num, meta: '< 180 mg/dL', alterado: h1Num >= 180 });
      valores.push({ label: '2h pós-sobrecarga', valor: h2Num, meta: '< 153 mg/dL', alterado: h2Num >= 153 });
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
                <th className="text-left px-3 py-2 font-medium text-foreground">Dosagem</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">Resultado</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">Meta</th>
                <th className="text-center px-3 py-2 font-medium text-foreground">Status</th>
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
                      {v.alterado ? 'ALTERADO' : 'NORMAL'}
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
              <strong>Recurso limitado:</strong> diagnóstico baseado apenas na glicemia de jejum (~66% detecção). ~34% dos casos podem não ser detectados.
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
              <h2 className={`text-base font-bold ${resultado.cor}`}>{resultado.label}</h2>
              <p className={`mt-1 text-sm ${resultado.cor}`}>{resultado.texto}</p>
            </div>
          </div>

          {isTardio && (
            <div className="rounded-lg bg-red-100/80 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-800">
                Diagnóstico tardio (IG &gt; 28 semanas) — início imediato do tratamento é crítico.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-white/70 p-4 space-y-2">
            <p className={`text-sm font-semibold ${resultado.cor}`}>Conduta</p>
            {resultado.tipo === 'negativo' ? (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>DMG afastado. Seguir pré-natal normal.</li>
                <li>Não há necessidade de repetir o exame.</li>
              </ul>
            ) : (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>Iniciar tratamento imediato — dieta + atividade física.</li>
                <li>Solicitar perfil glicêmico de 4 pontos diários por 7 a 10 dias.</li>
                <li>Retorno em 7 a 10 dias com o perfil glicêmico preenchido.</li>
                <li>Solicitar ultrassom obstétrico{igHoje && igHoje.semanas < 20 ? ' para datar a gestação.' : ' para referência de crescimento fetal.'}</li>
              </ul>
            )}
          </div>

          {/* Placeholder Blocos 2 e 3 */}
          <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
            <p className="text-sm font-bold text-foreground">Laudo Completo</p>
            <p className="text-xs italic text-[#94A3B8]">Bloco 2 — Justificativa Científica: será gerada em breve.</p>
            <p className="text-xs italic text-[#94A3B8]">Bloco 3 — Conduta Orientativa Personalizada: será gerada em breve.</p>
          </div>
        </div>

        {/* Notas técnicas */}
        <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
          <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
            <li>Não repetir glicemia de jejum para fins diagnósticos.</li>
            <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico.</li>
            <li>Glicemia capilar é utilizada apenas para acompanhamento — nunca para diagnóstico.</li>
            <li>Diagnóstico confirmado: iniciar tratamento imediato.</li>
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Printer className="h-3.5 w-3.5" />
          <span>Para salvar ou imprimir: Ctrl+P (Windows) ou Cmd+P (Mac) → "Salvar como PDF".</span>
        </div>

        {/* Impact popup — only for positive/overt */}
        <AlertDialog open={showPopup}>
          <AlertDialogContent className={`border-2 ${resultado.tipo === 'positivo' ? 'border-orange-400' : 'border-red-400'}`}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-lg">
                <span className={`flex items-center justify-center gap-2 ${resultado.tipo === 'positivo' ? 'text-orange-600' : 'text-red-600'}`}>
                  <XCircle className="h-5 w-5" />
                  {resultado.tipo === 'positivo'
                    ? 'POSITIVO — Diabete Mellitus Gestacional confirmado pelo GTT.'
                    : 'POSITIVO — Overt Diabetes (diabete prévio) confirmado.'}
                </span>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-base font-medium text-foreground">
                Não repetir o exame. É hora de tratar. Comece agora.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction
                onClick={handlePopupClose}
                className={resultado.tipo === 'positivo' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}
              >
                Entendi, ver laudo completo
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
        <h2 className="text-base font-bold text-foreground">
          GTT 75g — Teste de Tolerância à Glicose
        </h2>

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
                Paciente sem condição financeira/técnica para GTT 75g completo
              </Label>
              {recursoLimitado && (
                <div className="rounded-lg border border-amber-200 bg-[#FEF3C7] p-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-amber-800">
                    <strong>Atenção:</strong> sem o GTT completo, o diagnóstico é baseado apenas na glicemia de jejum, que alcança aproximadamente 66% dos diagnósticos. Cerca de 34% dos casos de DMG podem não ser detectados com este método isolado.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* IG na data do GTT */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">IG na data do GTT</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Idade gestacional em semanas + dias na data do exame. O GTT deve ser realizado o mais próximo possível de 24 semanas, impreterivelmente antes de 28 semanas. Caso não seja realizado nesse período, deve ser feito o mais breve possível — nunca abandonado.
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
              placeholder="Sem"
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">semanas</span>
            <Input
              type="number"
              min={0}
              max={6}
              value={igDias}
              onChange={(e) => setIgDias(e.target.value)}
              placeholder="Dias"
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
        </div>

        {/* Glicemia de jejum */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">Glicemia de jejum no GTT (mg/dL) *</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Primeira coleta do GTT — antes de ingerir a solução de glicose. Meta normal: &lt; 92 mg/dL.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            min={1}
            max={400}
            value={valorJejum}
            onChange={(e) => setValorJejum(e.target.value)}
            placeholder="Ex: 85"
            className={fieldError(jejumValido)}
          />
          {errorMsg(jejumValido)}
        </div>

        {/* 1h pós-sobrecarga — hidden when recurso limitado */}
        {!recursoLimitado && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-foreground">Glicemia 1h pós-sobrecarga (mg/dL) *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Coleta exatamente 1 hora após ingestão de 75g de glicose. Meta normal: &lt; 180 mg/dL.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              type="number"
              min={1}
              max={400}
              value={valor1h}
              onChange={(e) => setValor1h(e.target.value)}
              placeholder="Ex: 155"
              className={fieldError(h1Valido)}
            />
            {errorMsg(h1Valido)}
          </div>
        )}

        {/* 2h pós-sobrecarga — hidden when recurso limitado */}
        {!recursoLimitado && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-foreground">Glicemia 2h pós-sobrecarga (mg/dL) *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Coleta exatamente 2 horas após ingestão de 75g de glicose. Meta normal: &lt; 153 mg/dL.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              type="number"
              min={1}
              max={400}
              value={valor2h}
              onChange={(e) => setValor2h(e.target.value)}
              placeholder="Ex: 140"
              className={fieldError(h2Valido)}
            />
            {errorMsg(h2Valido)}
          </div>
        )}

        {/* Data do exame */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">Data do exame *</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Data em que o GTT foi realizado.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="date"
            value={dataExame}
            onChange={(e) => setDataExame(e.target.value)}
            className={fieldError(!!dataExame)}
          />
        </div>

        {/* Data da consulta de retorno */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">Data da consulta de retorno *</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Data do retorno. Default: hoje.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="date"
            value={dataConsulta}
            onChange={(e) => setDataConsulta(e.target.value)}
            className={fieldError(!!dataConsulta)}
          />
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium text-foreground">Observações</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Anotações adicionais.
              </TooltipContent>
            </Tooltip>
          </div>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
            rows={3}
          />
        </div>

        {/* Reference table — diagnostic criteria */}
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">Critérios diagnósticos — referência</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-foreground">Dosagem</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">Normal</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">DMG</th>
                  <th className="text-center px-3 py-2 font-medium text-foreground">Overt</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">Jejum</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 92</td>
                  <td className="px-3 py-2 text-center text-orange-600">92–125</td>
                  <td className="px-3 py-2 text-center text-red-600">≥ 126</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">1h pós</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 180</td>
                  <td className="px-3 py-2 text-center text-orange-600">≥ 180</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">—</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">2h pós</td>
                  <td className="px-3 py-2 text-center text-emerald-600">&lt; 153</td>
                  <td className="px-3 py-2 text-center text-orange-600">153–199</td>
                  <td className="px-3 py-2 text-center text-red-600">≥ 200</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Qualquer UMA das 3 amostras alterada já fecha diagnóstico de DMG.
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
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar GTT
        </Button>
      </div>
    </form>
  );
}
