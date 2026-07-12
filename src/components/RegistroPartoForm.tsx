import { useEffect, useMemo, useRef, useState } from 'react';
import { classificarRN } from '@/lib/intergrowth';

import { format } from 'date-fns';
import { todayLocalISO } from '@/lib/dateUtils';
import { useIg, descreverReferenciaIg } from '@/lib/getIg';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { FileText, Info, Loader2, Baby } from 'lucide-react';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
import StatusFichaBadge from '@/components/ficha/StatusFichaBadge';
import CamposPendentesBanner from '@/components/ficha/CamposPendentesBanner';
import DateInput from '@/components/ficha/DateInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreviewPacienteById, updatePreviewPaciente,
  type PreviewPaciente, type PreviewConsulta,
} from '@/lib/previewPatients';

type Props = {
  paciente: PreviewPaciente;
  consultas: PreviewConsulta[];
  isPreview: boolean;
  onSaved: () => void;
  onCancel: () => void;
};

type ViaParto = '' | 'vaginal' | 'cesarea';
type ClassRN = '' | 'AIG' | 'GIG' | 'PIG';
type SimNao = '' | 'sim' | 'nao';
type SexoRNState = '' | 'M' | 'F';
type ClassificacaoOrigem = 'auto' | 'manual' | 'fora-cobertura' | 'pendente';
type IgOrigem = 'auto' | 'manual';

/** Tooltip helper — ícone ⓘ ao lado do label */
function HelpIcon({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} aria-label={t('registroParto.moreInfo')}>
            <Info className="h-3.5 w-3.5 text-[#7C4DBA]" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function RegistroPartoForm({
  paciente, consultas, isPreview, onSaved, onCancel,
}: Props) {
  const { t } = useTranslation();
  // 34C-B2: IG atual (badge no cabeçalho) via fonte única — IG na data
  // de hoje, calculada pela RPC `calcular_ig` que respeita a âncora vigente.
  const hojeISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const igAtualQuery = useIg(paciente.id, hojeISO);
  const igAtual = igAtualQuery.data ?? null;

  // ── Estado dos campos ──
  const [viaParto, setViaParto] = useState<ViaParto>('');
  const [motivoCesarea, setMotivoCesarea] = useState('');
  const [igPartoSemanas, setIgPartoSemanas] = useState<string>('');
  const [igPartoDias, setIgPartoDias] = useState<string>('');
  const [igOrigem, setIgOrigem] = useState<IgOrigem>('auto');
  const [dataParto, setDataParto] = useState<string>(todayLocalISO());
  const [pesoRn, setPesoRn] = useState('');
  const [sexoRn, setSexoRn] = useState<SexoRNState>('');
  const [classRn, setClassRn] = useState<ClassRN>('');
  const [classOrigem, setClassOrigem] = useState<ClassificacaoOrigem>('pendente');
  const [apgar1, setApgar1] = useState('');
  const [apgar5, setApgar5] = useState('');
  const [intercorrMat, setIntercorrMat] = useState<SimNao>('');
  const [descIntercorrMat, setDescIntercorrMat] = useState('');
  const [intercorrNeo, setIntercorrNeo] = useState<SimNao>('');
  const [descIntercorrNeo, setDescIntercorrNeo] = useState('');
  const [aleitamento, setAleitamento] = useState<SimNao>('');
  const [observacoes, setObservacoes] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Refs para autosave (rastreia consulta de rascunho) ──
  const draftConsultaIdRef = useRef<string | null>(null);
  const profissionalIdRef = useRef<string | null>(null);
  const proxNumeroRef = useRef<number>((consultas?.length || 0) + 1);

  // Carrega o profissional uma vez
  useEffect(() => {
    if (isPreview) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from('profissionais')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prof) profissionalIdRef.current = prof.id;
    })();
  }, [isPreview]);

  // 34B.1 — Bug A: useAutosave removido. Save explícito via botão.

  // 34C-B2: IG no parto via fonte única (RPC calcular_ig na data do parto).
  // Respeita a âncora vigente da paciente — sem DUM-diff local.
  const igPartoQuery = useIg(paciente.id, dataParto || null);
  useEffect(() => {
    if (igOrigem === 'manual') return;
    const ig = igPartoQuery.data;
    if (!ig) return;
    setIgPartoSemanas(String(ig.semanas));
    setIgPartoDias(String(ig.dias));
  }, [igPartoQuery.data, igOrigem]);

  // ── Auto-cálculo Intergrowth-21st (PIG/AIG/GIG) ──
  useEffect(() => {
    const sem = Number(igPartoSemanas);
    const dd = Number(igPartoDias);
    const peso = Number(pesoRn);

    const igOk =
      igPartoSemanas !== '' &&
      igPartoDias !== '' &&
      !Number.isNaN(sem) &&
      !Number.isNaN(dd) &&
      sem >= 0 && dd >= 0 && dd <= 6;
    const pesoOk = pesoRn !== '' && !Number.isNaN(peso) && peso > 0;
    const sexoOk = sexoRn === 'M' || sexoRn === 'F';

    if (!igOk || !pesoOk || !sexoOk) {
      // Faltam dados — não mexe na classificação manual já digitada
      if (classOrigem === 'auto') {
        setClassRn('');
        setClassOrigem('pendente');
      } else if (classOrigem !== 'manual') {
        setClassOrigem('pendente');
      }
      return;
    }

    const resultado = classificarRN(sem, dd, peso, sexoRn);
    if (resultado === null) {
      // IG fora da cobertura → não auto-preenche, libera modo manual
      if (classOrigem === 'auto') setClassRn('');
      setClassOrigem('fora-cobertura');
      return;
    }

    // Só auto-preenche se ainda não houve override manual
    if (classOrigem !== 'manual') {
      setClassRn(resultado);
      setClassOrigem('auto');
    }
  }, [igPartoSemanas, igPartoDias, pesoRn, sexoRn]);

  // ── Validação ──
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!viaParto) e.viaParto = t('registroParto.err.viaParto');
    if (viaParto === 'cesarea' && !motivoCesarea.trim())
      e.motivoCesarea = t('registroParto.err.motivoCesarea');

    const sem = Number(igPartoSemanas);
    if (!igPartoSemanas || Number.isNaN(sem) || sem < 20 || sem > 42)
      e.igSemanas = t('registroParto.err.igSemanas');
    const dd = Number(igPartoDias);
    if (igPartoDias === '' || Number.isNaN(dd) || dd < 0 || dd > 6)
      e.igDias = t('registroParto.err.igDias');

    if (!dataParto) e.dataParto = t('registroParto.err.dataParto');

    const peso = Number(pesoRn);
    if (!pesoRn || Number.isNaN(peso) || peso < 300 || peso > 6000)
      e.pesoRn = t('registroParto.err.pesoRn');

    if (!sexoRn) e.sexoRn = t('registroParto.err.sexoRn');

    if (!classRn) e.classRn = t('registroParto.err.classRn');

    const a1 = Number(apgar1);
    if (apgar1 === '' || Number.isNaN(a1) || a1 < 0 || a1 > 10)
      e.apgar1 = t('registroParto.err.apgar');
    const a5 = Number(apgar5);
    if (apgar5 === '' || Number.isNaN(a5) || a5 < 0 || a5 > 10)
      e.apgar5 = t('registroParto.err.apgar');

    if (!intercorrMat) e.intercorrMat = t('registroParto.err.simNao');
    if (intercorrMat === 'sim' && !descIntercorrMat.trim())
      e.descIntercorrMat = t('registroParto.err.descIntercorrMat');

    if (!intercorrNeo) e.intercorrNeo = t('registroParto.err.simNao');
    if (intercorrNeo === 'sim' && !descIntercorrNeo.trim())
      e.descIntercorrNeo = t('registroParto.err.descIntercorrNeo');

    if (!aleitamento) e.aleitamento = t('registroParto.err.simNao');

    return e;
  }, [
    viaParto, motivoCesarea, igPartoSemanas, igPartoDias, dataParto,
    pesoRn, sexoRn, classRn, apgar1, apgar5, intercorrMat, descIntercorrMat,
    intercorrNeo, descIntercorrNeo, aleitamento, t,
  ]);

  const isValid = Object.keys(errors).length === 0;

  // 34B.2 — status + pendentes. Registro de Parto não tem fluxo de edição inline,
  // então o status é sempre 'rascunho' até que o save no servidor o mude pra 'completa'.
  const statusFichaLocal: string = 'rascunho';
  // 34B.3 seção 3.10 — bloqueia submit se data do parto inválida.
  const [dataPartoValida, setDataPartoValida] = useState(true);
  const ROTULOS_REGISTRO_PARTO: Record<string, string> = {
    viaParto: t('registroParto.rotulo.viaParto'),
    motivoCesarea: t('registroParto.rotulo.motivoCesarea'),
    igSemanas: t('registroParto.rotulo.igSemanas'),
    igDias: t('registroParto.rotulo.igDias'),
    dataParto: t('registroParto.rotulo.dataParto'),
    pesoRn: t('registroParto.rotulo.pesoRn'),
    sexoRn: t('registroParto.rotulo.sexoRn'),
    classRn: t('registroParto.rotulo.classRn'),
    apgar1: t('registroParto.rotulo.apgar1'),
    apgar5: t('registroParto.rotulo.apgar5'),
    intercorrMat: t('registroParto.rotulo.intercorrMat'),
    descIntercorrMat: t('registroParto.rotulo.descIntercorrMat'),
    intercorrNeo: t('registroParto.rotulo.intercorrNeo'),
    descIntercorrNeo: t('registroParto.rotulo.descIntercorrNeo'),
    aleitamento: t('registroParto.rotulo.aleitamento'),
  };
  const camposPendentes = Object.keys(errors).map(
    (k) => ROTULOS_REGISTRO_PARTO[k] ?? k,
  );

  // ── Salvar ──
  async function handleSave() {
    if (!isValid) {
      toast.error(t('registroParto.toast.fillRequired'));
      return;
    }
    setSaving(true);

    const dadosParto = {
      via_parto: viaParto,
      motivo_cesarea: viaParto === 'cesarea' ? motivoCesarea.trim() : null,
      ig_semanas: Number(igPartoSemanas),
      ig_dias: Number(igPartoDias),
      data_parto: dataParto,
      peso_rn_g: Number(pesoRn),
      sexo_rn: sexoRn as 'M' | 'F',
      classificacao_rn: classRn,
      apgar_1min: Number(apgar1),
      apgar_5min: Number(apgar5),
      intercorrencias_maternas: intercorrMat === 'sim',
      desc_intercorrencias_maternas:
        intercorrMat === 'sim' ? descIntercorrMat.trim() : null,
      intercorrencias_neonatais: intercorrNeo === 'sim',
      desc_intercorrencias_neonatais:
        intercorrNeo === 'sim' ? descIntercorrNeo.trim() : null,
      aleitamento_sala_parto: aleitamento === 'sim',
      observacoes: observacoes.trim() || null,
    };

    if (isPreview) {
      const p = getPreviewPacienteById(paciente.id);
      if (!p) {
        setSaving(false);
        toast.error(t('registroParto.toast.patientNotFound'));
        return;
      }
      const novaConsulta: PreviewConsulta = {
        id: `parto-${Date.now()}`,
        tipo: 'registro_parto',
        numero_sequencial: (p.consultas?.length || 0) + 1,
        data: dataParto,
        ig_semanas: Number(igPartoSemanas),
        ig_dias: Number(igPartoDias),
        observacoes: JSON.stringify(dadosParto),
        status_gerado: 'resultado_parto',
        cenario_clinico: '5',
      };
      updatePreviewPaciente(paciente.id, {
        status_ficha: 'resultado_parto',
        data_ultima_consulta: dataParto,
        data_proximo_retorno: null,
        tipo_retorno: null,
        consultas: [...(p.consultas || []), novaConsulta],
      });
      window.dispatchEvent(new Event('preview-pacientes-updated'));
      toast.success(t('registroParto.toast.saved'));
      setSaving(false);
      onSaved();
      return;
    }

    // ── Modo real (Supabase) ──
    const { data: prof } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .maybeSingle();

    if (!prof) {
      setSaving(false);
      toast.error(t('registroParto.toast.profileNotFound'));
      return;
    }

    const proxNumero = proxNumeroRef.current;

    const consultaPayload = {
      paciente_id: paciente.id,
      profissional_id: prof.id,
      tipo: 'registro_parto',
      numero_sequencial: proxNumero,
      data: dataParto,
      ig_semanas: Number(igPartoSemanas),
      ig_dias: Number(igPartoDias),
      observacoes: JSON.stringify(dadosParto),
      cenario_clinico: '5',
      status_gerado: 'resultado_parto',
      is_rascunho: false,
      // 34B.2 — finaliza ficha. Default do banco era 'rascunho' até este save.
      status_ficha: 'completa',
    };

    let cErr: any = null;
    if (draftConsultaIdRef.current) {
      const { error } = await supabase
        .from('consultas')
        .update(consultaPayload)
        .eq('id', draftConsultaIdRef.current);
      cErr = error;
    } else {
      const { error } = await supabase.from('consultas').insert(consultaPayload);
      cErr = error;
    }

    if (cErr) {
      console.error(cErr);
      setSaving(false);
      toast.error(t('registroParto.toast.saveError'));
      return;
    }

    const { error: pErr } = await supabase
      .from('pacientes')
      .update({
        status_ficha: 'resultado_parto',
        data_ultima_consulta: dataParto,
        data_proximo_retorno: null,
        tipo_retorno: null,
      })
      .eq('id', paciente.id);

    if (pErr) {
      console.error(pErr);
      setSaving(false);
      toast.error(t('registroParto.toast.updateStatusError'));
      return;
    }

    const { carimbarAtendimento } = await import('@/lib/carimbar');
    await carimbarAtendimento({
      pacienteId: paciente.id,
      tipoOperacao: 'registrar_parto',
      recursoTipo: 'parto',
    });
    await carimbarAtendimento({
      pacienteId: paciente.id,
      tipoOperacao: 'encerramento',
      recursoTipo: 'paciente',
    });

    setSaving(false);
    toast.success(t('registroParto.toast.saved'));
    onSaved();
  }

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho — card lavanda padrão visual ── */}
      <div className="rounded-xl border border-[#D6BCFA] bg-[#F1F0FB] p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h2 className="font-heading text-base font-bold text-[#7E69AB] flex items-center gap-2">
              <Baby className="h-5 w-5" />
              {t('registroParto.header')}
            </h2>
            <p className="text-xs text-[#7E69AB]">
              {t('registroParto.subtitle')}
            </p>
            <p className="text-xs text-[#64748B]">
              {t('registroParto.subtitle2')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusFichaBadge status={statusFichaLocal} />
            {igAtual && (
              <span className="inline-flex rounded-md bg-[#E8E0FF] px-2 py-1 text-[11px] font-medium text-[#7E69AB]">
                {t('registroParto.currentIg')} — {igAtual.semanas}s {igAtual.dias}d
              </span>
            )}
          </div>
        </div>

        {/* Nota dentro do card */}
        <div className="rounded-lg bg-[#E8E0FF] p-3">
          <p className="text-xs font-bold text-[#5B21B6] mb-1">{t('registroParto.aboutTitle')}</p>
          <p className="text-xs text-[#6D28D9]">
            {t('registroParto.aboutBody')}
          </p>
        </div>
      </div>

      <CamposPendentesBanner
        pendentes={camposPendentes}
        ativo={statusFichaLocal === 'rascunho'}
      />

      {/* ── Formulário ── */}
      <form
        className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValid) {
            toast.error(t('registroParto.toast.fillRequired'));
            return;
          }
          setConfirmOpen(true);
        }}
      >
        {/* Via de parto */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            {t('registroParto.viaLabel')} <span className="text-destructive">*</span>
            <HelpIcon text={t('registroParto.viaHelp')} />
          </label>
          <Select value={viaParto} onValueChange={(v) => setViaParto(v as ViaParto)}>
            <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vaginal">{t('registroParto.vaginal')}</SelectItem>
              <SelectItem value="cesarea">{t('registroParto.cesarean')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Motivo da cesárea (condicional) */}
        {viaParto === 'cesarea' && (
          <div className="space-y-1 animate-fade-in">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.motivoCesareaLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.motivoCesareaHelp')} />
            </label>
            <Input
              value={motivoCesarea}
              onChange={(e) => setMotivoCesarea(e.target.value)}
              placeholder={t('registroParto.motivoCesareaPlaceholder')}
            />
          </div>
        )}

        {/* Data do parto + IG no parto lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.dataPartoLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.dataPartoHelp')} />
            </label>
            <DateInput
              value={dataParto}
              onChange={setDataParto}
              onValidityChange={setDataPartoValida}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.igLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={`${t('registroParto.igHelp')} ${descreverReferenciaIg(igPartoQuery.data)} ${t('registroParto.igHelpAuto')}`} />
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={20} max={42}
                value={igPartoSemanas}
                onChange={(e) => { setIgPartoSemanas(e.target.value); setIgOrigem('manual'); }}
                placeholder={t('registroParto.weeksShort')}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">{t('registroParto.weeksUnit')}</span>
              <Input
                type="number" min={0} max={6}
                value={igPartoDias}
                onChange={(e) => { setIgPartoDias(e.target.value); setIgOrigem('manual'); }}
                placeholder={t('registroParto.daysShort')}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">{t('registroParto.daysUnit')}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {igOrigem === 'auto'
                ? t('registroParto.igAutoNote')
                : t('registroParto.igManualNote')}
            </p>
          </div>
        </div>

        {/* Peso do RN + Sexo do RN lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.pesoRnFieldLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.pesoRnHelp')} />
            </label>
            <Input
              type="number" min={300} max={6000}
              value={pesoRn}
              onChange={(e) => setPesoRn(e.target.value)}
              placeholder={t('registroParto.pesoRnPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.sexoRnLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.sexoRnHelp')} />
            </label>
            <Select value={sexoRn} onValueChange={(v) => setSexoRn(v as SexoRNState)}>
              <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">{t('registroParto.male')}</SelectItem>
                <SelectItem value="F">{t('registroParto.female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Classificação do RN (auto-calculada) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.classRnLabel')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.classRnHelp')} />
            </label>
            <Select
              value={classRn}
              onValueChange={(v) => {
                setClassRn(v as ClassRN);
                setClassOrigem('manual');
              }}
            >
              <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AIG">{t('registroParto.aigOption')}</SelectItem>
                <SelectItem value="GIG">{t('registroParto.gigOption')}</SelectItem>
                <SelectItem value="PIG">{t('registroParto.pigOption')}</SelectItem>
              </SelectContent>
            </Select>
            {classOrigem === 'auto' && (
              <p className="text-[12px] text-[#94A3B8]">
                {t('registroParto.classAutoNote')}
              </p>
            )}
            {classOrigem === 'manual' && (
              <p className="text-[12px] text-[#94A3B8]">
                {t('registroParto.classManualNote')}
              </p>
            )}
            {classOrigem === 'fora-cobertura' && (
              <p className="text-[12px] text-[#94A3B8]">
                {t('registroParto.classOutOfRangeNote')}
              </p>
            )}
          </div>
          <div />
        </div>

        {/* Apgar 1' + 5' lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.apgar1Label')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.apgar1Help')} />
            </label>
            <Input
              type="number" min={0} max={10}
              value={apgar1}
              onChange={(e) => setApgar1(e.target.value)}
              placeholder="0–10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.apgar5Label')} <span className="text-destructive">*</span>
              <HelpIcon text={t('registroParto.apgar5Help')} />
            </label>
            <Input
              type="number" min={0} max={10}
              value={apgar5}
              onChange={(e) => setApgar5(e.target.value)}
              placeholder="0–10"
            />
          </div>
        </div>

        {/* Intercorrências maternas */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            {t('registroParto.intercorrMatLabel')} <span className="text-destructive">*</span>
            <HelpIcon text={t('registroParto.intercorrMatHelp')} />
          </label>
          <Select value={intercorrMat} onValueChange={(v) => setIntercorrMat(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">{t('common.yes')}</SelectItem>
              <SelectItem value="nao">{t('common.no')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Intercorrências neonatais */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            {t('registroParto.intercorrNeoLabel')} <span className="text-destructive">*</span>
            <HelpIcon text={t('registroParto.intercorrNeoHelp')} />
          </label>
          <Select value={intercorrNeo} onValueChange={(v) => setIntercorrNeo(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">{t('common.yes')}</SelectItem>
              <SelectItem value="nao">{t('common.no')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {intercorrNeo === 'sim' && (
          <div className="space-y-1 animate-fade-in">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              {t('registroParto.descIntercorrNeoLabel')} <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={3}
              value={descIntercorrNeo}
              onChange={(e) => setDescIntercorrNeo(e.target.value)}
              placeholder={t('registroParto.descIntercorrNeoPlaceholder')}
            />
          </div>
        )}

        {/* Aleitamento */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            {t('registroParto.aleitamentoFieldLabel')} <span className="text-destructive">*</span>
            <HelpIcon text={t('registroParto.aleitamentoHelp')} />
          </label>
          <Select value={aleitamento} onValueChange={(v) => setAleitamento(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder={t('registroParto.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">{t('common.yes')}</SelectItem>
              <SelectItem value="nao">{t('common.no')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Observações livres */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            {t('registroParto.observacoesLabel')}
            <HelpIcon text={t('registroParto.observacoesHelp')} />
          </label>
          <Textarea
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder={t('registroParto.observacoesPlaceholder')}
          />
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            disabled={!isValid || saving || !dataPartoValida}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileText className="mr-2 h-4 w-4" />
            {t('registroParto.saveButton')}
          </Button>
        </div>
      </form>

      {/* Modal de confirmação */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('registroParto.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('registroParto.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleSave().then(() => setConfirmOpen(false));
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('registroParto.confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
