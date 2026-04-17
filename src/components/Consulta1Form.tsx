import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { addPreviewPaciente } from '@/lib/previewPatients';
import { countries } from '@/data/locationData';
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
  const [dum, setDum] = useState('');
  const [dataConsulta, setDataConsulta] = useState(todayISO());
  const [observacoes, setObservacoes] = useState('');
  const [dmgAnterior, setDmgAnterior] = useState<boolean | null>(null);
  const [pais, setPais] = useState('Brasil');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const idade = useMemo(() => {
    if (!dataNascimento) return null;
    return differenceInYears(new Date(), new Date(dataNascimento));
  }, [dataNascimento]);

  // Location cascading logic
  const selectedCountry = useMemo(() => countries.find((c) => c.value === pais), [pais]);
  const stateList = selectedCountry?.states || [];
  const selectedState = useMemo(() => stateList.find((s) => s.value === estado), [stateList, estado]);
  const cityList = selectedState?.cities || [];
  const isOutro = pais === 'Outro';

  const isValid = nome.trim() && dataNascimento && dum && dataConsulta && dmgAnterior !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isValid) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (isPreview) {
      const consultaId = crypto.randomUUID();
      const newPaciente = addPreviewPaciente({
        nome: nome.trim(),
        data_nascimento: dataNascimento,
        numero_identificacao: numeroId.trim() || null,
        tipo_identificacao: tipoIdentificacao,
        dum,
        pais,
        estado: estado || null,
        cidade: cidade || null,
        usg_data: null,
        usg_ig_semanas: null,
        usg_ig_dias: null,
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
      toast.success('Consulta 1 registrada com sucesso!');
      navigate(`/vitrine/paciente/${newPaciente.id}`);
      return;
    }

    // Real mode
    if (!profissionalData || !user) {
      toast.error('Você precisa estar logado.');
      return;
    }

    setSaving(true);

    const { data: podeCriar } = await supabase.rpc('pode_criar_ficha', {
      p_profissional_id: profissionalData.id,
    });

    if (!podeCriar) {
      toast.error('Limite de fichas atingido para o plano atual.');
      setSaving(false);
      return;
    }

    const pacientePayload: Record<string, unknown> = {
      nome: nome.trim(),
      profissional_id: profissionalData.id,
      data_nascimento: dataNascimento,
      numero_identificacao: numeroId.trim() || null,
      tipo_identificacao: tipoIdentificacao,
      dum,
      pais,
      estado: estado || null,
      cidade: cidade || null,
      dmg_gestacao_anterior: dmgAnterior === true,
      data_ultima_consulta: dataConsulta,
      status_ficha: 'aguardando_gj',
    };

    if ('unidade_id' in profissionalData) {
      pacientePayload.unidade_id = (profissionalData as any).unidade_id || null;
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

    const { error: consErr } = await supabase.from('consultas').insert({
      paciente_id: pacienteData.id,
      profissional_id: profissionalData.id,
      tipo: 'consulta_1',
      numero_sequencial: 1,
      data: dataConsulta,
      observacoes: observacoes.trim() || null,
      status_gerado: 'aguardando_gj',
    });

    setSaving(false);

    if (consErr) {
      toast.error('Paciente criada, mas erro ao registrar consulta.');
      console.error(consErr);
    } else {
      toast.success('Consulta 1 registrada com sucesso!');
    }

    navigate(`/paciente/${pacienteData.id}`);
  };

  const fieldError = (valid: boolean) =>
    touched && !valid ? 'border-destructive ring-1 ring-destructive' : '';

  const errorMsg = (valid: boolean) =>
    touched && !valid ? (
      <span className="text-xs text-destructive">Campo obrigatório</span>
    ) : null;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-xl border border-[#9b87f5] bg-[#F1F0FB] p-4 space-y-1">
        <h1 className="text-base font-bold text-[#5B21B6] flex items-center gap-2">
          <FileText className="h-5 w-5" />
          CONSULTA 1 — Dados da Paciente
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
              <Input
                id="data-nasc"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={`flex-1 ${fieldError(!!dataNascimento)}`}
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

          {/* País / Estado / Cidade */}
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
                <Select value={cidade} onValueChange={setCidade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityList.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* DUM */}
          <div className="space-y-2">
            <FieldLabel htmlFor="dum" required tooltip="Data da última menstruação. Usada para calcular a idade gestacional automaticamente.">
              DUM (Data da última menstruação)
            </FieldLabel>
            <Input
              id="dum"
              type="date"
              value={dum}
              onChange={(e) => setDum(e.target.value)}
              className={fieldError(!!dum)}
            />
            {errorMsg(!!dum)}
          </div>

          {/* Data da consulta */}
          <div className="space-y-2">
            <FieldLabel htmlFor="data-consulta" required tooltip="Data em que esta consulta está sendo realizada. Padrão: hoje.">
              Data da consulta
            </FieldLabel>
            <Input
              id="data-consulta"
              type="date"
              value={dataConsulta}
              onChange={(e) => setDataConsulta(e.target.value)}
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
                    ? 'border-[#9b87f5] bg-[#9b87f5]/10 text-[#9b87f5]'
                    : 'border-[#9b87f5]/30 bg-card text-muted-foreground hover:border-[#9b87f5]/60'
                } ${touched && dmgAnterior === null ? 'border-destructive' : ''}`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setDmgAnterior(false)}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                  dmgAnterior === false
                    ? 'border-[#9b87f5] bg-[#9b87f5]/10 text-[#9b87f5]'
                    : 'border-[#9b87f5]/30 bg-card text-muted-foreground hover:border-[#9b87f5]/60'
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
              disabled={saving}
              className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
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
