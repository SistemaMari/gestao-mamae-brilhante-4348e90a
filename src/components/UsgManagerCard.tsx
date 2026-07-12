import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Activity, Plus, Pencil, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UsgFlowSection, { emptyUsgFlow, UsgFlowValue } from '@/components/UsgFlowSection';
import { formatDateBR } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { addDays, differenceInDays } from 'date-fns';
import { calcIgHojeFromDum, calcIgHojeFromUsg, formatIgCurto } from '@/lib/fichaUtils';
import IgOrigemTooltip from '@/components/ficha/IgOrigemTooltip';
import { carimbarAtendimento } from '@/lib/carimbar';

type UsgRow = {
  id: string;
  data_exame: string;
  ig_semanas: number;
  ig_dias: number;
  ordem: number;
};

/**
 * Estado do rascunho de referência de IG (33B).
 * - { tipo: 'dum' }: usar DUM
 * - { tipo: 'usg', usgId }: usar USG identificada por usgId
 * - null: nenhuma selecionada ainda
 */
type RefDraft =
  | { tipo: 'dum' }
  | { tipo: 'usg'; usgId: string }
  | null;

interface Props {
  pacienteId: string;
  dum: string | null;
  referenciaIg: 'dum' | 'usg' | null | undefined;
  /**
   * id da USG ativa em exames_usg. NULL com referenciaIg='usg' significa
   * fallback silencioso para USG ordem=1.
   */
  referenciaUsgId?: string | null;
  isPreview: boolean;
  onChanged?: () => void;
}

/**
 * Bloco 3 + 4 + 33B: exibe lista de USGs registradas, referência de IG ativa,
 * permite trocar a referência (qualquer USG ou DUM) e adicionar nova USG.
 */
export default function UsgManagerCard({
  pacienteId, dum, referenciaIg, referenciaUsgId, isPreview, onChanged,
}: Props) {
  const { t } = useTranslation();
  const usgLabel = (ordem: number) =>
    ordem === 1 ? t('usg.firstUsg') : t('usg.usgOrdem', { ordem });
  const [usgs, setUsgs] = useState<UsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [usgFlow, setUsgFlow] = useState<UsgFlowValue>({ ...emptyUsgFlow, jaFezUsg: 'sim' });
  const [saving, setSaving] = useState(false);
  const [refDraft, setRefDraft] = useState<RefDraft>(null);

  // CRUD de USGs: estado para edição inline (modal próprio) e exclusão (AlertDialog).
  const [openEditUsg, setOpenEditUsg] = useState<UsgRow | null>(null);
  const [editFlow, setEditFlow] = useState<UsgFlowValue>({ ...emptyUsgFlow, jaFezUsg: 'sim' });
  const [confirmDelete, setConfirmDelete] = useState<UsgRow | null>(null);

  // 34C-B2: ao mudar a âncora (referência ou dados de USG), invalida a query única
  // de IG (['ig', pacienteId]) para TODAS as fichas rebuscarem o RPC calcular_ig e
  // recalcularem a IG na hora. Sem isso, o useIg seguia no valor cacheado (staleTime
  // 5min) e a "Idade gestacional atual" não trocava ao trocar a referência.
  const queryClient = useQueryClient();
  const invalidarIg = useCallback(
    () => { void queryClient.invalidateQueries({ queryKey: ['ig', pacienteId] }); },
    [queryClient, pacienteId],
  );

  const load = useCallback(async () => {
    if (isPreview) {
      setUsgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('exames_usg' as any)
      .select('id,data_exame,ig_semanas,ig_dias,ordem')
      .eq('paciente_id', pacienteId)
      .order('ordem', { ascending: true });
    if (!error && data) setUsgs(data as any);
    setLoading(false);
  }, [pacienteId, isPreview]);

  useEffect(() => { void load(); }, [load]);

  // Sincroniza refDraft com props quando elas mudam (ex.: novo paciente carregado).
  useEffect(() => {
    if (referenciaIg === 'dum') {
      setRefDraft({ tipo: 'dum' });
    } else if (referenciaIg === 'usg') {
      // Se vier id, usa; senão fallback ordem=1 quando estiver disponível.
      if (referenciaUsgId) {
        setRefDraft({ tipo: 'usg', usgId: referenciaUsgId });
      } else {
        const ordem1 = usgs.find(u => u.ordem === 1);
        setRefDraft(ordem1 ? { tipo: 'usg', usgId: ordem1.id } : null);
      }
    } else {
      setRefDraft(null);
    }
  }, [referenciaIg, referenciaUsgId, usgs]);

  // IG hoje considerando referência ativa.
  // Aplica fallback (33B): ref='usg' + usgId=NULL → usa USG ordem=1.
  const usgAtiva: UsgRow | null = (() => {
    if (referenciaIg !== 'usg') return null;
    if (referenciaUsgId) {
      const found = usgs.find(u => u.id === referenciaUsgId);
      if (found) return found;
    }
    return usgs.find(u => u.ordem === 1) ?? null;
  })();

  let igHoje: { semanas: number; dias: number } | null = null;
  let refBase: Date | null = null;
  if (usgAtiva) {
    const exam = new Date(usgAtiva.data_exame + 'T00:00:00');
    refBase = addDays(exam, -(usgAtiva.ig_semanas * 7 + usgAtiva.ig_dias));
  } else if (dum) {
    refBase = new Date(dum + 'T00:00:00');
  }
  if (refBase) {
    const dias = differenceInDays(new Date(), refBase);
    if (dias >= 0) igHoje = { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }

  const refLabel = referenciaIg === 'usg'
    ? (usgAtiva
        ? usgLabel(usgAtiva.ordem)
        : t('usg.firstUsg'))
    : referenciaIg === 'dum'
      ? t('usg.dum')
      : t('usg.notDefined');

  const handleAddUsg = async () => {
    if (!usgFlow.dataExame || usgFlow.igSemanas === '') {
      toast.error(t('usg.errors.fillDateAndIg'));
      return;
    }
    // Validação local pré-INSERT: mesmo dia da paciente já cadastrado?
    // A constraint UNIQUE(paciente_id, data_exame) no banco rejeita isso,
    // mas detectar localmente dá mensagem amigável imediata.
    const dataJaCadastrada = usgs.some((u) => u.data_exame === usgFlow.dataExame);
    if (dataJaCadastrada) {
      toast.error(t('usg.errors.duplicateDateHistory'));
      return;
    }
    setSaving(true);
    const nextOrdem = (usgs[usgs.length - 1]?.ordem ?? 0) + 1;
    // Bug fix: o INSERT retorna o id da nova USG para usar como referencia_usg_id
    // quando o usuário marcou "USG" como referência no UsgFlowSection. Antes,
    // o handleAddUsg só fazia INSERT e ignorava o usgFlow.referenciaIg, fazendo
    // o card seguir mostrando "referência: DUM" mesmo quando o usuário escolheu USG.
    const { data: novaUsg, error } = await supabase
      .from('exames_usg' as any)
      .insert({
        paciente_id: pacienteId,
        data_exame: usgFlow.dataExame,
        ig_semanas: parseInt(usgFlow.igSemanas, 10),
        ig_dias: parseInt(usgFlow.igDias || '0', 10),
        ordem: nextOrdem,
      } as any)
      .select('id')
      .single();
    if (error || !novaUsg) {
      setSaving(false);
      console.error(error);
      // Detecta erros comuns para mensagem mais útil
      const err = error as { code?: string; message?: string } | null;
      if (err?.code === '23505') {
        // unique_violation — provavelmente data duplicada (paciente_id + data_exame)
        toast.error(t('usg.errors.duplicateDate'));
      } else if (err?.code === '23514' || (err?.message ?? '').includes('check_violation')) {
        // check_violation — provavelmente data futura (trigger exames_usg_valida_data)
        toast.error(t('usg.errors.futureDate'));
      } else {
        toast.error(
          err?.message
            ? t('usg.errors.saveWithMessage', { message: err.message })
            : t('usg.errors.saveGeneric'),
        );
      }
      return;
    }

    // 40B (3.3): registra a inserção da USG no histórico de atendimentos.
    const novoId = (novaUsg as unknown as { id: string }).id;
    await carimbarAtendimento({ pacienteId, tipoOperacao: 'inserir_usg', recursoId: novoId, recursoTipo: 'usg' });

    // Define a referência de IG após adicionar a USG:
    //  - escolha explícita do médico no fluxo (usg/dum) sempre manda;
    //  - sem escolha: a USG vence a DUM (1ª USG = referência preferencial) quando
    //    a referência atual NÃO é uma USG; se já houver USG de referência, mantém
    //    a atual — a troca ENTRE USGs é manual ("sem default" entre USGs).
    let novaRef: { referencia_ig: 'usg' | 'dum'; referencia_usg_id: string | null } | null = null;
    if (usgFlow.referenciaIg === 'usg') {
      novaRef = { referencia_ig: 'usg', referencia_usg_id: novoId };
    } else if (usgFlow.referenciaIg === 'dum') {
      novaRef = { referencia_ig: 'dum', referencia_usg_id: null };
    } else if (referenciaIg !== 'usg') {
      // Sem escolha e a referência atual é DUM/indefinida → preferir a nova USG.
      novaRef = { referencia_ig: 'usg', referencia_usg_id: novoId };
    }
    if (novaRef) {
      const { error: refErr } = await supabase
        .from('pacientes')
        .update(novaRef as any)
        .eq('id', pacienteId);
      if (refErr) console.error('[UsgManagerCard] falha ao atualizar referência de IG:', refErr);
      // 40B (3.3): a referência de IG mudou → registra a troca.
      else await carimbarAtendimento({ pacienteId, tipoOperacao: 'trocar_referencia_ig', recursoId: novaRef.referencia_usg_id ?? undefined, recursoTipo: 'paciente' });
    }

    setSaving(false);
    toast.success(t('usg.toasts.registered'));
    setOpenAdd(false);
    setUsgFlow({ ...emptyUsgFlow, jaFezUsg: 'sim' });
    await load();
    invalidarIg();
    onChanged?.();
  };

  // Abre o modal de edição populando o usgFlow com os valores atuais da USG.
  const abrirEdicaoUsg = (u: UsgRow) => {
    setEditFlow({
      jaFezUsg: 'sim',
      dataExame: u.data_exame,
      igSemanas: String(u.ig_semanas),
      igDias: String(u.ig_dias),
      referenciaIg: null, // edição não muda a referência ativa; usuário usa "Trocar referência"
    });
    setOpenEditUsg(u);
  };

  const handleEditUsg = async () => {
    const alvo = openEditUsg;
    if (!alvo) return;
    if (!editFlow.dataExame || editFlow.igSemanas === '') {
      toast.error(t('usg.errors.fillDateAndIg'));
      return;
    }
    // Bloqueia colisão com outras USGs da mesma paciente em outra data
    const conflito = usgs.some(
      (u) => u.id !== alvo.id && u.data_exame === editFlow.dataExame,
    );
    if (conflito) {
      toast.error(t('usg.errors.duplicateDateOther'));
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('exames_usg' as any)
      .update({
        data_exame: editFlow.dataExame,
        ig_semanas: parseInt(editFlow.igSemanas, 10),
        ig_dias: parseInt(editFlow.igDias || '0', 10),
      } as any)
      .eq('id', alvo.id);
    setSaving(false);
    if (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === '23505') {
        toast.error(t('usg.errors.duplicateDateShort'));
      } else if (err.code === '23514') {
        toast.error(t('usg.errors.futureDate'));
      } else {
        toast.error(err.message ? t('usg.errors.editWithMessage', { message: err.message }) : t('usg.errors.editGeneric'));
      }
      return;
    }
    toast.success(t('usg.toasts.updated'));
    setOpenEditUsg(null);
    await load();
    invalidarIg();
    onChanged?.();
  };

  const handleDeleteUsg = async () => {
    const alvo = confirmDelete;
    if (!alvo) return;
    setSaving(true);
    // Se a USG sendo deletada é a referência ativa, decide o que vai virar referência.
    // Regra: se houver outra USG, mantém ref='usg' apontando para a próxima de menor ordem
    // (ordem=1 se existir, senão a primeira da lista ordenada); se não houver mais nenhuma
    // USG, cai pra DUM quando a paciente tiver DUM, ou limpa para null.
    const ehReferenciaAtiva = referenciaIg === 'usg' && referenciaUsgId === alvo.id;

    const { error: delErr } = await supabase
      .from('exames_usg' as any)
      .delete()
      .eq('id', alvo.id);
    if (delErr) {
      setSaving(false);
      console.error(delErr);
      toast.error(t('usg.errors.delete'));
      return;
    }

    if (ehReferenciaAtiva) {
      const remanescentes = usgs.filter((u) => u.id !== alvo.id);
      const proxima = remanescentes.find((u) => u.ordem === 1) ?? remanescentes[0] ?? null;
      const refUpdate: { referencia_ig: 'dum' | 'usg' | null; referencia_usg_id: string | null } = proxima
        ? { referencia_ig: 'usg', referencia_usg_id: proxima.id }
        : dum
          ? { referencia_ig: 'dum', referencia_usg_id: null }
          : { referencia_ig: null, referencia_usg_id: null };
      const { error: refErr } = await supabase
        .from('pacientes')
        .update(refUpdate as any)
        .eq('id', pacienteId);
      if (refErr) console.error('[UsgManagerCard] falha ao realocar referência após exclusão:', refErr);
      // 40B (3.3): a exclusão realocou a referência de IG → registra a troca.
      else await carimbarAtendimento({ pacienteId, tipoOperacao: 'trocar_referencia_ig', recursoId: refUpdate.referencia_usg_id ?? undefined, recursoTipo: 'paciente' });
    }

    setSaving(false);
    toast.success(t('usg.toasts.deleted'));
    setConfirmDelete(null);
    await load();
    invalidarIg();
    onChanged?.();
  };

  const handleSaveRef = async () => {
    if (!refDraft) return;
    setSaving(true);
    const payload: { referencia_ig: 'dum' | 'usg'; referencia_usg_id: string | null } =
      refDraft.tipo === 'dum'
        ? { referencia_ig: 'dum', referencia_usg_id: null }
        : { referencia_ig: 'usg', referencia_usg_id: refDraft.usgId };
    const { error } = await supabase.from('pacientes').update(payload as any).eq('id', pacienteId);
    setSaving(false);
    if (error) {
      toast.error(t('usg.errors.updateRef'));
      return;
    }
    // 40B (3.3): troca explícita da referência de IG.
    await carimbarAtendimento({ pacienteId, tipoOperacao: 'trocar_referencia_ig', recursoId: payload.referencia_usg_id ?? undefined, recursoTipo: 'paciente' });
    toast.success(t('usg.toasts.refUpdated'));
    setOpenEdit(false);
    invalidarIg();
    onChanged?.();
  };

  const proximaOrdem = (usgs[usgs.length - 1]?.ordem ?? 0) + 1;

  return (
    <div className="rounded-xl border border-[#7C4DBA]/30 bg-card p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#7C4DBA]" />
          <h3 className="text-sm font-semibold text-[#5B21B6]">{t('usg.cardTitle')}</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setUsgFlow({ ...emptyUsgFlow, jaFezUsg: 'sim' }); setOpenAdd(true); }}
          className="gap-1 border-[#7C4DBA] text-[#7C4DBA] hover:bg-[#E8E0FF]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">{t('usg.addUsg')}</span>
        </Button>
      </div>

      {/* 34B.3 seção 3.9 — bloco destacado de Referência de IG ativa */}
      <div className="rounded-lg border border-[#7C4DBA]/40 bg-[#F8F6FC] px-3 py-2.5 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5B21B6]">
            📌 {t('usg.refLabel')}{' '}
            <span className="text-foreground">
              {refLabel}
              {referenciaIg === 'dum' && dum ? ` (${formatDateBR(dum)})` : ''}
              {referenciaIg === 'usg' && usgAtiva ? ` (${formatDateBR(usgAtiva.data_exame)})` : ''}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpenEdit(true)}
            className="inline-flex items-center gap-1 rounded-md border border-[#7C4DBA] px-2 py-1 text-[11px] font-medium text-[#7C4DBA] hover:bg-[#E8E0FF] focus:outline-none focus:ring-2 focus:ring-[#7C4DBA]/40"
            aria-label={t('usg.changeRefAria')}
          >
            <Pencil className="h-3 w-3" /> {t('usg.changeRef')}
          </button>
        </div>
        <p className="inline-flex items-center gap-1 text-xs text-foreground">
          {t('usg.igToday')}{' '}
          <span className="font-semibold">
            {igHoje ? t('usg.igFormat', { semanas: igHoje.semanas, dias: igHoje.dias }) : '—'}
          </span>
          <IgOrigemTooltip
            referenciaIg={referenciaIg ?? null}
            dum={dum}
            usgAtiva={usgAtiva}
          />
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {t('usg.loading')}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {/* DUM como primeira linha quando informada — formato consistente com as USGs */}
          {dum && (
            <li className="flex items-center justify-between rounded-md border border-border bg-[#F8F6FC] px-3 py-2 text-xs">
              <span className="font-medium text-foreground">{t('usg.dum')}</span>
              <span className="text-muted-foreground">
                {formatDateBR(dum)} - {formatIgCurto(calcIgHojeFromDum(dum))}
              </span>
            </li>
          )}

          {usgs.length === 0 && !dum && (
            <li className="rounded-md border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground italic">
              {t('usg.emptyNoUsgNoDum')}
            </li>
          )}

          {usgs.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-[#F8F6FC] px-3 py-2 text-xs"
            >
              <span className="font-medium text-foreground">
                {usgLabel(u.ordem)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {formatDateBR(u.data_exame)} - {formatIgCurto(calcIgHojeFromUsg(u))}
                </span>
                <div className="flex items-center gap-1 print:hidden">
                  <button
                    type="button"
                    onClick={() => abrirEdicaoUsg(u)}
                    className="rounded p-1 text-[#7C4DBA] hover:bg-[#E8E0FF] focus:outline-none focus:ring-2 focus:ring-[#7C4DBA]/40"
                    aria-label={t('usg.editAria', { label: usgLabel(u.ordem) })}
                    title={t('usg.editTitle')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(u)}
                    className="rounded p-1 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400/40"
                    aria-label={t('usg.deleteAria', { label: usgLabel(u.ordem) })}
                    title={t('usg.deleteTitle')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal: adicionar nova USG */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('usg.addModalTitle')}</DialogTitle>
            <DialogDescription>
              {t('usg.addModalDesc')}
            </DialogDescription>
          </DialogHeader>

          {/* Bloco 1 (33B): histórico de USGs já cadastradas */}
          <div className="rounded-xl border border-[#7C4DBA]/30 bg-[#F8F6FC] p-3 space-y-2">
            <h4 className="text-xs font-semibold text-[#5B21B6]">{t('usg.alreadyRegistered')}</h4>
            {usgs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t('usg.noPreviousUsg')}</p>
            ) : (
              <ul className="space-y-1.5">
                {usgs.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {usgLabel(u.ordem)}
                      </span>
                      {u.ordem === 1 && (
                        <span className="text-[10px] font-medium bg-[#7C4DBA] text-white px-2 py-0.5 rounded-full">
                          {t('usg.preferredReference')}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {formatDateBR(u.data_exame)} - {formatIgCurto(calcIgHojeFromUsg(u))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <UsgFlowSection
            value={usgFlow}
            onChange={setUsgFlow}
            dum={dum ?? ''}
            dumDesconhecida={!dum}
            jaPossuiUsg={usgs.length > 0}
            ehPrimeiraUsg={usgs.length === 0}
            numeroOrdem={proximaOrdem}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleAddUsg}
              disabled={saving}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('usg.saveUsg')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: editar referência de IG — lista dinâmica (Bloco 2, 33B) */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('usg.refModalTitle')}</DialogTitle>
            <DialogDescription>
              {t('usg.refModalDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                refDraft?.tipo === 'dum' ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
              } ${!dum ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="ref-ig-edit"
                disabled={!dum}
                checked={refDraft?.tipo === 'dum'}
                onChange={() => setRefDraft({ tipo: 'dum' })}
              />
              <span>
                {dum
                  ? t('usg.dumOption', { data: formatDateBR(dum), ig: formatIgCurto(calcIgHojeFromDum(dum)) })
                  : t('usg.dumNotInformed')}
              </span>
            </label>

            {usgs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground italic">
                {t('usg.noUsgYetHint')}
              </div>
            ) : (
              usgs.map((u) => {
                const checked = refDraft?.tipo === 'usg' && refDraft.usgId === u.id;
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${
                      checked ? 'border-[#7C4DBA] bg-[#7C4DBA]/5' : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ref-ig-edit"
                      checked={checked}
                      onChange={() => setRefDraft({ tipo: 'usg', usgId: u.id })}
                    />
                    <span className="flex-1">
                      {usgLabel(u.ordem)} — {formatDateBR(u.data_exame)} - {formatIgCurto(calcIgHojeFromUsg(u))}
                    </span>
                    {u.ordem === 1 && (
                      <span className="text-[10px] font-medium bg-[#7C4DBA] text-white px-2 py-0.5 rounded-full">
                        {t('usg.preferredReference')}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSaveRef}
              disabled={
                saving ||
                !refDraft ||
                (refDraft.tipo === 'usg' && !refDraft.usgId)
              }
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('usg.saveRef')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: editar uma USG existente */}
      <Dialog open={!!openEditUsg} onOpenChange={(open) => { if (!open) setOpenEditUsg(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('usg.editModalTitle', { label: openEditUsg ? usgLabel(openEditUsg.ordem) : '' })}
            </DialogTitle>
            <DialogDescription>
              {t('usg.editModalDesc')}
            </DialogDescription>
          </DialogHeader>
          {openEditUsg && (
            <UsgFlowSection
              value={editFlow}
              onChange={setEditFlow}
              dum={dum ?? ''}
              dumDesconhecida={!dum}
              jaPossuiUsg={true}
              ehPrimeiraUsg={openEditUsg.ordem === 1}
              numeroOrdem={openEditUsg.ordem}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditUsg(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleEditUsg}
              disabled={saving}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('usg.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de USG */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              {t('usg.deleteConfirmTitle', { label: confirmDelete ? usgLabel(confirmDelete.ordem) : '' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>
                {t('usg.deleteConfirmDesc', { data: confirmDelete ? formatDateBR(confirmDelete.data_exame) : '' })}
              </span>
              {confirmDelete && referenciaIg === 'usg' && referenciaUsgId === confirmDelete.id && (
                <span className="block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {t('usg.deleteConfirmActiveRefWarning')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <AlertDialogAction
              onClick={handleDeleteUsg}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
