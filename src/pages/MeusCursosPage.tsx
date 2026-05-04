import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Curso {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  link_eduzz: string | null;
  plano_minimo: string;
  ordem: number;
}

interface PlanoInfo {
  slug: string;
  nome: string;
  cursos_inclusos: string[];
}

const NOME_PLANO_POR_SLUG: Record<string, string> = {
  inicial: 'Inicial',
  intermediaria: 'Intermediária',
  profissional: 'Profissional',
};

export default function MeusCursosPage() {
  const navigate = useNavigate();
  const { profissionalData, loading: loadingProf } = useProfissionalData();
  const [plano, setPlano] = useState<PlanoInfo | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const fetchDados = useCallback(async () => {
    if (!profissionalData?.plano_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(false);

    const [resPlano, resCursos] = await Promise.all([
      supabase
        .from('planos')
        .select('slug, nome, cursos_inclusos')
        .eq('id', profissionalData.plano_id)
        .maybeSingle(),
      supabase
        .from('cursos')
        .select('id, slug, nome, descricao, link_eduzz, plano_minimo, ordem')
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
    ]);

    if (resPlano.error || !resPlano.data || resCursos.error) {
      setErro(true);
    } else {
      setPlano(resPlano.data as PlanoInfo);
      setCursos((resCursos.data ?? []) as Curso[]);
    }
    setLoading(false);
  }, [profissionalData?.plano_id]);

  useEffect(() => {
    if (!loadingProf) fetchDados();
  }, [loadingProf, fetchDados]);

  const carregando = loadingProf || loading;

  const acessarCurso = (curso: Curso) => {
    if (curso.link_eduzz) {
      window.open(curso.link_eduzz, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('Link em breve. Configurando acesso ao curso.');
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Meus Cursos</h1>
        <p className="mt-2 text-muted-foreground">
          Conteúdos exclusivos incluídos no seu plano para aprofundar sua prática em DMG.
        </p>
      </header>

      {carregando && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!carregando && erro && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-foreground">Não foi possível carregar seus cursos.</p>
            <Button onClick={fetchDados} variant="outline">Tentar novamente</Button>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && !profissionalData?.plano_id && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground" />
            <p className="text-foreground">Você ainda não tem plano ativo.</p>
            <Button onClick={() => navigate('/planos')} style={{ backgroundColor: '#7C4DBA' }}>
              Ver planos
            </Button>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && plano && cursos.length === 0 && (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground" />
            <p className="text-foreground">Nenhum curso disponível no momento.</p>
          </CardContent>
        </Card>
      )}

      {!carregando && !erro && plano && cursos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map((curso) => {
            const liberado = plano.cursos_inclusos?.includes(curso.slug);
            const nomePlanoNecessario =
              NOME_PLANO_POR_SLUG[curso.plano_minimo] ?? curso.plano_minimo;

            return (
              <Card key={curso.id} className={liberado ? '' : 'opacity-60'}>
                <CardContent className="flex flex-col gap-4 p-6">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: liberado ? '#E8E0FF' : '#F1F5F9' }}
                  >
                    <GraduationCap
                      className="h-6 w-6"
                      style={{ color: liberado ? '#7C4DBA' : '#64748B' }}
                    />
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground">
                    {curso.nome}
                  </h3>

                  {curso.descricao && (
                    <p className="text-sm text-muted-foreground">{curso.descricao}</p>
                  )}

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
                      Disponível no plano {nomePlanoNecessario}
                    </span>
                  )}

                  <div className="mt-2">
                    {liberado ? (
                      <Button
                        className="w-full text-white hover:opacity-90"
                        style={{ backgroundColor: '#7C4DBA' }}
                        onClick={() => acessarCurso(curso)}
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
