import { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { addPreviewPaciente } from '@/lib/previewPatients';
import { countries } from '@/data/locationData';
import { useCidadesIBGE } from '@/hooks/useCidadesIBGE';
import CidadeCombobox from '@/components/CidadeCombobox';
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
// Permanecem nas fichas de retorno (Retorno1/AC/BD/GTT).
import DateInput from '@/components/ficha/DateInput';
import CasoNovoUsgSection from '@/components/CasoNovoUsgSection';
import {
  emptyCasoNovoUsg,
  prepararUsgsParaSalvar,
  type CasoNovoUsgEntry,
  type CasoNovoUsgValue,
} from '@/lib/casoNovoUsg';
import { Checkbox } from '@/components/ui/checkbox';

function todayISO() {
  return todayLocalISO();
}

export default function Consulta1Form() {
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
  const [pais, setPais] = useState('Brasil');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [usgFlow, setUsgFlow] = useState<CasoNovoUsgValue>(emptyCasoNovoUsg);
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

  // Location cascading logic
  const selectedCountry = useMemo(() => countries.find((c) => c.value === pais), [pais]);
  const stateList = selectedCountry?.states || [];
  const isOutro = pais === 'Outro';
  const { cidades: cityList } = useCidadesIBGE(pais, estado);

  const whatsappValidacao = validarWhatsappBR(whatsapp);
  const dumValido = dumDesconhecida || !!dum;
  // Se "sim" para USG: exige >=1 USG completa, datas distintas e referência escolhida.
  const refEscolhida = usgFlow.referencia;
  const usgsCompletas =
    usgFlow.usgs.length > 0 &&
    usgFlow.usgs.every((u) => !!u.dataExame && u.igSemanas !== '' && u.igDias !== '');
  const datasUsgUnicas = (() => {
    const datas = usgFlow.usgs.map((u) => u.dataExame).filter(Boolean);
    return new Set(datas).size === datas.length;
  })();
  const referenciaValida =
    refEscolhida != null &&
    (refEscolhida.tipo === 'dum' ||
      usgFlow.usgs.some((u) => refEscolhida.tipo === 'usg' && u.localId === refEscolhida.localId));
  const usgValida =
    usgFlow.jaFezUsg !== 'sim' || (usgsCompletas && datasUsgUnicas && referenciaValida);
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
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    // USG escolhida como referência (se houver) — usada no preview e no real.
    let usgReferenciaEntry: CasoNovoUsgEntry | null = null;
    const refSel = usgFlow.referencia;
    if (refSel?.tipo === 'usg') {
      usgReferenciaEntry = usgFlow.usgs.find((u) => u.localId === refSel.localId) ?? null;
    }

    if (isPreview) {
      const consultaId = crypto.randomUUID();
      const newPaciente = addPreviewPaciente({
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        numero_identificacao: numeroId.trim() || null,
        tipo_identificacao: tipoIdentificacao,
        dum: dumDesconhecida ? null : dum,
        pais,
        estado: estado || null,
        cidade: cidade || null,
        // Preview guarda só um snapshot de USG: usa a USG escolhida como referência.
        usg_data: usgReferenciaEntry ? usgReferenciaEntry.dataExame : null,
        usg_ig_semanas: usgReferenciaEntry ? Number(usgReferenciaEntry.igSemanas) : null,
        usg_ig_dias: usgReferenciaEntry ? Number(usgReferenciaEntry.igDias || 0) : null,
        referencia_ig: usgFlow.referencia?.tipo ?? (dumDesconhecida ? null : 'dum'),
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
      toast.success('Caso Novo registrada com sucesso!');
      navigate(`/vitrine/paciente/${newPaciente.id}`);
      return;
    }

    // Real mode
    if (!profissionalData || !user) {
      toast.error('Você precisa estar logado.');
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
      pais,
      estado: estado || null,
      cidade: cidade || null,
      dmg_gestacao_anterior: dmgAnterior === true,
      data_ultima_consulta: dataConsulta,
      is_rascunho: false,
      // Status CLÍNICO inicial do Caso Novo: aguardando glicemia de jejum.
      // pacientes.status_ficha é o estado clínico (default do banco = 'aguardando_gj'),
      // DIFERENTE de consultas.status_ficha (rascunho/completa). Gravar 'completa' aqui
      // sufocava o gate de getNextStepInfo (FichaPacientePage) e escondia o "+ Retorno 1".
      status_ficha: 'aguardando_gj',
      referencia_ig: usgFlow.referencia?.tipo ?? (dumDesconhecida ? null : 'dum'),
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
        toast.error('Limite de fichas atingido para o plano atual.');
        setSaving(false);
        return;
      }

      const { data: pacienteData, error: pacErr } = await supabase
        .from('pacientes')
        .insert(pacientePayload as any)
        .select('id')
        .single();

      if (pacErr || !pacienteData) {
        toast.error('Erro ao criar paciente.');
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
        toast.error('Erro ao salvar paciente.');
        console.error(pacErr);
        setSaving(false);
        return;
      }
    }

    // Persistir as USGs informadas (ordem cronológica: 1ª = mais antiga).
    if (usgFlow.jaFezUsg === 'sim' && usgFlow.usgs.length > 0) {
      const preparadas = prepararUsgsParaSalvar(usgFlow.usgs);
      const { data: inseridas, error: usgErr } = await supabase
        .from('exames_usg')
        .insert(
          preparadas.map((u) => ({
            paciente_id: pacienteId!,
            data_exame: u.data_exame,
            ig_semanas: u.ig_semanas,
            ig_dias: u.ig_dias,
            ordem: u.ordem,
            criado_por: user?.id ?? null,
          })) as any,
        )
        .select('id, data_exame');
      if (usgErr || !inseridas) {
        console.error('[exames_usg] insert falhou:', usgErr);
      } else if (usgReferenciaEntry) {
        // Casa a USG escolhida (via data, única por paciente) com o id gerado e grava
        // pacientes.referencia_usg_id. A fonte única de IG (RPC calcular_ig) só usa a
        // USG quando esse id está preenchido — sem ele cai na DUM.
        const refEntry = usgReferenciaEntry;
        const linhaRef = (inseridas as { id: string; data_exame: string }[]).find(
          (r) => r.data_exame === refEntry.dataExame,
        );
        if (linhaRef) {
          const { error: refErr } = await supabase
            .from('pacientes')
            .update({ referencia_usg_id: linhaRef.id })
            .eq('id', pacienteId!);
          if (refErr) console.error('[pacientes] update referencia_usg_id falhou:', refErr);
        }
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
      toast.error('Paciente criada, mas erro ao registrar consulta.');
      console.error(consErr);
    } else {
      toast.success('Caso Novo registrada com sucesso!');
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
      <span className="text-xs text-destructive">Campo obrigatório</span>
    ) : null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-xl border border-[#7C4DBA] bg-[#F1F0FB] p-4 space-y-1">
        <h1 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CASO NOVO — Dados da Paciente
        </h1>
        <p className="text-xs text-[#6D28D9]">
          Preencha os dados iniciais e abra a ficha clínica com pedido de exame.
        </p>
      </div>



      <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome completo */}
          <div className="space-y-2">
            <FieldLabel htmlFor="nome" required tooltip="Nome completo para identificação na ficha e no laudo.">
              Nome completo
            </FieldLabel>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da paciente"
              className={fieldError(!!nome.trim())}
            />
            {errorMsg(!!nome.trim())}
          </div>

          {/* Data de nascimento */}
          <div className="space-y-2">
            <FieldLabel htmlFor="data-nasc" required tooltip="Usada para calcular a idade automaticamente.">
              Data de nascimento
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
                  {idade} anos
                </span>
              )}
            </div>
            {errorMsg(!!dataNascimento)}
          </div>

          {/* Tipo de identificação + Número */}
          <div className="space-y-2">
            <FieldLabel tooltip="Selecione o tipo de documento e informe o número de identificação da paciente.">
              Identificação
            </FieldLabel>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <Select value={tipoIdentificacao} onValueChange={setTipoIdentificacao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="prontuario">Prontuário</SelectItem>
                  <SelectItem value="cns">CNS</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={numeroId}
                onChange={(e) => setNumeroId(e.target.value)}
                placeholder="Número (opcional)"
              />
            </div>
          </div>

          {/* WhatsApp (opcional) */}
          <div className="space-y-2">
            <FieldLabel
              htmlFor="whatsapp"
              tooltip="Opcional. DDD + número, 10 ou 11 dígitos. DDI brasileiro (+55) é fixo."
            >
              WhatsApp
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

          <div className="space-y-2">
            <FieldLabel tooltip="Local de residência da paciente. A lista de estados e cidades muda conforme o país.">
              Localização
            </FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={pais} onValueChange={(v) => { setPais(v); setEstado(''); setCidade(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="País" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isOutro ? (
                <Input
                  value={estado}
                  onChange={(e) => { setEstado(e.target.value); setCidade(''); }}
                  placeholder="Estado"
                />
              ) : (
                <Select value={estado} onValueChange={(v) => { setEstado(v); setCidade(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateList.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isOutro ? (
                <Input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade"
                />
              ) : (
                <CidadeCombobox
                  value={cidade}
                  onChange={setCidade}
                  cidades={cityList}
                  disabled={!estado}
                  placeholder={estado ? 'Selecione a cidade...' : 'Selecione o estado primeiro'}
                />
              )}
            </div>
          </div>

          {/* DUM */}
          <div className="space-y-2">
            <FieldLabel htmlFor="dum" required tooltip="Data da última menstruação. Usada para calcular a idade gestacional automaticamente.">
              DUM (Data da última menstruação)
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
                    // se a referência era a DUM, limpa (DUM ficou desconhecida)
                    if (usgFlow.referencia?.tipo === 'dum') {
                      setUsgFlow({ ...usgFlow, referencia: null });
                    }
                  }
                }}
              />
              Não sei a data da última menstruação
            </label>
            {errorMsg(dumValido)}
          </div>

          {/* USGs (múltiplas) + referência de IG */}
          <CasoNovoUsgSection
            value={usgFlow}
            onChange={setUsgFlow}
            dum={dum}
            dumDesconhecida={dumDesconhecida}
          />


          {/* Data da consulta */}
          <div className="space-y-2">
            <FieldLabel htmlFor="data-consulta" required tooltip="Data em que esta consulta está sendo realizada. Padrão: hoje.">
              Data da consulta
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
            <FieldLabel htmlFor="obs" tooltip="Anotações adicionais sobre a paciente: histórico, comorbidades, medicamentos em uso, etc.">
              Observações clínicas
            </FieldLabel>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional"
              rows={3}
            />
          </div>

          {/* DMG anterior */}
          <div className="space-y-2">
            <FieldLabel required tooltip="Marque se a paciente já teve diagnóstico de Diabete Mellitus Gestacional em gestação prévia.">
              DMG em gestação anterior
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
                Sim
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
                Não
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
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !todasDatasValidas}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar consulta
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
