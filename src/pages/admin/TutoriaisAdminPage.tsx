import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  PlayCircle, Plus, Pencil, Trash2, Film, Loader2, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BUCKET = 'tutoriais';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Botão nativo "Escolher arquivo" com destaque visual (roxo claro), separado do
// nome do arquivo (texto padrão).
const FILE_INPUT_CLASS =
  'cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 ' +
  'file:bg-[#E8E0FF] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#7C4DBA] ' +
  'hover:file:bg-[#dcd0ff]';

const PERFIS = ['consultorio', 'institucional', 'gestor', 'gestor_geral', 'admin'] as const;
type Perfil = (typeof PERFIS)[number];

const PERFIL_LABEL: Record<Perfil, string> = {
  consultorio: 'Consultório',
  institucional: 'Institucional',
  gestor: 'Gestor',
  gestor_geral: 'Gestor Geral',
  admin: 'Administrador',
};

interface TutorialRow {
  id: string;
  perfil: string;
  titulo: string;
  descricao: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  ordem: number;
  ativo: boolean;
}

interface FormState {
  id: string | null;
  perfil: Perfil;
  titulo: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  video_path: string | null;
  thumbnail_path: string | null;
  videoFile: File | null;
  thumbFile: File | null;
}

function novoForm(perfil: Perfil): FormState {
  return {
    id: null, perfil, titulo: '', descricao: '', ordem: 0, ativo: true,
    video_path: null, thumbnail_path: null, videoFile: null, thumbFile: null,
  };
}

function extDe(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : 'bin';
}

/**
 * Upload para o Storage via XHR (o `supabase.storage.upload()` não expõe
 * progresso nem cancelamento). Reporta % via onProgress e guarda o XHR em
 * xhrRef para permitir abort(). Replica o formato do storage-js (FormData).
 */
async function uploadArquivo(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
  xhrRef: { current: XMLHttpRequest | null },
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const formData = new FormData();
  formData.append('cacheControl', '3600');
  formData.append('', file, file.name);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
    xhr.onabort = () => reject(new DOMException('cancelado', 'AbortError'));
    xhr.send(formData);
  });
}

export default function TutoriaisAdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [faseUpload, setFaseUpload] = useState('Enviando');
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [excluirAlvo, setExcluirAlvo] = useState<TutorialRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-tutoriais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutoriais')
        .select('id, perfil, titulo, descricao, video_path, thumbnail_path, ordem, ativo')
        .order('perfil', { ascending: true })
        .order('ordem', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as TutorialRow[];

      const thumbPaths = rows
        .map((r) => r.thumbnail_path)
        .filter((p): p is string => Boolean(p));
      const thumbUrls: Record<string, string> = {};
      if (thumbPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(thumbPaths, 60 * 60);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) thumbUrls[s.path] = s.signedUrl;
        });
      }
      return { rows, thumbUrls };
    },
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-tutoriais'] });

  async function salvar() {
    if (!form) return;
    if (!form.titulo.trim()) {
      toast.error('Informe o título do vídeo.');
      return;
    }
    if (!form.id && !form.videoFile) {
      toast.error('Selecione o arquivo de vídeo.');
      return;
    }
    setSaving(true);
    try {
      let videoPath = form.video_path;
      let thumbPath = form.thumbnail_path;

      if (form.videoFile) {
        const novo = `${form.perfil}/${crypto.randomUUID()}.${extDe(form.videoFile.name)}`;
        setFaseUpload('Enviando vídeo');
        setUploadPct(0);
        await uploadArquivo(novo, form.videoFile, setUploadPct, xhrRef);
        if (form.video_path) await supabase.storage.from(BUCKET).remove([form.video_path]);
        videoPath = novo;
      }

      if (form.thumbFile) {
        const novo = `${form.perfil}/thumb-${crypto.randomUUID()}.${extDe(form.thumbFile.name)}`;
        setFaseUpload('Enviando thumbnail');
        setUploadPct(0);
        await uploadArquivo(novo, form.thumbFile, setUploadPct, xhrRef);
        if (form.thumbnail_path) await supabase.storage.from(BUCKET).remove([form.thumbnail_path]);
        thumbPath = novo;
      }

      // Upload concluído → fase de gravação no banco ("Salvando…").
      setUploadPct(null);

      const payload = {
        perfil: form.perfil,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        ordem: form.ordem,
        ativo: form.ativo,
        video_path: videoPath,
        thumbnail_path: thumbPath,
      };

      if (form.id) {
        const { error } = await supabase.from('tutoriais').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Tutorial atualizado.');
      } else {
        const { error } = await supabase.from('tutoriais').insert(payload);
        if (error) throw error;
        toast.success('Tutorial criado.');
      }
      setForm(null);
      invalidar();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        toast.info('Upload cancelado.');
      } else {
        toast.error(`Erro ao salvar: ${(e as Error).message}`);
      }
    } finally {
      setSaving(false);
      setUploadPct(null);
      xhrRef.current = null;
    }
  }

  // Durante o upload, aborta o XHR em andamento; fora dele, apenas fecha o form.
  function cancelar() {
    if (saving) {
      xhrRef.current?.abort();
      return;
    }
    setForm(null);
  }

  async function confirmarExclusao() {
    if (!excluirAlvo) return;
    try {
      const paths = [excluirAlvo.video_path, excluirAlvo.thumbnail_path]
        .filter((p): p is string => Boolean(p));
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from('tutoriais').delete().eq('id', excluirAlvo.id);
      if (error) throw error;
      toast.success('Tutorial excluído.');
      setExcluirAlvo(null);
      invalidar();
    } catch (e) {
      toast.error(`Erro ao excluir: ${(e as Error).message}`);
    }
  }

  async function alternarAtivo(t: TutorialRow) {
    setTogglingId(t.id);
    try {
      const { error } = await supabase
        .from('tutoriais')
        .update({ ativo: !t.ativo })
        .eq('id', t.id);
      if (error) throw error;
      invalidar();
    } catch (e) {
      toast.error(`Erro ao atualizar: ${(e as Error).message}`);
    } finally {
      setTogglingId(null);
    }
  }

  function editar(t: TutorialRow) {
    setForm({
      id: t.id,
      perfil: (PERFIS as readonly string[]).includes(t.perfil) ? (t.perfil as Perfil) : 'consultorio',
      titulo: t.titulo,
      descricao: t.descricao ?? '',
      ordem: t.ordem,
      ativo: t.ativo,
      video_path: t.video_path,
      thumbnail_path: t.thumbnail_path,
      videoFile: null,
      thumbFile: null,
    });
  }

  const rows = data?.rows ?? [];
  const thumbUrls = data?.thumbUrls ?? {};

  return (
    <div className="container max-w-5xl py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Tutoriais</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie os vídeos de capacitação exibidos para cada perfil de usuário.
          </p>
        </div>
        <Button
          className="text-white hover:opacity-90"
          style={{ backgroundColor: '#7C4DBA' }}
          onClick={() => setForm(novoForm('consultorio'))}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo tutorial
        </Button>
      </header>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-foreground">Não foi possível carregar os tutoriais.</p>
          <Button variant="outline" onClick={() => invalidar()}>Tentar novamente</Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-8">
          {PERFIS.map((perfil) => {
            const doPerfil = rows.filter((r) => r.perfil === perfil);
            return (
              <section key={perfil}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    {PERFIL_LABEL[perfil]}
                  </h2>
                  <Badge variant="secondary">{doPerfil.length}</Badge>
                </div>

                {doPerfil.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum tutorial para este perfil.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {doPerfil.map((t) => {
                      const thumb = t.thumbnail_path ? thumbUrls[t.thumbnail_path] : null;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                        >
                          <div className="w-32 shrink-0 overflow-hidden rounded-md">
                            <AspectRatio ratio={16 / 9}>
                              {thumb ? (
                                <img src={thumb} alt={t.titulo} className="h-full w-full object-cover" />
                              ) : (
                                <div
                                  className="flex h-full w-full items-center justify-center"
                                  style={{ backgroundColor: '#F1F5F9' }}
                                >
                                  <Film className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                            </AspectRatio>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">{t.titulo}</p>
                              <Badge variant="outline" className="shrink-0">#{t.ordem}</Badge>
                              {!t.video_path && (
                                <Badge variant="secondary" className="shrink-0">sem vídeo</Badge>
                              )}
                            </div>
                            {t.descricao && (
                              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                                {t.descricao}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <Switch
                                checked={t.ativo}
                                disabled={togglingId === t.id}
                                onCheckedChange={() => alternarAtivo(t)}
                                aria-label="Ativo"
                              />
                              <span className="text-xs text-muted-foreground">
                                {t.ativo ? 'Ativo (visível)' : 'Inativo (oculto)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => editar(t)} aria-label="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setExcluirAlvo(t)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Formulário criar/editar */}
      <Dialog open={!!form} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {form?.id ? 'Editar tutorial' : 'Novo tutorial'}
            </DialogTitle>
            <DialogDescription>
              O vídeo aparece na aba Tutorial do perfil selecionado.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select
                  value={form.perfil}
                  onValueChange={(v) => setForm({ ...form, perfil: v as Perfil })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFIS.map((p) => (
                      <SelectItem key={p} value={p}>{PERFIL_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex.: Como cadastrar uma paciente"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={2}
                  placeholder="Um resumo curto do que o vídeo ensina."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={form.ordem}
                    onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                    id="ativo-switch"
                  />
                  <Label htmlFor="ativo-switch" className="cursor-pointer">Ativo</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Vídeo {form.id ? '(deixe vazio para manter o atual)' : ''}</Label>
                <Input
                  type="file"
                  accept="video/*"
                  className={FILE_INPUT_CLASS}
                  onChange={(e) => setForm({ ...form, videoFile: e.target.files?.[0] ?? null })}
                />
                {form.id && form.video_path && !form.videoFile && (
                  <p className="text-xs text-muted-foreground">Vídeo atual mantido.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Thumbnail (opcional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  className={FILE_INPUT_CLASS}
                  onChange={(e) => setForm({ ...form, thumbFile: e.target.files?.[0] ?? null })}
                />
                <p className="text-xs text-muted-foreground">
                  Sem thumbnail, o card mostra um ícone padrão.
                </p>
              </div>
            </div>
          )}

          {saving && uploadPct !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{faseUpload}…</span>
                <span>{Math.round(uploadPct * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(uploadPct * 100)}%`, backgroundColor: '#7C4DBA' }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelar}>
              {saving ? 'Cancelar upload' : 'Cancelar'}
            </Button>
            <Button
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#7C4DBA' }}
              onClick={salvar}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving
                ? uploadPct !== null
                  ? `Enviando… ${Math.round(uploadPct * 100)}%`
                  : 'Salvando…'
                : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluirAlvo} onOpenChange={(open) => !open && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tutorial?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluirAlvo?.titulo
                ? `"${excluirAlvo.titulo}" será removido, junto do vídeo e da thumbnail. Esta ação não pode ser desfeita.`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
