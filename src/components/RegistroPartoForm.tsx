import { useEffect, useMemo, useState } from 'react';
import { classificarRN } from '@/lib/intergrowth';

import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';
import { FileText, Info, Loader2, Baby } from 'lucide-react';
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
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} aria-label="Mais informações">
            <Info className="h-3.5 w-3.5 text-[#9b87f5]" />
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
  // ── IG atual calculada a partir da DUM (badge no cabeçalho) ──
  const igAtual = useMemo(() => {
    if (!paciente.dum) return null;
    const dias = differenceInDays(new Date(), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente.dum]);

  // ── Estado dos campos ──
  const [viaParto, setViaParto] = useState<ViaParto>('');
  const [motivoCesarea, setMotivoCesarea] = useState('');
  const [igPartoSemanas, setIgPartoSemanas] = useState<string>('');
  const [igPartoDias, setIgPartoDias] = useState<string>('');
  const [igOrigem, setIgOrigem] = useState<IgOrigem>('auto');
  const [dataParto, setDataParto] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
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

  // ── Auto-cálculo da IG no parto a partir da DUM e da data do parto ──
  useEffect(() => {
    if (igOrigem === 'manual') return;
    if (!paciente.dum || !dataParto) return;
    const dias = differenceInDays(new Date(dataParto), new Date(paciente.dum));
    if (dias < 0) return;
    setIgPartoSemanas(String(Math.floor(dias / 7)));
    setIgPartoDias(String(dias % 7));
  }, [dataParto, paciente.dum, igOrigem]);

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
    if (!viaParto) e.viaParto = 'Selecione a via de parto.';
    if (viaParto === 'cesarea' && !motivoCesarea.trim())
      e.motivoCesarea = 'Informe o motivo da cesárea.';

    const sem = Number(igPartoSemanas);
    if (!igPartoSemanas || Number.isNaN(sem) || sem < 20 || sem > 42)
      e.igSemanas = 'Semanas: 20 a 42.';
    const dd = Number(igPartoDias);
    if (igPartoDias === '' || Number.isNaN(dd) || dd < 0 || dd > 6)
      e.igDias = 'Dias: 0 a 6.';

    if (!dataParto) e.dataParto = 'Informe a data do parto.';

    const peso = Number(pesoRn);
    if (!pesoRn || Number.isNaN(peso) || peso < 300 || peso > 6000)
      e.pesoRn = 'Peso: 300 a 6.000 g.';

    if (!sexoRn) e.sexoRn = 'Selecione o sexo do RN.';

    if (!classRn) e.classRn = 'Selecione a classificação.';

    const a1 = Number(apgar1);
    if (apgar1 === '' || Number.isNaN(a1) || a1 < 0 || a1 > 10)
      e.apgar1 = 'Apgar: 0 a 10.';
    const a5 = Number(apgar5);
    if (apgar5 === '' || Number.isNaN(a5) || a5 < 0 || a5 > 10)
      e.apgar5 = 'Apgar: 0 a 10.';

    if (!intercorrMat) e.intercorrMat = 'Responda sim ou não.';
    if (intercorrMat === 'sim' && !descIntercorrMat.trim())
      e.descIntercorrMat = 'Descreva as intercorrências maternas.';

    if (!intercorrNeo) e.intercorrNeo = 'Responda sim ou não.';
    if (intercorrNeo === 'sim' && !descIntercorrNeo.trim())
      e.descIntercorrNeo = 'Descreva as intercorrências neonatais.';

    if (!aleitamento) e.aleitamento = 'Responda sim ou não.';

    return e;
  }, [
    viaParto, motivoCesarea, igPartoSemanas, igPartoDias, dataParto,
    pesoRn, sexoRn, classRn, apgar1, apgar5, intercorrMat, descIntercorrMat,
    intercorrNeo, descIntercorrNeo, aleitamento,
  ]);

  const isValid = Object.keys(errors).length === 0;

  // ── Salvar ──
  async function handleSave() {
    if (!isValid) {
      toast.error('Preencha todos os campos obrigatórios.');
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
        toast.error('Paciente não encontrada.');
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
      toast.success('Registro do parto salvo. Ficha encerrada.');
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
      toast.error('Perfil profissional não encontrado.');
      return;
    }

    const proxNumero = (consultas?.length || 0) + 1;

    const { error: cErr } = await supabase.from('consultas').insert({
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
    });

    if (cErr) {
      console.error(cErr);
      setSaving(false);
      toast.error('Erro ao salvar registro do parto.');
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
      toast.error('Erro ao atualizar status da paciente.');
      return;
    }

    setSaving(false);
    toast.success('Registro do parto salvo. Ficha encerrada.');
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
              REGISTRO DO PARTO
            </h2>
            <p className="text-xs text-[#7E69AB]">
              Registre o desfecho perinatal para encerrar o acompanhamento.
            </p>
            <p className="text-xs text-[#64748B]">
              Preencha os dados do parto. Após salvar, esta ficha será encerrada.
            </p>
          </div>
          {igAtual && (
            <span className="inline-flex shrink-0 rounded-md bg-[#E8E0FF] px-2 py-1 text-[11px] font-medium text-[#7E69AB]">
              IG atual — {igAtual.semanas} sem + {igAtual.dias} dias
            </span>
          )}
        </div>

        {/* Nota dentro do card */}
        <div className="rounded-lg bg-[#E8E0FF] p-3">
          <p className="text-xs font-bold text-[#5B21B6] mb-1">Sobre o registro</p>
          <p className="text-xs text-[#6D28D9]">
            O registro do parto é opcional, mas recomendado. Ele contribui para o histórico
            longitudinal da paciente e para os indicadores clínicos da plataforma. Após
            salvar, esta ficha será encerrada.
          </p>
        </div>
      </div>

      {/* ── Formulário ── */}
      <form
        className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValid) {
            toast.error('Preencha todos os campos obrigatórios.');
            return;
          }
          setConfirmOpen(true);
        }}
      >
        {/* Via de parto */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            Via de parto <span className="text-destructive">*</span>
            <HelpIcon text="Selecione a via de parto." />
          </label>
          <Select value={viaParto} onValueChange={(v) => setViaParto(v as ViaParto)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vaginal">Vaginal</SelectItem>
              <SelectItem value="cesarea">Cesárea</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Motivo da cesárea (condicional) */}
        {viaParto === 'cesarea' && (
          <div className="space-y-1 animate-fade-in">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Motivo da cesárea <span className="text-destructive">*</span>
              <HelpIcon text="Informe o motivo principal da cesárea (ex: desproporção cefalopélvica, sofrimento fetal, solicitação materna, iteratividade)." />
            </label>
            <Input
              value={motivoCesarea}
              onChange={(e) => setMotivoCesarea(e.target.value)}
              placeholder="Ex: sofrimento fetal"
            />
          </div>
        )}

        {/* Data do parto + IG no parto lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Data do parto <span className="text-destructive">*</span>
              <HelpIcon text="Data em que o parto ocorreu. Default: hoje. Editável." />
            </label>
            <Input
              type="date"
              value={dataParto}
              onChange={(e) => setDataParto(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              IG no parto <span className="text-destructive">*</span>
              <HelpIcon text="Idade gestacional em semanas + dias no momento do parto. Calculada automaticamente a partir da DUM e da data do parto. Editável." />
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={20} max={42}
                value={igPartoSemanas}
                onChange={(e) => { setIgPartoSemanas(e.target.value); setIgOrigem('manual'); }}
                placeholder="Sem"
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">sem</span>
              <Input
                type="number" min={0} max={6}
                value={igPartoDias}
                onChange={(e) => { setIgPartoDias(e.target.value); setIgOrigem('manual'); }}
                placeholder="Dias"
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {igOrigem === 'auto'
                ? 'IG calculada automaticamente a partir da DUM e da data do parto. Edite se necessário.'
                : 'IG ajustada manualmente.'}
            </p>
          </div>
        </div>

        {/* Peso do RN + Sexo do RN lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Peso do RN (g) <span className="text-destructive">*</span>
              <HelpIcon text="Peso do recém-nascido em gramas. Ex: 3.450 g. Faixa: 300 a 6.000 g." />
            </label>
            <Input
              type="number" min={300} max={6000}
              value={pesoRn}
              onChange={(e) => setPesoRn(e.target.value)}
              placeholder="Ex: 3450"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Sexo do RN <span className="text-destructive">*</span>
              <HelpIcon text="Sexo do recém-nascido. Necessário para o cálculo automático da classificação (PIG/AIG/GIG)." />
            </label>
            <Select value={sexoRn} onValueChange={(v) => setSexoRn(v as SexoRNState)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Classificação do RN (auto-calculada) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Classificação do RN <span className="text-destructive">*</span>
              <HelpIcon text="Classificação conforme curva Intergrowth-21st (referência adotada pelo Ministério da Saúde). Calculada automaticamente a partir de peso, IG e sexo do RN. Editável." />
            </label>
            <Select
              value={classRn}
              onValueChange={(v) => {
                setClassRn(v as ClassRN);
                setClassOrigem('manual');
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AIG">AIG — adequado</SelectItem>
                <SelectItem value="GIG">GIG — grande</SelectItem>
                <SelectItem value="PIG">PIG — pequeno</SelectItem>
              </SelectContent>
            </Select>
            {classOrigem === 'auto' && (
              <p className="text-[12px] text-[#94A3B8]">
                Calculado automaticamente (Intergrowth-21st / Ministério da Saúde). Edite se necessário.
              </p>
            )}
            {classOrigem === 'manual' && (
              <p className="text-[12px] text-[#94A3B8]">
                Classificação ajustada manualmente.
              </p>
            )}
            {classOrigem === 'fora-cobertura' && (
              <p className="text-[12px] text-[#94A3B8]">
                IG fora da cobertura da curva Intergrowth-21st. Preencha manualmente.
              </p>
            )}
          </div>
          <div />
        </div>

        {/* Apgar 1' + 5' lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Apgar 1º minuto <span className="text-destructive">*</span>
              <HelpIcon text="Índice de Apgar no primeiro minuto de vida. Escala de 0 a 10." />
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
              Apgar 5º minuto <span className="text-destructive">*</span>
              <HelpIcon text="Índice de Apgar no quinto minuto de vida. Escala de 0 a 10." />
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
            Intercorrências maternas <span className="text-destructive">*</span>
            <HelpIcon text="Houve intercorrências maternas durante o parto? Ex: hemorragia pós-parto, infecção, histerectomia." />
          </label>
          <Select value={intercorrMat} onValueChange={(v) => setIntercorrMat(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {intercorrMat === 'sim' && (
          <div className="space-y-1 animate-fade-in">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Descrição das intercorrências maternas <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={3}
              value={descIntercorrMat}
              onChange={(e) => setDescIntercorrMat(e.target.value)}
              placeholder="Descreva as intercorrências maternas"
            />
          </div>
        )}

        {/* Intercorrências neonatais */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            Intercorrências neonatais <span className="text-destructive">*</span>
            <HelpIcon text="Houve intercorrências com o recém-nascido? Ex: hipoglicemia neonatal, internação em UTI neonatal, tocotrauma, síndrome do desconforto respiratório." />
          </label>
          <Select value={intercorrNeo} onValueChange={(v) => setIntercorrNeo(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao">Não</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {intercorrNeo === 'sim' && (
          <div className="space-y-1 animate-fade-in">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              Descrição das intercorrências neonatais <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={3}
              value={descIntercorrNeo}
              onChange={(e) => setDescIntercorrNeo(e.target.value)}
              placeholder="Descreva as intercorrências neonatais"
            />
          </div>
        )}

        {/* Aleitamento */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            Aleitamento materno na sala de parto <span className="text-destructive">*</span>
            <HelpIcon text="Contato pele a pele e primeira mamada na primeira hora de vida." />
          </label>
          <Select value={aleitamento} onValueChange={(v) => setAleitamento(v as SimNao)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Observações livres */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            Observações
            <HelpIcon text="Espaço para anotações adicionais sobre o parto ou o puerpério imediato." />
          </label>
          <Textarea
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
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
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
            disabled={!isValid || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <FileText className="mr-2 h-4 w-4" />
            Salvar registro do parto
          </Button>
        </div>
      </form>

      {/* Modal de confirmação */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar encerramento da ficha</AlertDialogTitle>
            <AlertDialogDescription>
              Ao salvar o registro do parto, esta ficha será encerrada. Você poderá
              consultar todo o histórico, mas não poderá adicionar novas consultas.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                handleSave().then(() => setConfirmOpen(false));
              }}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sim, registrar parto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
