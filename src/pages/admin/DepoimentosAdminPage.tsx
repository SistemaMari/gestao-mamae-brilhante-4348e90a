import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Star, Loader2, Check, X, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';

interface Depoimento {
  id: string;
  user_id: string;
  rating: number;
  texto: string | null;
  aprovado: boolean | null;
  created_at: string;
  autor?: string;
}

type Filtro = 'pendentes' | 'aprovados' | 'reprovados' | 'todos';

export default function DepoimentosAdminPage() {
  const [lista, setLista] = useState<Depoimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [aExcluir, setAExcluir] = useState<Depoimento | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('depoimentos_usuario')
      .select('id, user_id, rating, texto, aprovado, created_at')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar.'); setLoading(false); return; }
    const rows = (data as Depoimento[]) || [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profissionais').select('user_id, nome').in('user_id', ids);
      const map = new Map<string, string>();
      (profs || []).forEach((p: any) => map.set(p.user_id, p.nome));
      rows.forEach((r) => { r.autor = map.get(r.user_id) || '—'; });
    }
    setLista(rows);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const filtrada = useMemo(() => {
    if (filtro === 'todos') return lista;
    if (filtro === 'aprovados') return lista.filter((d) => d.aprovado === true);
    if (filtro === 'reprovados') return lista.filter((d) => d.aprovado === false);
    return lista.filter((d) => d.aprovado === null || d.aprovado === undefined);
  }, [lista, filtro]);

  const contadores = useMemo(() => ({
    pendentes: lista.filter((d) => d.aprovado === null || d.aprovado === undefined).length,
    aprovados: lista.filter((d) => d.aprovado === true).length,
    reprovados: lista.filter((d) => d.aprovado === false).length,
  }), [lista]);

  const moderar = async (id: string, aprovado: boolean) => {
    setUpdating(id);
    const { error } = await supabase.from('depoimentos_usuario').update({ aprovado }).eq('id', id);
    setUpdating(null);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    setLista((prev) => prev.map((d) => (d.id === id ? { ...d, aprovado } : d)));
    toast.success(aprovado ? 'Depoimento aprovado.' : 'Depoimento reprovado.');
  };

  const confirmarExcluir = async () => {
    if (!aExcluir) return;
    const { error } = await supabase.from('depoimentos_usuario').delete().eq('id', aExcluir.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    setLista((prev) => prev.filter((d) => d.id !== aExcluir.id));
    setAExcluir(null);
    toast.success('Depoimento excluído.');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const FiltroChip = ({ value, label, count }: { value: Filtro; label: string; count?: number }) => (
    <button
      type="button"
      onClick={() => setFiltro(value)}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        filtro === value
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}{count !== undefined && ` (${count})`}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              Depoimentos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aprove ou reprove depoimentos enviados pelos usuários.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FiltroChip value="pendentes" label="Pendentes" count={contadores.pendentes} />
        <FiltroChip value="aprovados" label="Aprovados" count={contadores.aprovados} />
        <FiltroChip value="reprovados" label="Reprovados" count={contadores.reprovados} />
        <FiltroChip value="todos" label="Todos" />
      </div>

      {filtrada.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum depoimento nesta categoria.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtrada.map((d) => (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-5 w-5 ${n <= d.rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
                {d.aprovado === true && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Aprovado</Badge>}
                {d.aprovado === false && <Badge variant="destructive">Reprovado</Badge>}
                {(d.aprovado === null || d.aprovado === undefined) && <Badge variant="outline">Pendente</Badge>}
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm text-foreground min-h-[3rem]">
                {d.texto || <em className="text-muted-foreground">Sem texto</em>}
              </p>
              <div className="mb-4 text-xs text-muted-foreground">
                {d.autor || 'Usuário'} · {formatDateBR(d.created_at)}
              </div>
              <div className="flex flex-wrap gap-2">
                {d.aprovado !== true && (
                  <Button size="sm" onClick={() => moderar(d.id, true)} disabled={updating === d.id}
                    className="bg-emerald-600 hover:bg-emerald-700">
                    <Check className="mr-1 h-4 w-4" /> Aprovar
                  </Button>
                )}
                {d.aprovado !== false && (
                  <Button size="sm" variant="outline" onClick={() => moderar(d.id, false)} disabled={updating === d.id}>
                    <X className="mr-1 h-4 w-4" /> Reprovar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                  onClick={() => setAExcluir(d)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir depoimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
