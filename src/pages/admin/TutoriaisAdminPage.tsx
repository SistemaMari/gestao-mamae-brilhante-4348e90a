import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const PERFIS = ['consultorio', 'institucional', 'gestor', 'gestor_geral', 'admin'] as const;
type Perfil = (typeof PERFIS)[number];

const PERFIL_LABEL_KEY: Record<Perfil, string> = {
  consultorio: 'admin.tutoriais.perfilConsultorio',
  institucional: 'admin.tutoriais.perfilInstitucional',
  gestor: 'admin.tutoriais.perfilGestor',
  gestor_geral: 'admin.tutoriais.perfilGestorGeral',
  admin: 'admin.tutoriais.perfilAdmin',
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

/**
 * Seletor de arquivo customizado: botão roxo + nome do arquivo, alinhados na
 * vertical (flex items-center). Substitui o <input type="file"> nativo, cujo
 * ::file-selector-button não centraliza verticalmente de forma confiável.
 */
function SeletorArquivo({
  accept,
  file,
  placeholder,
  onSelect,
}: {
  accept: string;
  file: File | null;
  placeholder: string;
  onSelect: (f: File | null) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 rounded-md border border-input bg-background px-2 py-1.5">
      <Button
        type="button"
        size="sm"
        onClick={() => ref.current?.click()}
        className="shrink-0 bg-[#E8E0FF] text-[#7C4DBA] hover:bg-[#dcd0ff]"
      >
        {t('admin.tutoriais.chooseFile')}
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {file?.name ?? placeholder}
      </span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
    </div>
  );
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
  t: (key: string, opts?: Record<string, unknown>) => string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error(t('admin.tutoriais.sessionExpired'));

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
        : reject(new Error(t('admin.tutoriais.uploadFailed', { status: xhr.status })));
    xhr.onerror = () => reject(new Error(t('admin.tutoriais.uploadNetworkError')));
    xhr.onabort = () => reject(new DOMException('cancelado', 'AbortError'));
    xhr.send(formData);
  });
}

export default function TutoriaisAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [faseUpload, setFaseUpload] = useState(() => t('admin.tutoriais.phaseSending'));
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
      toast.error(t('admin.tutoriais.titleRequired'));
      return;
    }
    if (!form.id && !form.videoFile) {
      toast.error(t('admin.tutoriais.videoRequired'));
      return;
    }
    setSaving(true);
    try {
      let videoPath = form.video_path;
      let thumbPath = form.thumbnail_path;

      if (form.videoFile) {
        const novo = `${form.perfil}/${crypto.randomUUID()}.${extDe(form.videoFile.name)}`;
        setFaseUpload(t('admin.tutoriais.phaseSendingVideo'));
        setUploadPct(0);
        await uploadArquivo(novo, form.videoFile, setUploadPct, xhrRef, t);
        if (form.video_path) await supabase.storage.from(BUCKET).remove([form.video_path]);
        videoPath = novo;
      }

      if (form.thumbFile) {
        const novo = `${form.perfil}/thumb-${crypto.randomUUID()}.${extDe(form.thumbFile.name)}`;
        setFaseUpload(t('admin.tutoriais.phaseSendingThumb'));
        setUploadPct(0);
        await uploadArquivo(novo, form.thumbFile, setUploadPct, xhrRef, t);
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
        toast.success(t('admin.tutoriais.updated'));
      } else {
        const { error } = await supabase.from('tutoriais').insert(payload);
        if (error) throw error;
        toast.success(t('admin.tutoriais.created'));
      }
      setForm(null);
      invalidar();
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        toast.info(t('admin.tutoriais.uploadCancelled'));
      } else {
        toast.error(t('admin.tutoriais.saveError', { message: (e as Error).message }));
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
      toast.success(t('admin.tutoriais.deleted'));
      setExcluirAlvo(null);
      invalidar();
    } catch (e) {
      toast.error(t('admin.tutoriais.deleteError', { message: (e as Error).message }));
    }
  }

  async function alternarAtivo(tut: TutorialRow) {
    setTogglingId(tut.id);
    try {
      const { error } = await supabase
        .from('tutoriais')
        .update({ ativo: !tut.ativo })
        .eq('id', tut.id);
      if (error) throw error;
      invalidar();
    } catch (e) {
      toast.error(t('admin.tutoriais.toggleError', { message: (e as Error).message }));
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
          <h1 className="font-heading text-3xl font-bold text-foreground">{t('admin.tutoriais.title')}</h1>
          <p className="mt-1 text-muted-foreground">
            {t('admin.tutoriais.subtitle')}
          </p>
        </div>
        <Button
          className="text-white hover:opacity-90"
          style={{ backgroundColor: '#7C4DBA' }}
          onClick={() => setForm(novoForm('consultorio'))}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.tutoriais.newTutorial')}
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
          <p className="text-foreground">{t('admin.tutoriais.loadError')}</p>
          <Button variant="outline" onClick={() => invalidar()}>{t('common.tryAgain')}</Button>
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
                    {t(PERFIL_LABEL_KEY[perfil])}
                  </h2>
                  <Badge variant="secondary">{doPerfil.length}</Badge>
                </div>

                {doPerfil.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    {t('admin.tutoriais.emptyPerfil')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {doPerfil.map((tut) => {
                      const thumb = tut.thumbnail_path ? thumbUrls[tut.thumbnail_path] : null;
                      return (
                        <div
                          key={tut.id}
                          className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                        >
                          <div className="w-32 shrink-0 overflow-hidden rounded-md">
                            <AspectRatio ratio={16 / 9}>
                              {thumb ? (
                                <img src={thumb} alt={tut.titulo} className="h-full w-full object-cover" />
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
                              <p className="truncate font-medium text-foreground">{tut.titulo}</p>
                              <Badge variant="outline" className="shrink-0">#{tut.ordem}</Badge>
                              {!tut.video_path && (
                                <Badge variant="secondary" className="shrink-0">{t('admin.tutoriais.noVideo')}</Badge>
                              )}
                            </div>
                            {tut.descricao && (
                              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                                {tut.descricao}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <Switch
                                checked={tut.ativo}
                                disabled={togglingId === tut.id}
                                onCheckedChange={() => alternarAtivo(tut)}
                                aria-label={t('admin.tutoriais.activeAria')}
                              />
                              <span className="text-xs text-muted-foreground">
                                {tut.ativo ? t('admin.tutoriais.activeVisible') : t('admin.tutoriais.inactiveHidden')}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => editar(tut)} aria-label={t('common.edit')}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setExcluirAlvo(tut)}
                              aria-label={t('common.delete')}
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
              {form?.id ? t('admin.tutoriais.editTutorial') : t('admin.tutoriais.newTutorial')}
            </DialogTitle>
            <DialogDescription>
              {t('admin.tutoriais.dialogDesc')}
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('admin.tutoriais.perfilLabel')}</Label>
                <Select
                  value={form.perfil}
                  onValueChange={(v) => setForm({ ...form, perfil: v as Perfil })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFIS.map((p) => (
                      <SelectItem key={p} value={p}>{t(PERFIL_LABEL_KEY[p])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.tutoriais.titleLabel')}</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder={t('admin.tutoriais.titlePlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.tutoriais.descLabel')}</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={2}
                  placeholder={t('admin.tutoriais.descPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('admin.tutoriais.orderLabel')}</Label>
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
                  <Label htmlFor="ativo-switch" className="cursor-pointer">{t('admin.tutoriais.activeLabel')}</Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.tutoriais.videoLabel')} {form.id ? t('admin.tutoriais.keepCurrentHint') : ''}</Label>
                <SeletorArquivo
                  accept="video/*"
                  file={form.videoFile}
                  placeholder={
                    form.id && form.video_path ? t('admin.tutoriais.videoKept') : t('admin.tutoriais.noFileChosen')
                  }
                  onSelect={(f) => setForm({ ...form, videoFile: f })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.tutoriais.thumbLabel')}</Label>
                <SeletorArquivo
                  accept="image/*"
                  file={form.thumbFile}
                  placeholder={
                    form.id && form.thumbnail_path ? t('admin.tutoriais.thumbKept') : t('admin.tutoriais.noFileChosen')
                  }
                  onSelect={(f) => setForm({ ...form, thumbFile: f })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin.tutoriais.thumbHint')}
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
              {saving ? t('admin.tutoriais.cancelUpload') : t('common.cancel')}
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
                  ? t('admin.tutoriais.sendingPct', { pct: Math.round(uploadPct * 100) })
                  : t('common.saving')
                : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluirAlvo} onOpenChange={(open) => !open && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.tutoriais.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {excluirAlvo?.titulo
                ? t('admin.tutoriais.deleteConfirmNamed', { titulo: excluirAlvo.titulo })
                : t('admin.tutoriais.irreversible')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
