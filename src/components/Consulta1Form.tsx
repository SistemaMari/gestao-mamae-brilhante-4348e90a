import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { addPreviewPaciente } from '@/lib/previewPatients';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Info, Loader2, FileText } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { todayLocalISO, parseDateLocal } from '@/lib/dateUtils';
import {
  mascararWhatsappBR,
  validarWhatsappBR,
  paraFormatoCanonico,
} from '@/lib/whatsapp';
// 34B.1 — useAutosave + AutosaveIndicator removidos (Bug A). Save explícito via botão.
// 34B-4 — Caso Novo SEM rascunho: StatusFichaBadge e CamposPendentesBanner removidos.
// Permanecem nas fichas de retorno (Retorno1/AC/BD/GTT 75g).
import DateInput from '@/components/ficha/DateInput';
import UsgFlowSection, { emptyUsgFlow, type UsgFlowValue } from '@/components/UsgFlowSection';
import { Checkbox } from '@/components/ui/checkbox';

function todayISO() {
  return todayLocalISO();
}

export default function Consulta1Form() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const { user } = useAuth();
  const { profissionalData } = useProfissionalData();

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [tipoIdentificacao, setTipoIdentificacao] = useState('cpf');
  const [numeroId, setNumeroId] = useState('');
  const [whatsapp, setWhatsapp] = useState(''); // string mascarada (sem DDI)
  const [dum, setDum] = useState('');
  const [dumDesconhecida, setDumDesconhecida] = useState(false);
  const [dataConsulta, setDataConsulta] = useState(todayISO());
  const [observacoes, setObservacoes] = useState('');
  const [dmgAnterior, setDmgAnterior] = useState<boolean | null>(null);
  const [usgFlow, setUsgFlow] = useState<UsgFlowValue>(emptyUsgFlow);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Autosave: rascunho de paciente + consulta no banco
  const draftPacienteIdRef = useRef<string | null>(null);
  const draftConsultaIdRef = useRef<string | null>(null);

  const idade = useMemo(() => {
    if (!dataNascimento) return null;
    const nasc = parseDateLocal(dataNascimento);
    return nasc ? differenceInYears(new Date(), nasc) : null;
  }, [dataNascimento]);

  const whatsappValidacao = validarWhatsappBR(whatsapp);
  const dumValido = dumDesconhecida || !!dum;
  // Se "sim" para USG, exige data + semanas + dias + referência
  const usgValida =
    usgFlow.jaFezUsg !== 'sim' ||
    (!!usgFlow.dataExame && usgFlow.igSemanas !== '' && usgFlow.igDias !== '' && !!usgFlow.referenciaIg);
  const isValid =
    nome.trim() && dataNascimento && dumValido && dataConsulta && dmgAnterior !== null && whatsappValidacao.ok && usgValida && usgFlow.jaFezUsg !== null;

  // 34B-4 — Caso Novo SEM rascunho. Badge e banner de pendentes removidos.
  // Validação de obrigatórios acontece apenas no submit (touched + isValid).
  // 34B.3 seção 3.10 — bloqueia submit se alguma data inválida.
  const [dataNascValida, setDataNascValida] = useState(true);
  const [dumValidaDate, setDumValidaDate] = useState(true);
  const [dataConsultaValida, setDataConsultaValida] = useState(true);
  const todasDatasValidas = dataNascValida && dumValidaDate && dataConsultaValida;

  // 34B.1 — Bug A: useAutosave removido. Caso Novo (paciente + consulta_1) só é criado no submit
  // explícito. Backup local de rascunho fica em useDraftStorage (ver Retorno1Form para o padrão).

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isValid) {
      toast.error(t('consulta1.fillAllRequired'));
      return;
    }

    if (isPreview) {
      const consultaId = crypto.randomUUID();
      const newPaciente = addPreviewPaciente({
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        numero_identificacao: numeroId.trim() || null,
        tipo_identificacao: tipoIdentificacao,
        dum: dumDesconhecida ? null : dum,
        usg_data: usgFlow.jaFezUsg === 'sim' ? usgFlow.dataExame : null,
        usg_ig_semanas: usgFlow.jaFezUsg === 'sim' ? Number(usgFlow.igSemanas) : null,
        usg_ig_dias: usgFlow.jaFezUsg === 'sim' ? Number(usgFlow.igDias || 0) : null,
        dmg_gestacao_anterior: dmgAnterior === true,
        data_ultima_consulta: dataConsulta,
        consultas: [
          {
            id: consultaId,
            tipo: 'consulta_1',
            numero_sequencial: 1,
            data: dataConsulta,
            ig_semanas: null,
            ig_dias: null,
            observacoes: observacoes.trim() || null,
            status_gerado: 'aguardando_gj',
          },
        ],
      });
      window.dispatchEvent(new Event('preview-pacientes-updated'));
      toast.success(t('consulta1.newCaseRegistered'));
      navigate(`/vitrine/paciente/${newPaciente.id}`);
      return;
    }

    // Real mode
    if (!profissionalData || !user) {
      toast.error(t('consulta1.mustBeLoggedIn'));
      return;
    }

    setSaving(true);

    const pacientePayload: Record<string, unknown> = {
      nome: nome.trim(),
      profissional_id: profissionalData.id,
      data_nascimento: dataNascimento,
      numero_identificacao: numeroId.trim() || null,
      tipo_identificacao: tipoIdentificacao,
      whatsapp: paraFormatoCanonico(whatsapp),
      dum: dumDesconhecida ? null : dum,
      dmg_gestacao_anterior: dmgAnterior === true,
      data_ultima_consulta: dataConsulta,
      is_rascunho: false,
      // Status CLÍNICO inicial do Caso Novo: aguardando glicemia de jejum.
      // pacientes.status_ficha é o estado clínico (default do banco = 'aguardando_gj'),
      // DIFERENTE de consultas.status_ficha (rascunho/completa). Gravar 'completa' aqui
      // sufocava o gate de getNextStepInfo (FichaPacientePage) e escondia o "+ Retorno 1".
      status_ficha: 'aguardando_gj',
      referencia_ig: usgFlow.referenciaIg ?? (dumDesconhecida ? null : 'dum'),
    };

    if ('unidade_id' in profissionalData) {
      pacientePayload.unidade_id = (profissionalData as any).unidade_id || null;
    }

    let pacienteId = draftPacienteIdRef.current;

    if (!pacienteId) {
      const { data: podeCriar } = await supabase.rpc('pode_criar_ficha', {
        p_profissional_id: profissionalData.id,
      });
      if (!podeCriar) {
        toast.error(t('consulta1.fileLimitReached'));
        setSaving(false);
        return;
      }

      const { data: pacienteData, error: pacErr } = await supabase
        .from('pacientes')
        .insert(pacientePayload as any)
        .select('id')
        .single();

      if (pacErr || !pacienteData) {
        toast.error(t('consulta1.errorCreatingPatient'));
        console.error(pacErr);
        setSaving(false);
        return;
      }
      pacienteId = pacienteData.id;
    } else {
      const { error: pacErr } = await supabase
        .from('pacientes')
        .update(pacientePayload as any)
        .eq('id', pacienteId);
      if (pacErr) {
        toast.error(t('consulta1.errorSavingPatient'));
        console.error(pacErr);
        setSaving(false);
        return;
      }
    }

    // Persistir 1ª USG na tabela exames_usg (se informada)
    if (usgFlow.jaFezUsg === 'sim' && usgFlow.dataExame && usgFlow.igSemanas !== '') {
      const { data: novaUsg, error: usgErr } = await supabase
        .from('exames_usg')
        .insert({
          paciente_id: pacienteId!,
          data_exame: usgFlow.dataExame,
          ig_semanas: Number(usgFlow.igSemanas),
          ig_dias: Number(usgFlow.igDias || 0),
          ordem: 1,
          criado_por: user?.id ?? null,
        } as any)
        .select('id')
        .single();
      if (usgErr || !novaUsg) {
        console.error('[exames_usg] insert falhou:', usgErr);
      } else if (usgFlow.referenciaIg === 'usg') {
        // A paciente já foi gravada com referencia_ig='usg', mas referencia_usg_id
        // ficava NULL. A fonte única de IG (RPC calcular_ig) só usa a USG quando o
        // id está preenchido — sem ele, cai silenciosamente na DUM, ignorando a
        // escolha "calcular IG pela USG". Persistimos o id da USG recém-criada.
        // Espelha o padrão de UsgManagerCard.handleAddUsg.
        const { error: refErr } = await supabase
          .from('pacientes')
          .update({ referencia_usg_id: novaUsg.id })
          .eq('id', pacienteId!);
        if (refErr) console.error('[pacientes] update referencia_usg_id falhou:', refErr);
      }
    }


    const consultaPayload = {
      paciente_id: pacienteId,
      profissional_id: profissionalData.id,
      tipo: 'consulta_1',
      numero_sequencial: 1,
      data: dataConsulta,
      observacoes: observacoes.trim() || null,
      status_gerado: 'aguardando_gj',
      is_rascunho: false,
      // 34B.2 — finaliza ficha. Backend default era 'rascunho' até este save explícito.
      status_ficha: 'completa',
    };

    let consErr: unknown = null;
    let consultaIdFinal: string | null = draftConsultaIdRef.current;
    if (draftConsultaIdRef.current) {
      const { error } = await supabase
        .from('consultas')
        .update(consultaPayload as any)
        .eq('id', draftConsultaIdRef.current);
      consErr = error;
    } else {
      const { data: novaCons, error } = await supabase
        .from('consultas')
        .insert(consultaPayload as any)
        .select('id')
        .single();
      consErr = error;
      consultaIdFinal = (novaCons as any)?.id ?? null;
    }

    setSaving(false);

    if (consErr) {
      toast.error(t('consulta1.patientCreatedButConsultationError'));
      console.error(consErr);
    } else {
      toast.success(t('consulta1.newCaseRegistered'));
      const { carimbarAtendimento } = await import('@/lib/carimbar');
      await carimbarAtendimento({
        pacienteId: pacienteId!,
        tipoOperacao: 'consulta_inicial',
        recursoId: consultaIdFinal ?? undefined,
        recursoTipo: 'consulta',
      });
    }

    navigate(`/paciente/${pacienteId}`);
  };

  const fieldError = (valid: boolean) =>
    touched && !valid ? 'border-destructive ring-1 ring-destructive' : '';

  const errorMsg = (valid: boolean) =>
    touched && !valid ? (
      <span className="text-xs text-destructive">{t('consulta1.requiredField')}</span>
    ) : null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-xl border border-[#7C4DBA] bg-[#F1F0FB] p-4 space-y-1">
        <h1 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('consulta1.headerTitle')}
        </h1>
        <p className="text-xs text-[#6D28D9]">
          {t('consulta1.headerSubtitle')}
        </p>
      </div>



      <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome completo */}
          <div className="space-y-2">
            <FieldLabel htmlFor="nome" required tooltip={t('consulta1.nameTooltip')}>
              {t('consulta1.fullNameLabel')}
            </FieldLabel>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={t('consulta1.namePlaceholder')}
              className={fieldError(!!nome.trim())}
            />
            {errorMsg(!!nome.trim())}
          </div>

          {/* Data de nascimento */}
          <div className="space-y-2">
            <FieldLabel htmlFor="data-nasc" required tooltip={t('consulta1.birthdateTooltip')}>
              {t('consulta1.birthdateLabel')}
            </FieldLabel>
            <div className="flex items-center gap-3">
              <DateInput
                id="data-nasc"
                value={dataNascimento}
                onChange={setDataNascimento}
                onValidityChange={setDataNascValida}
                wrapperClassName="flex-1"
                className={fieldError(!!dataNascimento)}
              />
              {idade !== null && (
                <span className="whitespace-nowrap rounded-md bg-muted px-2.5 py-1 text-sm font-medium text-foreground">
                  {t('consulta1.yearsOld', { count: idade })}
                </span>
              )}
            </div>
            {errorMsg(!!dataNascimento)}
          </div>

          {/* Tipo de identificação + Número */}
          <div className="space-y-2">
            <FieldLabel tooltip={t('consulta1.identificationTooltip')}>
              {t('consulta1.identificationLabel')}
            </FieldLabel>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <Select value={tipoIdentificacao} onValueChange={setTipoIdentificacao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">{t('consulta1.idTypeCpf')}</SelectItem>
                  <SelectItem value="prontuario">{t('consulta1.idTypeMedicalRecord')}</SelectItem>
                  <SelectItem value="cns">{t('consulta1.idTypeCns')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={numeroId}
                onChange={(e) => setNumeroId(e.target.value)}
                placeholder={t('consulta1.idNumberPlaceholder')}
              />
            </div>
          </div>

          {/* WhatsApp (opcional) */}
          <div className="space-y-2">
            <FieldLabel
              htmlFor="whatsapp"
              tooltip={t('consulta1.whatsappTooltip')}
            >
              {t('consulta1.whatsappLabel')}
            </FieldLabel>
            <div className="flex items-stretch gap-2">
              <span className="flex shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                +55
              </span>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={whatsapp}
                onChange={(e) => setWhatsapp(mascararWhatsappBR(e.target.value))}
                placeholder="(11) 91234-5678"
                className={`flex-1 ${
                  touched && !whatsappValidacao.ok ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
                aria-invalid={touched && !whatsappValidacao.ok}
              />
            </div>
            {touched && !whatsappValidacao.ok && whatsappValidacao.mensagem && (
              <p className="text-xs text-destructive">{whatsappValidacao.mensagem}</p>
            )}
          </div>

          {/* Ajustes V3 item 8 — País/Estado/Cidade da paciente removidos do
              formulário (a incidência é filtrada pela localização da rede/consultório,
              não da paciente). Colunas preservadas no banco; apenas não são mais
              coletadas no Caso Novo. */}

          {/* DUM */}
          <div className="space-y-2">
            <FieldLabel htmlFor="dum" required tooltip={t('consulta1.lastPeriodTooltip')}>
              {t('consulta1.lastPeriodLabel')}
            </FieldLabel>
            <DateInput
              id="dum"
              value={dum}
              onChange={setDum}
              onValidityChange={setDumValidaDate}
              disabled={dumDesconhecida}
              className={fieldError(dumValido)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={dumDesconhecida}
                onCheckedChange={(c) => {
                  const v = c === true;
                  setDumDesconhecida(v);
                  if (v) {
                    setDum('');
                    // se referência era DUM, limpa
                    if (usgFlow.referenciaIg === 'dum') {
                      setUsgFlow({ ...usgFlow, referenciaIg: null });
                    }
                  }
                }}
              />
              {t('consulta1.unknownLastPeriod')}
            </label>
            {errorMsg(dumValido)}
          </div>

          {/* USG flow: 1ª USG + referência de IG */}
          <UsgFlowSection
            value={usgFlow}
            onChange={setUsgFlow}
            dum={dum}
            dumDesconhecida={dumDesconhecida}
          />


          {/* Data da consulta */}
          <div className="space-y-2">
            <FieldLabel htmlFor="data-consulta" required tooltip={t('consulta1.consultationDateTooltip')}>
              {t('consulta1.consultationDateLabel')}
            </FieldLabel>
            <DateInput
              id="data-consulta"
              value={dataConsulta}
              onChange={setDataConsulta}
              onValidityChange={setDataConsultaValida}
              className={fieldError(!!dataConsulta)}
            />
            {errorMsg(!!dataConsulta)}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <FieldLabel htmlFor="obs" tooltip={t('consulta1.clinicalNotesTooltip')}>
              {t('consulta1.clinicalNotesLabel')}
            </FieldLabel>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={t('consulta1.optionalPlaceholder')}
              rows={3}
            />
          </div>

          {/* DMG anterior */}
          <div className="space-y-2">
            <FieldLabel required tooltip={t('consulta1.previousDmgTooltip')}>
              {t('consulta1.previousDmgLabel')}
            </FieldLabel>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDmgAnterior(true)}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  dmgAnterior === true
                    ? 'border-[#7C4DBA] bg-[#7C4DBA]/10 text-[#7C4DBA]'
                    : 'border-[#7C4DBA]/30 bg-card text-muted-foreground hover:border-[#7C4DBA]/60'
                } ${touched && dmgAnterior === null ? 'border-destructive' : ''}`}
              >
                {t('common.yes')}
              </button>
              <button
                type="button"
                onClick={() => setDmgAnterior(false)}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  dmgAnterior === false
                    ? 'border-[#7C4DBA] bg-[#7C4DBA]/10 text-[#7C4DBA]'
                    : 'border-[#7C4DBA]/30 bg-card text-muted-foreground hover:border-[#7C4DBA]/60'
                } ${touched && dmgAnterior === null ? 'border-destructive' : ''}`}
              >
                {t('common.no')}
              </button>
            </div>
            {errorMsg(dmgAnterior !== null)}
          </div>

          {/* Botões */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isPreview ? '/vitrine/dashboard' : '/dashboard')}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving || !todasDatasValidas}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('consulta1.saveConsultation')}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {children}
        {/* Ajustes V3 item 9 — asterisco substituído por rótulo explícito com destaque. */}
        {required && (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 align-middle">
            {t('common.preenchimentoObrigatorio')}
          </span>
        )}
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
