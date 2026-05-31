import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Activity, Plus, Pencil, Loader2 } from 'lucide-react';
import UsgFlowSection, { emptyUsgFlow, UsgFlowValue } from '@/components/UsgFlowSection';
import { formatDateBR } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { addDays, differenceInDays } from 'date-fns';
import { calcIgHojeFromDum, calcIgHojeFromUsg, formatIgCurto } from '@/lib/fichaUtils';

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
  const [usgs, setUsgs] = useState<UsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [usgFlow, setUsgFlow] = useState<UsgFlowValue>({ ...emptyUsgFlow, jaFezUsg: 'sim' });
  const [saving, setSaving] = useState(false);
  const [refDraft, setRefDraft] = useState<RefDraft>(null);

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
        ? (usgAtiva.ordem === 1 ? '1ª USG' : `USG #${usgAtiva.ordem}`)
        : '1ª USG')
    : referenciaIg === 'dum'
      ? 'DUM'
      : 'não definida';

  const handleAddUsg = async () => {
    if (!usgFlow.dataExame || usgFlow.igSemanas === '') {
      toast.error('Preencha data e IG da USG.');
      return;
    }
    setSaving(true);
    const nextOrdem = (usgs[usgs.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from('exames_usg' as any).insert({
      paciente_id: pacienteId,
      data_exame: usgFlow.dataExame,
      ig_semanas: parseInt(usgFlow.igSemanas, 10),
      ig_dias: parseInt(usgFlow.igDias || '0', 10),
      ordem: nextOrdem,
    } as any);
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar USG.');
      return;
    }
    toast.success('USG registrada.');
    setOpenAdd(false);
    setUsgFlow({ ...emptyUsgFlow, jaFezUsg: 'sim' });
    await load();
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
      toast.error('Erro ao atualizar referência.');
      return;
    }
    toast.success('Referência de IG atualizada.');
    setOpenEdit(false);
    onChanged?.();
  };

  const proximaOrdem = (usgs[usgs.length - 1]?.ordem ?? 0) + 1;

  return (
    <div className="rounded-xl border border-[#7C4DBA]/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#7C4DBA]" />
          <h3 className="text-sm font-semibold text-[#5B21B6]">Ultrassonografias e referência de IG</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setUsgFlow({ ...emptyUsgFlow, jaFezUsg: 'sim' }); setOpenAdd(true); }}
          className="gap-1 border-[#7C4DBA] text-[#7C4DBA] hover:bg-[#E8E0FF]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Adicionar USG</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-[#E8E0FF] px-2 py-1 text-[#5B21B6] font-medium">
          IG hoje: {igHoje ? `${igHoje.semanas}s ${igHoje.dias}d` : '—'}
        </span>
        <span className="text-muted-foreground">
          referência: <strong className="text-foreground">{refLabel}</strong>
        </span>
        <button
          type="button"
          onClick={() => setOpenEdit(true)}
          className="inline-flex items-center gap-1 text-[#7C4DBA] hover:underline"
        >
          <Pencil className="h-3 w-3" /> editar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> carregando…
        </div>
      ) : usgs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma USG registrada.</p>
      ) : (
        <ul className="space-y-1.5">
          {usgs.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-md border border-border bg-[#F8F6FC] px-3 py-2 text-xs"
            >
              <span className="font-medium text-foreground">
                {u.ordem === 1 ? '1ª USG' : `USG #${u.ordem}`}
              </span>
              <span className="text-muted-foreground">
                {formatDateBR(u.data_exame)} - {formatIgCurto(calcIgHojeFromUsg(u))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Modal: adicionar nova USG */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar ultrassonografia</DialogTitle>
            <DialogDescription>
              Registre os dados do laudo. A 1ª USG é a referência preferencial.
            </DialogDescription>
          </DialogHeader>

          {/* Bloco 1 (33B): histórico de USGs já cadastradas */}
          <div className="rounded-xl border border-[#7C4DBA]/30 bg-[#F8F6FC] p-3 space-y-2">
            <h4 className="text-xs font-semibold text-[#5B21B6]">USGs já cadastradas</h4>
            {usgs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma USG anterior registrada.</p>
            ) : (
              <ul className="space-y-1.5">
                {usgs.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {u.ordem === 1 ? '1ª USG' : `USG #${u.ordem}`}
                      </span>
                      {u.ordem === 1 && (
                        <span className="text-[10px] font-medium bg-[#7C4DBA] text-white px-2 py-0.5 rounded-full">
                          referência preferencial
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
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
            <Button
              onClick={handleAddUsg}
              disabled={saving}
              className="bg-[#7C4DBA] hover:bg-[#7E69AB] text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar USG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: editar referência de IG — lista dinâmica (Bloco 2, 33B) */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Referência de IG</DialogTitle>
            <DialogDescription>
              Escolha qual fonte usar para calcular a idade gestacional desta paciente.
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
                  ? `DUM — ${formatDateBR(dum)} - ${formatIgCurto(calcIgHojeFromDum(dum))}`
                  : 'DUM (não informada)'}
              </span>
            </label>

            {usgs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground italic">
                Nenhuma USG registrada ainda. Adicione uma USG para liberar a opção.
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
                      {u.ordem === 1 ? '1ª USG' : `USG #${u.ordem}`} — {formatDateBR(u.data_exame)} - {formatIgCurto(calcIgHojeFromUsg(u))}
                    </span>
                    {u.ordem === 1 && (
                      <span className="text-[10px] font-medium bg-[#7C4DBA] text-white px-2 py-0.5 rounded-full">
                        referência preferencial
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
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
              Salvar referência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
