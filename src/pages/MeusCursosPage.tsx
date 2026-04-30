import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { nomeAmigavelCurso } from '@/lib/nomesCursos';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const CURSOS_SLUGS = ['hiperglicemia', 'insulinoterapia', 'novos-paradigmas-dmg'] as const;

const PLANO_NECESSARIO: Record<string, string> = {
  insulinoterapia: 'Intermediária',
  'novos-paradigmas-dmg': 'Profissional',
  hiperglicemia: 'Inicial',
};

interface PlanoInfo {
  slug: string;
  nome: string;
  cursos_inclusos: string[];
}

export default function MeusCursosPage() {
  const navigate = useNavigate();
  const { profissionalData, loading: loadingProf } = useProfissionalData();
  const [plano, setPlano] = useState<PlanoInfo | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(true);
  const [erro, setErro] = useState(false);

  const fetchPlano = useCallback(async () => {
    if (!profissionalData?.plano_id) {
      setLoadingPlano(false);
      return;
    }
    setLoadingPlano(true);
    setErro(false);
    const { data, error } = await supabase
      .from('planos')
      .select('slug, nome, cursos_inclusos')
      .eq('id', profissionalData.plano_id)
      .maybeSingle();
    if (error || !data) {
      setErro(true);
    } else {
      setPlano(data as PlanoInfo);
    }
    setLoadingPlano(false);
  }, [profissionalData?.plano_id]);

  useEffect(() => {
    if (!loadingProf) fetchPlano();
  }, [loadingProf, fetchPlano]);

  const loading = loadingProf || loadingPlano;

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Meus Cursos</h1>
        <p className="mt-2 text-muted-foreground">
          Conteúdos exclusivos incluídos no seu plano para aprofundar sua prática em DMG.
        </p>
      </header>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && erro && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-foreground">Não foi possível carregar seus cursos.</p>
            <Button onClick={fetchPlano} variant="outline">Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && !profissionalData?.plano_id && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground" />
            <p className="text-foreground">Você ainda não tem plano ativo.</p>
            <Button onClick={() => navigate('/planos')} style={{ backgroundColor: '#9b87f5' }}>
              Ver planos
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !erro && plano && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CURSOS_SLUGS.map((slug) => {
            const liberado = plano.cursos_inclusos?.includes(slug);
            return (
              <Card
                key={slug}
                className={liberado ? '' : 'opacity-60'}
              >
                <CardContent className="flex flex-col gap-4 p-6">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: liberado ? '#E8E0FF' : '#F1F5F9' }}
                  >
                    <GraduationCap
                      className="h-6 w-6"
                      style={{ color: liberado ? '#9b87f5' : '#64748B' }}
                    />
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground">
                    {nomeAmigavelCurso(slug)}
                  </h3>

                  {liberado ? (
                    <span
                      className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
                    >
                      ✓ Liberado pelo seu plano
                    </span>
                  ) : (
                    <span
                      className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
                      style={{ backgroundColor: '#F1F5F9' }}
                    >
                      <Lock className="h-3 w-3" />
                      Disponível no plano {PLANO_NECESSARIO[slug]}
                    </span>
                  )}

                  <div className="mt-2">
                    {liberado ? (
                      <Button
                        className="w-full text-white hover:opacity-90"
                        style={{ backgroundColor: '#9b87f5' }}
                        onClick={() =>
                          toast.info('Link em breve. Configurando acesso aos cursos.')
                        }
                      >
                        Acessar curso →
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate('/planos')}
                      >
                        Fazer upgrade
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
