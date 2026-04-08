import { useState, useMemo } from 'react';
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
import { Info, Loader2 } from 'lucide-react';
import { differenceInYears, addDays } from 'date-fns';

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
  const [numeroId, setNumeroId] = useState('');
  const [igSemanas, setIgSemanas] = useState('');
  const [igDias, setIgDias] = useState('');
  const [dataConsulta, setDataConsulta] = useState(todayISO());
  const [observacoes, setObservacoes] = useState('');
  const [dmgAnterior, setDmgAnterior] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Determine if numero_identificacao field should show
  const identificadorPadrao = useMemo(() => {
    if (!profissionalData) return null;
    const id = (profissionalData as any).identificador_padrao;
    if (!id || id === 'nenhum') return null;
    return id;
  }, [profissionalData]);

  const identificadorLabel = useMemo(() => {
    if (identificadorPadrao === 'cpf') return 'CPF';
    if (identificadorPadrao === 'prontuario') return 'Prontuário';
    if (identificadorPadrao === 'cns') return 'CNS';
    return 'Número de identificação';
  }, [identificadorPadrao]);

  // In preview mode, always show the field
  const showNumeroId = isPreview || !!identificadorPadrao;

  const idade = useMemo(() => {
    if (!dataNascimento) return null;
    return differenceInYears(new Date(), new Date(dataNascimento));
  }, [dataNascimento]);

  const igAtConsulta = useMemo(() => {
    const s = parseInt(igSemanas, 10);
    const d = parseInt(igDias, 10) || 0;
    if (isNaN(s)) return null;
    return { semanas: s, dias: d };
  }, [igSemanas, igDias]);

  const dumCalculada = useMemo(() => {
    if (!igAtConsulta || !dataConsulta) return null;
    const totalDias = igAtConsulta.semanas * 7 + igAtConsulta.dias;
    return addDays(new Date(dataConsulta), -totalDias).toISOString().slice(0, 10);
  }, [igAtConsulta, dataConsulta]);

  const isValid = nome.trim() && dataNascimento && igSemanas && dataConsulta && dmgAnterior !== null;

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
        dum: dumCalculada,
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
            ig_semanas: parseInt(igSemanas, 10),
            ig_dias: parseInt(igDias, 10) || 0,
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
      dum: dumCalculada,
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
      ig_semanas: parseInt(igSemanas, 10),
      ig_dias: parseInt(igDias, 10) || 0,
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
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-heading text-xl font-bold text-foreground">Consulta 1 — Dados da Paciente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados iniciais e abra a ficha clínica com pedido de exame.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
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

          {/* Número de identificação (condicional) */}
          {showNumeroId && (
            <div className="space-y-2">
              <FieldLabel htmlFor="numero-id" tooltip="Prontuário, CPF ou outro identificador configurado no seu perfil.">
                {identificadorLabel}
              </FieldLabel>
              <Input
                id="numero-id"
                value={numeroId}
                onChange={(e) => setNumeroId(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          )}

          {/* Idade gestacional */}
          <div className="space-y-2">
            <FieldLabel required tooltip="Informe a IG em semanas e dias no momento desta consulta. A DUM será calculada automaticamente.">
              Idade gestacional na consulta
            </FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ig-semanas" className="text-xs text-muted-foreground">Semanas</Label>
                <Input
                  id="ig-semanas"
                  type="number"
                  min="0"
                  max="42"
                  value={igSemanas}
                  onChange={(e) => setIgSemanas(e.target.value)}
                  placeholder="Ex: 12"
                  className={fieldError(!!igSemanas)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ig-dias" className="text-xs text-muted-foreground">Dias</Label>
                <Input
                  id="ig-dias"
                  type="number"
                  min="0"
                  max="6"
                  value={igDias}
                  onChange={(e) => setIgDias(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            {errorMsg(!!igSemanas)}
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
