import { useCallback, useEffect, useState } from 'react';
import { PlayCircle, Film, AlertCircle } from 'lucide-react';
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

function publicUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const TITULO_POR_PERFIL: Record<UserProfile, string> = {
  consultorio: 'Tutorial — Consultório',
  institucional: 'Tutorial — Institucional',
  gestor: 'Tutorial — Gestor',
  gestor_geral: 'Tutorial — Gestor Geral',
  admin: 'Tutorial — Administrador',
};

export default function TutorialPage() {
  const { profile } = useAuth();
  const [tutoriais, setTutoriais] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [selecionado, setSelecionado] = useState<Tutorial | null>(null);

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
    } else {
      setTutoriais((data ?? []) as Tutorial[]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchTutoriais();
  }, [fetchTutoriais]);

  const videoUrl = selecionado ? publicUrl(selecionado.video_path) : null;

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {profile ? TITULO_POR_PERFIL[profile] : 'Tutorial'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Vídeos de capacitação para você aproveitar a MARI ao máximo.
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
            <p className="text-foreground">Não foi possível carregar os vídeos.</p>
            <Button onClick={fetchTutoriais} variant="outline">
              Tentar novamente
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
                Vídeos em breve
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os tutoriais deste perfil ainda estão sendo preparados. Volte em breve!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && tutoriais.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutoriais.map((t) => {
            const thumb = publicUrl(t.thumbnail_path);
            const temVideo = Boolean(t.video_path);
            return (
              <Card
                key={t.id}
                className="group overflow-hidden transition-shadow hover:shadow-lg"
              >
                {/* Thumbnail estilo YouTube */}
                <button
                  type="button"
                  onClick={() => temVideo && setSelecionado(t)}
                  disabled={!temVideo}
                  className="relative block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                  aria-label={`Assistir: ${t.titulo}`}
                >
                  <AspectRatio ratio={16 / 9}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={t.titulo}
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
                    {t.titulo}
                  </h3>
                  {t.descricao && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {t.descricao}
                    </p>
                  )}
                  <Button
                    className="mt-1 w-full text-white hover:opacity-90"
                    style={{ backgroundColor: '#7C4DBA' }}
                    disabled={!temVideo}
                    onClick={() => setSelecionado(t)}
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    {temVideo ? 'Assistir' : 'Em breve'}
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
              {videoUrl ? (
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
                  Vídeo indisponível.
                </div>
              )}
            </AspectRatio>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
