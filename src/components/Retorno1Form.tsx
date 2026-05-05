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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Info, Loader2, AlertTriangle, CheckCircle2, XCircle, Printer, Pencil, FileText } from 'lucide-react';
import { differenceInDays, addDays, format } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';

function todayISO() {
  return todayLocalISO();
}

type DiagnosticoResult = {
  tipo: 'negativo' | 'positivo' | 'overt';
  label: string;
  texto: string;
  cor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  cenario: number | null;
  statusFicha: string;
};

function calcularDiagnostico(valor: number): DiagnosticoResult {
  if (valor < 92) {
    return {
      tipo: 'negativo',
      label: 'Resultado: NEGATIVO — Normoglicemia',
      texto: `Glicemia de jejum: ${valor} mg/dL. NÃO há diagnóstico de Diabete Mellitus Gestacional neste momento.`,
      cor: 'text-emerald-800',
      bgColor: 'bg-[#DCFCE7]',
      borderColor: 'border-emerald-200',
      iconColor: 'text-emerald-600',
      cenario: null,
      statusFicha: 'aguardando_gtt',
    };
  }
  if (valor < 126) {
    return {
      tipo: 'positivo',
      label: 'Resultado: POSITIVO — Diabete Mellitus Gestacional',
      texto: `Glicemia de jejum: ${valor} mg/dL. Diagnóstico CONFIRMADO de DMG.`,
      cor: 'text-orange-800',
      bgColor: 'bg-[#FEF3C7]',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      cenario: 1,
      statusFicha: 'dmg_confirmado',
    };
  }
  return {
    tipo: 'overt',
    label: 'Resultado: OVERT DIABETES — Diabete pré-existente',
    texto: `Glicemia de jejum: ${valor} mg/dL. Diagnóstico de Diabete pré-existente diagnosticado durante a gestação.`,
    cor: 'text-red-800',
    bgColor: 'bg-[#FEE2E2]',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    cenario: 8,
    statusFicha: 'dmg_confirmado',
  };
}

interface Retorno1FormProps {
  paciente: PreviewPaciente;
  primeiraConsulta: PreviewConsulta;
  isPreview: boolean;
  onSaved: () => void;
  onCancel: () => void;
  isLastConsulta?: boolean;
  editingConsulta?: PreviewConsulta | null;
}

export default function Retorno1Form({
  paciente,
  primeiraConsulta,
  isPreview,
  onSaved,
  onCancel,
  isLastConsulta = true,
  editingConsulta,
}: Retorno1FormProps) {
  const { user } = useAuth();
  const { profissionalData } = useProfissionalData();

  const [valorGJ, setValorGJ] = useState(editingConsulta?.retorno1_valor_gj != null ? String(editingConsulta.retorno1_valor_gj) : '');
  const [tipoExame, setTipoExame] = useState(editingConsulta?.retorno1_tipo_exame ?? '');
  const [dataExame, setDataExame] = useState(editingConsulta?.retorno1_data_exame ?? todayISO());
  const [dataConsultaRetorno, setDataConsultaRetorno] = useState(editingConsulta?.data ?? todayISO());
  const [observacoes, setObservacoes] = useState('');
  const [igSemanas, setIgSemanas] = useState(editingConsulta?.ig_semanas != null ? String(editingConsulta.ig_semanas) : '');
  const [igDias, setIgDias] = useState(editingConsulta?.ig_dias != null ? String(editingConsulta.ig_dias) : '');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Result state
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Edit mode state
  const [editingResult, setEditingResult] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const isCapilar = tipoExame === 'capilar';

  // Calculate IG at exam date based on DUM
  const igCalculada = useMemo(() => {
    if (!paciente.dum || !dataExame) return null;
    const exam = parseDateLocal(dataExame);
    const dum = parseDateLocal(paciente.dum);
    if (!exam || !dum) return null;
    const dias = differenceInDays(exam, dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum, dataExame]);

  // P1: Auto-fill IG fields when dataExame changes
  useEffect(() => {
    if (igCalculada && !editingResult && !editingConsulta) {
      setIgSemanas(String(igCalculada.semanas));
      setIgDias(String(igCalculada.dias));
    }
  }, [igCalculada, editingResult, editingConsulta]);

  // DUM-based GTT window calc for negative result
  const janelaGTT = useMemo(() => {
    if (!paciente.dum) return null;
    const dumDate = parseDateLocal(paciente.dum);
    if (!dumDate) return null;
    const inicio = addDays(dumDate, 24 * 7);
    const fim = addDays(dumDate, 28 * 7);
    return { inicio, fim };
  }, [paciente.dum]);

  const igHoje = useMemo(() => {
    if (!paciente.dum) return null;
    const dum = parseDateLocal(paciente.dum);
    if (!dum) return null;
    const dias = differenceInDays(new Date(), dum);
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum]);

  const igMaior24 = igHoje ? igHoje.semanas >= 24 : false;

  const valorNum = parseInt(valorGJ, 10);
  const valorValido = !isNaN(valorNum) && valorNum >= 1 && valorNum <= 400;
  const isValid = valorValido && tipoExame && dataExame && dataConsultaRetorno;

  const igFinal = useMemo(() => {
    const s = parseInt(igSemanas, 10);
    if (!isNaN(s)) return { semanas: s, dias: parseInt(igDias, 10) || 0 };
    return igCalculada;
  }, [igSemanas, igDias, igCalculada]);

  // Autosave: rascunho de consulta + exame_glicemia (modo real, novo retorno)
  const draftConsultaIdRef = useRef<string | null>(null);
  const draftExameIdRef = useRef<string | null>(null);

  const canAutosave =
    !isPreview &&
    !editingConsulta &&
    !!profissionalData &&
    !!user &&
    valorValido &&
    !!tipoExame &&
    !saving;

  const autosaveData = useMemo(
    () => ({
      valorNum,
      tipoExame,
      dataExame,
      dataConsultaRetorno,
      observacoes: observacoes.trim(),
      igSemanas: igFinal?.semanas ?? null,
      igDias: igFinal?.dias ?? null,
    }),
    [valorNum, tipoExame, dataExame, dataConsultaRetorno, observacoes, igFinal],
  );

  const { status: autosaveStatus } = useAutosave({
    data: autosaveData,
    enabled: canAutosave,
    onSave: async (d) => {
      if (!profissionalData) return;
      const consultaPayload = {
        paciente_id: paciente.id,
        profissional_id: profissionalData.id,
        tipo: 'retorno_1',
        numero_sequencial: 2,
        data: d.dataConsultaRetorno,
        ig_semanas: d.igSemanas,
        ig_dias: d.igDias,
        observacoes: d.observacoes || null,
        status_gerado: paciente.status_ficha,
        is_rascunho: true,
      };
      if (!draftConsultaIdRef.current) {
        const { data: cons, error } = await supabase
          .from('consultas').insert(consultaPayload as any).select('id').single();
        if (error || !cons) throw error ?? new Error('Falha rascunho consulta');
        draftConsultaIdRef.current = cons.id;
      } else {
        const { error } = await supabase
          .from('consultas').update(consultaPayload as any).eq('id', draftConsultaIdRef.current);
        if (error) throw error;
      }

      const examePayload = {
        consulta_id: draftConsultaIdRef.current,
        paciente_id: paciente.id,
        profissional_id: profissionalData.id,
        valor_mgdl: d.valorNum,
        tipo_exame: d.tipoExame,
        data_exame: d.dataExame,
        ig_semanas_na_data: d.igSemanas,
        ig_dias_na_data: d.igDias,
      };
      if (!draftExameIdRef.current) {
        const { data: ex, error } = await supabase
          .from('exames_glicemia' as any).insert(examePayload as any).select('id').single();
        if (error || !ex) throw error ?? new Error('Falha rascunho exame');
        draftExameIdRef.current = (ex as any).id;
      } else {
        const { error } = await supabase
          .from('exames_glicemia' as any).update(examePayload as any).eq('id', draftExameIdRef.current);
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

    const isDiagApplicable = tipoExame === 'plasmatica';
    const diag = isDiagApplicable ? calcularDiagnostico(valorNum) : null;
    const newStatus = isDiagApplicable && diag ? diag.statusFicha : paciente.status_ficha;

    if (isPreview) {
      const current = getPreviewPacienteById(paciente.id);
      if (current) {
        const buildObs = () => observacoes.trim()
          ? `GJ: ${valorNum} mg/dL (${tipoExame}). ${isDiagApplicable && diag ? diag.label : 'Método não válido para diagnóstico.'}${observacoes.trim() ? ' | ' + observacoes.trim() : ''}`
          : isDiagApplicable && diag
            ? `GJ: ${valorNum} mg/dL (plasmática). ${diag.label}.`
            : `GJ: ${valorNum} mg/dL (capilar). Método não válido para diagnóstico.`;

        if (editingConsulta) {
          // Update existing consultation
          const updatedConsultas = (current.consultas || []).map(c =>
            c.id === editingConsulta.id
              ? {
                  ...c,
                  data: dataConsultaRetorno,
                  ig_semanas: igFinal?.semanas ?? null,
                  ig_dias: igFinal?.dias ?? null,
                  observacoes: buildObs(),
                  status_gerado: newStatus,
                  retorno1_valor_gj: valorNum,
                  retorno1_tipo_exame: tipoExame,
                  retorno1_data_exame: dataExame,
                }
              : c
          );
          updatePreviewPaciente(paciente.id, {
            status_ficha: newStatus,
            data_ultima_consulta: dataConsultaRetorno,
            consultas: updatedConsultas,
          });
        } else {
          const newConsulta: PreviewConsulta = {
            id: crypto.randomUUID(),
            tipo: 'retorno_1',
            numero_sequencial: (current.consultas?.length || 1) + 1,
            data: dataConsultaRetorno,
            ig_semanas: igFinal?.semanas ?? null,
            ig_dias: igFinal?.dias ?? null,
            observacoes: buildObs(),
            status_gerado: newStatus,
            retorno1_valor_gj: valorNum,
            retorno1_tipo_exame: tipoExame,
            retorno1_data_exame: dataExame,
          };
          updatePreviewPaciente(paciente.id, {
            status_ficha: newStatus,
            data_ultima_consulta: dataConsultaRetorno,
            consultas: [...(current.consultas || []), newConsulta],
          });
        }
        window.dispatchEvent(new Event('preview-pacientes-updated'));
      }

      setSaving(false);

      if (isDiagApplicable && diag) {
        setResultado(diag);
        setShowPopup(true);
      } else {
        toast.success('Retorno registrado. Aguardando glicemia plasmática para diagnóstico.');
        onSaved();
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
      tipo: 'retorno_1',
      numero_sequencial: 2,
      data: dataConsultaRetorno,
      ig_semanas: igFinal?.semanas ?? null,
      ig_dias: igFinal?.dias ?? null,
      observacoes: observacoes.trim()
        ? `GJ: ${valorNum} mg/dL (${tipoExame}). ${isDiagApplicable && diag ? diag.label : 'Método não válido.'}${observacoes.trim() ? ' | ' + observacoes.trim() : ''}`
        : isDiagApplicable && diag
          ? `GJ: ${valorNum} mg/dL (plasmática). ${diag.label}.`
          : `GJ: ${valorNum} mg/dL (capilar). Método não válido para diagnóstico.`,
      status_gerado: newStatus,
      cenario_clinico: isDiagApplicable && diag?.cenario ? String(diag.cenario) : null,
      is_rascunho: false,
    };

    let consultaId = draftConsultaIdRef.current;
    if (consultaId) {
      const { error } = await supabase
        .from('consultas').update(consultaPayload as any).eq('id', consultaId);
      if (error) {
        toast.error('Erro ao registrar consulta.');
        console.error(error);
        setSaving(false);
        return;
      }
    } else {
      const { data: consultaData, error: consErr } = await supabase
        .from('consultas').insert(consultaPayload as any).select('id').single();
      if (consErr || !consultaData) {
        toast.error('Erro ao registrar consulta.');
        console.error(consErr);
        setSaving(false);
        return;
      }
      consultaId = consultaData.id;
    }

    const examePayload = {
      consulta_id: consultaId,
      paciente_id: paciente.id,
      profissional_id: profissionalData.id,
      valor_mgdl: valorNum,
      tipo_exame: tipoExame,
      data_exame: dataExame,
      ig_semanas_na_data: igFinal?.semanas ?? null,
      ig_dias_na_data: igFinal?.dias ?? null,
    };
    if (draftExameIdRef.current) {
      await supabase.from('exames_glicemia' as any)
        .update(examePayload as any).eq('id', draftExameIdRef.current);
    } else {
      await supabase.from('exames_glicemia' as any).insert(examePayload as any);
    }

    await supabase.from('pacientes').update({
      status_ficha: newStatus,
      data_ultima_consulta: dataConsultaRetorno,
    }).eq('id', paciente.id);

    const { carimbarAtendimento } = await import('@/lib/carimbar');
    await carimbarAtendimento({
      pacienteId: paciente.id,
      tipoOperacao: 'retorno',
      recursoId: consultaId ?? undefined,
      recursoTipo: 'retorno',
    });

    setSaving(false);

    if (isDiagApplicable && diag) {
      setResultado(diag);
      setShowPopup(true);
    } else {
      toast.success('Retorno registrado. Aguardando glicemia plasmática.');
      onSaved();
    }
  };

  // P3: popup close keeps result visible, only refreshes parent data
  const handlePopupClose = () => {
    setShowPopup(false);
    // Refresh parent data in background but DON'T unmount this component
    onSaved();
  };

  // P2: Edit result
  const handleEditClick = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    setEditingResult(true);
    // Reset form to current values (resultado already has the info)
    setResultado(null);
  };

  const fieldError = (valid: boolean) =>
    touched && !valid ? 'border-destructive ring-1 ring-destructive' : '';

  const errorMsg = (valid: boolean) =>
    touched && !valid ? (
      <span className="text-xs text-destructive">Campo obrigatório</span>
    ) : null;

  // If we have a result, show the result card
  if (resultado) {
    return (
      <div className="space-y-4">
        {/* Result card */}
        <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5 space-y-4`}>
          <div className="flex items-start justify-between gap-3">
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

            {/* P2: Edit button — only if this is the most recent consultation */}
            {isLastConsulta && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditClick}
                className="shrink-0 text-muted-foreground hover:text-foreground gap-1"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-xs">Editar</span>
              </Button>
            )}
          </div>

          {/* Conduta */}
          <div className="rounded-lg bg-white/70 p-4 space-y-2">
            <p className={`text-sm font-semibold ${resultado.cor}`}>Conduta</p>

            {resultado.tipo === 'negativo' ? (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>Não repetir glicemia de jejum.</li>
                <li>Seguir pré-natal normal.</li>
                <li>
                  Realizar GTT 75g o mais próximo possível de 24 semanas — impreterivelmente antes de 28 semanas.
                  {janelaGTT && !igMaior24 && (
                    <> O GTT 75g deverá ser realizado o mais próximo possível da 24ª semana (entre{' '}
                      <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                      <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>).</>
                  )}
                  {igMaior24 && ' O GTT 75g já está na janela — solicitar o mais breve possível.'}
                </li>
              </ul>
            ) : (
              <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
                <li>Iniciar tratamento imediato — dieta + atividade física.</li>
                <li>Solicitar perfil glicêmico de 4 pontos diários por 7 a 10 dias (jejum + 1h pós café + 1h pós almoço + 1h pós jantar).</li>
                <li>Retorno em 7 a 10 dias com o perfil glicêmico preenchido.</li>
                <li>Solicitar ultrassom obstétrico{igHoje && igHoje.semanas < 20 ? ' para datar a gestação.' : ' para referência de crescimento fetal.'}</li>
              </ul>
            )}
          </div>

          {/* P4: Placeholder Blocos 2 e 3 — Laudo Completo */}
          <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
            <p className="text-sm font-bold text-foreground">Laudo Completo</p>
            <p className="text-xs italic text-[#94A3B8]">
              Bloco 2 — Justificativa Científica: será gerada em breve.
            </p>
            <p className="text-xs italic text-[#94A3B8]">
              Bloco 3 — Conduta Orientativa Personalizada: será gerada em breve.
            </p>
          </div>
        </div>

        {/* C3: Notas técnicas */}
        <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
          <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
            <li>Não repetir glicemia de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.</li>
            <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.</li>
            <li>Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.</li>
            <li>Se diagnóstico confirmado: iniciar tratamento imediato. O diagnóstico oportuno e correto salva vidas. Não espere, não repita — trate.</li>
          </ul>
        </div>

        {/* C3: Ctrl+P instruction */}
        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Printer className="h-3.5 w-3.5" />
          <span>Para salvar ou imprimir este laudo em PDF: pressione Ctrl+P (Windows) ou Cmd+P (Mac) e escolha "Salvar como PDF".</span>
        </div>

        {/* C4: Impact pop-up */}
        <AlertDialog open={showPopup}>
          <AlertDialogContent className={`border-2 ${resultado.tipo === 'negativo' ? 'border-[#7C4DBA]' : resultado.tipo === 'positivo' ? 'border-orange-400' : 'border-red-400'}`}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center text-lg">
                {resultado.tipo === 'negativo' ? (
                  <span className="flex items-center justify-center gap-2 text-[#7C4DBA]">
                    <AlertTriangle className="h-5 w-5" />
                    DMG negativo — próximo passo: GTT 75g
                  </span>
                ) : (
                  <span className={`flex items-center justify-center gap-2 ${resultado.tipo === 'positivo' ? 'text-orange-600' : 'text-red-600'}`}>
                    <XCircle className="h-5 w-5" />
                    {resultado.tipo === 'positivo'
                      ? 'POSITIVO — Diabete Mellitus Gestacional confirmado.'
                      : 'POSITIVO — Overt Diabetes (diabete prévio) confirmado.'}
                  </span>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-left text-sm text-foreground space-y-2">
                  {resultado.tipo === 'negativo' ? (
                    <>
                      <p>
                        <strong>Resultado: DMG NEGATIVO nesta etapa da gestação.</strong> O próximo ponto de controle é o GTT 75g, que deve ser realizado entre <strong>24 e 28 semanas</strong>.
                      </p>
                      {janelaGTT && !igMaior24 ? (
                        <p>
                          <strong>
                            Janela para realizar o GTT: {format(janelaGTT.inicio, 'dd/MM/yyyy')} a {format(janelaGTT.fim, 'dd/MM/yyyy')}.
                          </strong>{' '}
                          Oriente a paciente a agendar o exame desde já para não perder a janela de tempo.
                        </p>
                      ) : (
                        <p>
                          <strong>O GTT 75g já está na janela — solicitar o mais breve possível.</strong>
                        </p>
                      )}
                      <p className="font-medium">
                        Caso não seja realizado nesse período, realizar o mais breve possível.
                      </p>
                    </>
                  ) : (
                    <p className="text-center font-medium">
                      Não repetir o exame. É hora de tratar. Comece agora.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogAction
                onClick={handlePopupClose}
                className={resultado.tipo === 'negativo' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : resultado.tipo === 'positivo' ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}
              >
                {resultado.tipo === 'negativo' ? 'Entendi' : 'Entendi, ver laudo completo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* P2: Edit confirmation dialog */}
        <Dialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar resultado</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja alterar o resultado? O diagnóstico será recalculado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowEditConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmEdit}
                className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#7C4DBA] bg-[#F1F0FB] p-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
            <FileText className="h-5 w-5" />
            RETORNO 1 — Resultado da Glicemia de Jejum
          </h2>
          {!isPreview && !editingConsulta && <AutosaveIndicator status={autosaveStatus} />}
        </div>
        <p className="text-xs text-[#6D28D9]">
          Insira o resultado da glicemia de jejum para diagnóstico automático.
        </p>
      </div>

      {/* Capilar alert */}
      {isCapilar && (
        <div className="mt-4 rounded-lg border border-red-300 bg-[#FEE2E2] p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm font-medium text-red-800">
            ATENÇÃO: Glicemia capilar não é válida para diagnóstico de DMG. O protocolo exige glicemia plasmática. Oriente a paciente a refazer o exame com a metodologia correta.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {/* Resultado GJ */}
        <div className="space-y-2">
          <FieldLabel htmlFor="valor-gj" required tooltip="Insira o valor numérico exato do resultado do exame laboratorial. Ex: 94. Não arredonde.">
            Resultado da glicemia de jejum (mg/dL)
          </FieldLabel>
          <Input
            id="valor-gj"
            type="number"
            min="1"
            max="400"
            value={valorGJ}
            onChange={(e) => setValorGJ(e.target.value)}
            placeholder="Ex: 94"
            className={fieldError(valorValido || !valorGJ)}
          />
          {touched && valorGJ && !valorValido && (
            <span className="text-xs text-destructive">Valor deve ser entre 1 e 400 mg/dL</span>
          )}
          {errorMsg(!valorGJ && !valorValido)}
        </div>

        {/* Tipo de exame */}
        <div className="space-y-2">
          <FieldLabel required tooltip="Glicemia PLASMÁTICA é o único método válido para diagnóstico de DMG pelo protocolo Febrasgo/MS/OMS. Glicemia capilar (ponta de dedo) e CGM não são aceitos para diagnóstico.">
            Tipo de exame realizado
          </FieldLabel>
          <Select value={tipoExame} onValueChange={setTipoExame}>
            <SelectTrigger className={fieldError(!!tipoExame)}>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plasmatica">Plasmática (laboratório)</SelectItem>
              <SelectItem value="capilar">Capilar (ponta de dedo)</SelectItem>
            </SelectContent>
          </Select>
          {errorMsg(!!tipoExame)}
        </div>

        {/* Data do exame */}
        <div className="space-y-2">
          <FieldLabel htmlFor="data-exame" required tooltip="Data em que o exame foi coletado no laboratório.">
            Data do exame
          </FieldLabel>
          <Input
            id="data-exame"
            type="date"
            value={dataExame}
            onChange={(e) => setDataExame(e.target.value)}
            className={fieldError(!!dataExame)}
          />
          {errorMsg(!!dataExame)}
        </div>

        {/* P1: IG na data do exame — auto-filled */}
        <div className="space-y-2">
          <FieldLabel tooltip="Idade gestacional na data em que o exame foi coletado. Preenchida automaticamente com base na DUM. Edite manualmente se necessário.">
            IG na data do exame
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Semanas</Label>
              <Input
                type="number"
                min="0"
                max="42"
                value={igSemanas}
                onChange={(e) => setIgSemanas(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dias</Label>
              <Input
                type="number"
                min="0"
                max="6"
                value={igDias}
                onChange={(e) => setIgDias(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* C1: Data da consulta de retorno */}
        <div className="space-y-2">
          <FieldLabel htmlFor="data-consulta-retorno" required tooltip="Data do retorno da paciente. Preenchida automaticamente com a data de hoje. Edite se necessário.">
            Data da consulta de retorno
          </FieldLabel>
          <Input
            id="data-consulta-retorno"
            type="date"
            value={dataConsultaRetorno}
            onChange={(e) => setDataConsultaRetorno(e.target.value)}
            className={fieldError(!!dataConsultaRetorno)}
          />
          {errorMsg(!!dataConsultaRetorno)}
        </div>

        {/* C2: Observações */}
        <div className="space-y-2">
          <FieldLabel tooltip="Anotações adicionais sobre este retorno.">
            Observações
          </FieldLabel>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Anotações opcionais sobre este retorno"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar resultado
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  required,
  tooltip,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {children} {required && <span className="text-destructive">*</span>}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}
