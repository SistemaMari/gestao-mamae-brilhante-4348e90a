import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Crown, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { nomeAmigavelCurso } from '@/lib/nomesCursos';

interface Plano {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  laudos_por_mes: number;
  pacientes_max: number | null;
  suporte: string;
  cursos_inclusos: string[];
  ordem: number;
  ativo: boolean;
}

function formatPreco(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}/mês`;
}

function labelSuporte(suporte: string): string {
  if (suporte === 'email') return 'Suporte por e-mail';
  if (suporte === 'prioritario') return 'Suporte prioritário';
  return suporte;
}

export default function PlanosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profissionalData } = useProfissionalData();

  const [planos, setPlanos] = useState<Plano[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPlanos = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (err) {
      setError(true);
      setLoading(false);
      return;
    }
    setPlanos((data ?? []) as Plano[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlanos();
  }, [fetchPlanos]);

  const planoAtualId = profissionalData?.plano_id ?? null;
  const precoAtual = planoAtualId
    ? planos?.find((p) => p.id === planoAtualId)?.preco_mensal ?? null
    : null;

  const handleAssinar = () => {
    toast.info('Em breve — integração de pagamento.');
  };

  const renderHeader = () => (
    <div className="mb-10 text-center">
      {user && (
        <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      )}
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Escolha seu plano
      </h1>
      <p className="mt-2 text-muted-foreground">
        Comece com o plano ideal para sua prática e evolua quando precisar
      </p>
    </div>
  );

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {renderHeader()}

        {loading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[460px] rounded-xl" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            <p className="mb-4 text-sm text-foreground">
              Não foi possível carregar os planos. Tente recarregar a página.
            </p>
            <Button onClick={fetchPlanos}>Tentar novamente</Button>
          </div>
        )}

        {!loading && !error && planos && planos.length === 0 && (
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Nenhum plano disponível no momento.
            </p>
          </div>
        )}

        {!loading && !error && planos && planos.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {planos.map((plano, idx) => {
              const isAtual = !!planoAtualId && plano.id === planoAtualId;
              // Destaque marketing: card do meio (índice 1) — independente do plano atual.
              const destaqueMarketing = idx === 1;

              let botaoTexto = `Assinar ${plano.nome}`;
              let botaoVariant: 'default' | 'outline' | 'secondary' = 'default';
              let botaoDisabled = false;

              if (isAtual) {
                botaoTexto = 'Plano atual';
                botaoVariant = 'outline';
                botaoDisabled = true;
              } else if (precoAtual !== null) {
                if (plano.preco_mensal > precoAtual) {
                  botaoTexto = 'Fazer upgrade';
                  botaoVariant = 'default';
                } else if (plano.preco_mensal < precoAtual) {
                  botaoTexto = 'Fazer downgrade';
                  botaoVariant = 'secondary';
                }
              }

              const limitePacientes =
                plano.pacientes_max === null
                  ? 'Pacientes ilimitados'
                  : `Até ${plano.pacientes_max} pacientes`;

              return (
                <div
                  key={plano.id}
                  className={`relative flex flex-col rounded-xl bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                    isAtual
                      ? 'border-2 border-primary'
                      : destaqueMarketing
                        ? 'border-2 border-primary/60'
                        : 'border border-border'
                  }`}
                >
                  {isAtual ? (
                    <div className="absolute -top-3 right-4">
                      <Badge
                        className="px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: '#E8E0FF',
                          color: '#7E69AB',
                        }}
                      >
                        Seu plano atual
                      </Badge>
                    </div>
                  ) : destaqueMarketing ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                        <Crown className="mr-1 h-3 w-3" />
                        Mais popular
                      </Badge>
                    </div>
                  ) : null}

                  <div className="mb-4">
                    <h3 className="font-heading text-xl font-semibold text-foreground">
                      {plano.nome}
                    </h3>
                    <div className="mt-3">
                      <span className="font-heading text-3xl font-bold text-foreground">
                        {formatPreco(plano.preco_mensal)}
                      </span>
                    </div>
                  </div>

                  <ul className="mb-6 flex-1 space-y-2.5">
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      Até {plano.laudos_por_mes} laudos por mês
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {limitePacientes}
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {labelSuporte(plano.suporte)}
                    </li>
                    {plano.cursos_inclusos.map((slug) => (
                      <li
                        key={slug}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        {nomeAmigavelCurso(slug)}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={botaoVariant}
                    disabled={botaoDisabled}
                    onClick={handleAssinar}
                  >
                    {botaoTexto}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Preços de lançamento. Valores podem ser ajustados após o período promocional.
        </p>
      </div>
    </div>
  );
}
