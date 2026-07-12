import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareHeart, Loader2, Search, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';

interface Feedback {
  id: string;
  user_id: string;
  tipo: string;
  mensagem: string;
  anexo_url: string | null;
  status: 'novo' | 'lido' | 'resolvido';
  created_at: string;
  autor?: string;
  email?: string;
}

const TIPO_LABEL: Record<string, string> = {
  sugestao: 'Sugestão',
  elogio: 'Elogio',
  erro: 'Erro',
  duvida: 'Dúvida',
};

const STATUS_STYLE: Record<string, string> = {
  novo: 'bg-primary/10 text-primary',
  lido: 'bg-muted text-muted-foreground',
  resolvido: 'bg-emerald-100 text-emerald-700',
};

export default function FeedbacksAdminPage() {
  const [lista, setLista] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('feedbacks_usuario')
      .select('id, user_id, tipo, mensagem, anexo_url, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar feedbacks: ' + error.message);
      setLoading(false);
      return;
    }
    const rows = (data as Feedback[]) || [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profissionais')
        .select('user_id, nome')
        .in('user_id', userIds);
      const map = new Map<string, string>();
      (profs || []).forEach((p: any) => map.set(p.user_id, p.nome));
      rows.forEach((r) => { r.autor = map.get(r.user_id) || '—'; });
    }
    setLista(rows);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const filtrada = useMemo(() => {
    return lista.filter((f) => {
      if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false;
      if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          (f.autor || '').toLowerCase().includes(q) ||
          f.mensagem.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [lista, filtroTipo, filtroStatus, busca]);

  const totalNovos = lista.filter((f) => f.status === 'novo').length;

  const atualizar = async (id: string, status: Feedback['status']) => {
    setUpdatingId(id);
    const { error } = await supabase.from('feedbacks_usuario').update({ status }).eq('id', id);
    setUpdatingId(null);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    setLista((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    toast.success('Status atualizado.');
  };

  const verAnexo = async (path: string) => {
    const { data } = await supabase.storage
      .from('avatares-profissionais')
      .createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareHeart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: 'Sora, sans-serif' }}>
              Feedbacks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mensagens enviadas pelos usuários no perfil. {totalNovos > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {totalNovos} novos
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por autor ou mensagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="sugestao">Sugestão</SelectItem>
            <SelectItem value="elogio">Elogio</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="duvida">Dúvida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="novo">Novos</SelectItem>
            <SelectItem value="lido">Lidos</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtrada.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          Nenhum feedback encontrado com esses filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtrada.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {TIPO_LABEL[f.tipo] || f.tipo}
                  </Badge>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}>
                    {f.status === 'novo' ? 'Novo' : f.status === 'lido' ? 'Lido' : 'Resolvido'}
                  </span>
                  <span className="text-sm font-medium text-foreground">{f.autor || 'Usuário'}</span>
                  <span className="text-xs text-muted-foreground">{formatDateBR(f.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={f.status}
                    onValueChange={(v) => atualizar(f.id, v as Feedback['status'])}
                    disabled={updatingId === f.id}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="lido">Lido</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{f.mensagem}</p>
              {f.anexo_url && (
                <button
                  type="button"
                  onClick={() => verAnexo(f.anexo_url!)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Paperclip className="h-3 w-3" /> Ver anexo
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
