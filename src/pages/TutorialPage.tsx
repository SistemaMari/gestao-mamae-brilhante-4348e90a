import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayCircle, Film, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type UserProfile } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Tutorial {
  id: string;
  titulo: string;
  descricao: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  ordem: number;
}

const BUCKET = 'tutoriais';
// Bucket privado → servimos vídeo/thumbnail por signed URL (válida por 8h).
const SIGN_EXPIRY = 60 * 60 * 8;

const TITULO_KEY_POR_PERFIL: Record<UserProfile, string> = {
  consultorio: 'tutorial.titleConsultorio',
  institucional: 'tutorial.titleInstitucional',
  gestor: 'tutorial.titleGestor',
  gestor_geral: 'tutorial.titleGestorGeral',
  admin: 'tutorial.titleAdmin',
};

export default function TutorialPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [tutoriais, setTutoriais] = useState<Tutorial[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [selecionado, setSelecionado] = useState<Tutorial | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const fetchTutoriais = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(false);

    const { data, error } = await supabase
      .from('tutoriais')
      .select('id, titulo, descricao, video_path, thumbnail_path, ordem')
      .eq('perfil', profile)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      setErro(true);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Tutorial[];
    setTutoriais(rows);

    // Assina as thumbnails em lote (bucket privado).
    const thumbPaths = rows
      .map((r) => r.thumbnail_path)
      .filter((p): p is string => Boolean(p));

    if (thumbPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(thumbPaths, SIGN_EXPIRY);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => {
        if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
      });
      setThumbUrls(map);
    } else {
      setThumbUrls({});
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchTutoriais();
  }, [fetchTutoriais]);

  // Assina a URL do vídeo sob demanda ao abrir o player.
  useEffect(() => {
    let cancelado = false;
    setVideoUrl(null);
    if (!selecionado?.video_path) return;
    setVideoLoading(true);
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(selecionado.video_path, SIGN_EXPIRY)
      .then(({ data }) => {
        if (!cancelado) setVideoUrl(data?.signedUrl ?? null);
      })
      .finally(() => {
        if (!cancelado) setVideoLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [selecionado]);

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {profile ? t(TITULO_KEY_POR_PERFIL[profile]) : t('tutorial.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('tutorial.subtitle')}
        </p>
      </header>

      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && erro && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-foreground">{t('tutorial.loadError')}</p>
            <Button onClick={fetchTutoriais} variant="outline">
              {t('common.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && tutoriais.length === 0 && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: '#E8E0FF' }}
            >
              <Film className="h-7 w-7" style={{ color: '#7C4DBA' }} />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold text-foreground">
                {t('tutorial.comingSoonTitle')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('tutorial.comingSoonDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && tutoriais.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutoriais.map((tut) => {
            const thumb = tut.thumbnail_path ? thumbUrls[tut.thumbnail_path] ?? null : null;
            const temVideo = Boolean(tut.video_path);
            return (
              <Card
                key={tut.id}
                className="group overflow-hidden transition-shadow hover:shadow-lg"
              >
                {/* Thumbnail estilo YouTube */}
                <button
                  type="button"
                  onClick={() => temVideo && setSelecionado(tut)}
                  disabled={!temVideo}
                  className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                  aria-label={t('tutorial.watchAria', { titulo: tut.titulo })}
                >
                  <AspectRatio ratio={16 / 9}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={tut.titulo}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: '#F1F5F9' }}
                      >
                        <Film className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    {temVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                        <PlayCircle
                          className="h-14 w-14 text-white opacity-90 drop-shadow-lg transition-transform group-hover:scale-110"
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                  </AspectRatio>
                </button>

                {/* Título + descrição + ação */}
                <CardContent className="flex flex-col gap-3 p-4">
                  <h3 className="font-heading text-base font-bold leading-snug text-foreground">
                    {tut.titulo}
                  </h3>
                  {tut.descricao && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {tut.descricao}
                    </p>
                  )}
                  <Button
                    className="mt-1 w-full text-white hover:opacity-90"
                    style={{ backgroundColor: '#7C4DBA' }}
                    disabled={!temVideo}
                    onClick={() => setSelecionado(tut)}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {temVideo ? t('tutorial.watch') : t('tutorial.comingSoon')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Player */}
      <Dialog open={!!selecionado} onOpenChange={(open) => !open && setSelecionado(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-heading">{selecionado?.titulo}</DialogTitle>
            {selecionado?.descricao && (
              <DialogDescription>{selecionado.descricao}</DialogDescription>
            )}
          </DialogHeader>
          <div className="px-6 pb-6 pt-4">
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-black">
              {videoLoading ? (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                </div>
              ) : videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  controlsList="nodownload"
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                  {t('tutorial.videoUnavailable')}
                </div>
              )}
            </AspectRatio>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
