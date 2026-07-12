import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquareHeart, Loader2, Search, Paperclip, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  email?: string | null;
  telefone?: string | null;
  tipo_perfil?: string | null;
  unidade_nome?: string | null;
  email_gestor_unidade?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  novo: 'bg-primary/10 text-primary',
  lido: 'bg-muted text-muted-foreground',
  resolvido: 'bg-emerald-100 text-emerald-700',
};

export default function FeedbacksAdminPage() {
  const { t } = useTranslation();
  const tipoLabel = (tipo: string) =>
    t(`admin.feedbacks.tipo.${tipo}`, { defaultValue: tipo });
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
      toast.error(t('admin.feedbacks.loadError', { error: error.message }));
      setLoading(false);
      return;
    }
    const rows = (data as Feedback[]) || [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: contatos } = await supabase.rpc('admin_get_contatos_usuarios', { _user_ids: userIds });
      const map = new Map<string, { nome: string; email: string | null; telefone: string | null; tipo_perfil: string | null; unidade_nome: string | null; email_gestor_unidade: string | null }>();
      (contatos || []).forEach((c: any) => map.set(c.user_id, {
        nome: c.nome, email: c.email, telefone: c.telefone,
        tipo_perfil: c.tipo_perfil ?? null,
        unidade_nome: c.unidade_nome ?? null,
        email_gestor_unidade: c.email_gestor_unidade ?? null,
      }));
      rows.forEach((r) => {
        const c = map.get(r.user_id);
        r.autor = c?.nome || '—';
        r.email = c?.email ?? null;
        r.telefone = c?.telefone ?? null;
        r.tipo_perfil = c?.tipo_perfil ?? null;
        r.unidade_nome = c?.unidade_nome ?? null;
        r.email_gestor_unidade = c?.email_gestor_unidade ?? null;
      });
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
    if (error) { toast.error(t('admin.feedbacks.updateError')); return; }
    setLista((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    toast.success(t('admin.feedbacks.statusUpdated'));
  };

  const verAnexo = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('avatares-profissionais')
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error(t('admin.feedbacks.attachmentError'));
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const construirCorpoResposta = (f: Feedback) => {
    const dataStr = formatDateBR(f.created_at);
    const tipoStr = tipoLabel(f.tipo);
    const notaCc = (f.tipo_perfil === 'institucional' && f.email_gestor_unidade)
      ? (f.unidade_nome
          ? `\n${t('admin.feedbacks.ccNoteWithUnit', { unidade: f.unidade_nome })}\n`
          : `\n${t('admin.feedbacks.ccNote')}\n`)
      : '';
    return (
      `${t('admin.feedbacks.emailGreeting', { nome: f.autor || '' })}\n\n` +
      `${t('admin.feedbacks.emailIntro')}\n` +
      notaCc +
      `\n\n---\n` +
      `${t('admin.feedbacks.emailHistoryTitle')}\n` +
      `${t('admin.feedbacks.emailDate', { data: dataStr })}\n` +
      `${t('admin.feedbacks.emailType', { tipo: tipoStr })}\n` +
      `${t('admin.feedbacks.emailMessageSent')}\n"${f.mensagem}"\n` +
      `---\n\n` +
      `${t('admin.feedbacks.emailSignature')}`
    );
  };

  const responderPorEmail = (f: Feedback) => {
    if (!f.email) return;
    const subject = t('admin.feedbacks.emailSubject', { tipo: tipoLabel(f.tipo), data: formatDateBR(f.created_at) });
    const body = construirCorpoResposta(f);
    // Institucional: envia cópia (Cc) para o Gestor da unidade, para transparência.
    const ccParam = (f.tipo_perfil === 'institucional' && f.email_gestor_unidade && f.email_gestor_unidade !== f.email)
      ? `&cc=${encodeURIComponent(f.email_gestor_unidade)}`
      : '';
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(f.email)}${ccParam}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (f.tipo_perfil === 'institucional' && !f.email_gestor_unidade) {
      toast.info(t('admin.feedbacks.noGestorInfo'));
    }
  };

  const responderPorWhatsapp = (f: Feedback) => {
    if (!f.telefone) return;
    const numero = f.telefone.replace(/\D/g, '');
    const texto =
      `${t('admin.feedbacks.whatsappGreeting', { nome: f.autor || '' })}\n\n` +
      `${t('admin.feedbacks.whatsappAbout', { data: formatDateBR(f.created_at), tipo: tipoLabel(f.tipo) })}\n` +
      `"${f.mensagem}"\n\n` +
      `${t('admin.feedbacks.whatsappResponse')}\n`;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
              {t('admin.feedbacks.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.feedbacks.subtitle')} {totalNovos > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t('admin.feedbacks.newCount', { count: totalNovos })}
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
            placeholder={t('admin.feedbacks.searchPlaceholder')}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('admin.feedbacks.allTypes')}</SelectItem>
            <SelectItem value="sugestao">{t('admin.feedbacks.tipo.sugestao')}</SelectItem>
            <SelectItem value="elogio">{t('admin.feedbacks.tipo.elogio')}</SelectItem>
            <SelectItem value="erro">{t('admin.feedbacks.tipo.erro')}</SelectItem>
            <SelectItem value="duvida">{t('admin.feedbacks.tipo.duvida')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('admin.feedbacks.allStatus')}</SelectItem>
            <SelectItem value="novo">{t('admin.feedbacks.statusNovoPlural')}</SelectItem>
            <SelectItem value="lido">{t('admin.feedbacks.statusLidoPlural')}</SelectItem>
            <SelectItem value="resolvido">{t('admin.feedbacks.statusResolvidoPlural')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtrada.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          {t('admin.feedbacks.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrada.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {tipoLabel(f.tipo)}
                  </Badge>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}>
                    {f.status === 'novo' ? t('admin.feedbacks.statusNovo') : f.status === 'lido' ? t('admin.feedbacks.statusLido') : t('admin.feedbacks.statusResolvido')}
                  </span>
                  {f.tipo_perfil === 'institucional' ? (
                    <Badge variant="outline" className="border-teal-500/40 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                      {t('admin.feedbacks.institucional')}{f.unidade_nome ? ` · ${f.unidade_nome}` : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                      {t('admin.feedbacks.consultorio')}
                    </Badge>
                  )}
                  <span className="text-sm font-medium text-foreground">{f.autor || t('admin.feedbacks.userFallback')}</span>
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
                      <SelectItem value="novo">{t('admin.feedbacks.statusNovo')}</SelectItem>
                      <SelectItem value="lido">{t('admin.feedbacks.statusLido')}</SelectItem>
                      <SelectItem value="resolvido">{t('admin.feedbacks.statusResolvido')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{f.mensagem}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {f.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{f.email}</span>}
                {f.telefone && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{f.telefone}</span>}
                {!f.email && !f.telefone && <span className="italic">{t('admin.feedbacks.noContact')}</span>}
                <div className="ml-auto flex flex-wrap gap-2">
                  {f.email && (
                    <button
                      type="button"
                      onClick={() => responderPorEmail(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <Mail className="h-3.5 w-3.5" /> {t('admin.feedbacks.replyByEmail')}
                    </button>
                  )}
                  {f.telefone && (
                    <button
                      type="button"
                      onClick={() => responderPorWhatsapp(f)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {t('admin.feedbacks.whatsapp')}
                    </button>
                  )}
                </div>
              </div>
              {f.anexo_url && (
                <button
                  type="button"
                  onClick={() => verAnexo(f.anexo_url!)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Paperclip className="h-3 w-3" /> {t('admin.feedbacks.viewAttachment')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
