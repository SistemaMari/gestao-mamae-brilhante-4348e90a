/**
 * Landing institucional — link direto que o Raul envia para instituições
 * (redes, hospitais, secretarias). NÃO fica em nenhum menu do app: só quem
 * recebe o link (/institucional) chega aqui. O botão de cada plano leva
 * direto para o link de pagamento real no Asaas (fora do app).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Building2, AlertCircle, ShieldCheck, Sparkles, Users } from 'lucide-react';

interface PlanoInstitucional {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number;
  pacientes_max: number | null;
  link_pagamento_asaas: string | null;
}

const SLUGS_INSTITUCIONAIS = ['institucional-1000', 'institucional-5000'];

function formatPreco(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InstitucionalPage() {
  const [planos, setPlanos] = useState<PlanoInstitucional[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPlanos = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('planos')
      .select('id, slug, nome, preco_mensal, pacientes_max, link_pagamento_asaas')
      .in('slug', SLUGS_INSTITUCIONAIS)
      .order('preco_mensal', { ascending: true });

    if (err) {
      setError(true);
      setLoading(false);
      return;
    }
    setPlanos((data ?? []) as PlanoInstitucional[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlanos();
  }, [fetchPlanos]);

  const irParaPagamento = (plano: PlanoInstitucional) => {
    if (plano.link_pagamento_asaas) {
      window.location.href = plano.link_pagamento_asaas;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(252,100%,97%)] to-[hsl(168,60%,95%)] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">M</span>
          </div>
          <span className="font-heading font-bold text-sm tracking-widest uppercase text-foreground">MARI</span>
        </div>
        <span className="text-muted-foreground text-sm ml-auto flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          Parceria institucional
        </span>
      </header>

      {/* Hero */}
      <div className="px-4 pt-14 pb-8 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Para redes, hospitais e secretarias de saúde
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Inteligência clínica para diabetes gestacional,
            <br className="hidden sm:block" /> em escala para toda a sua rede
          </h1>
          <p className="mt-4 text-muted-foreground text-base">
            Diagnóstico, condução clínica e acompanhamento de gestantes com DMG — padronizado
            para todos os profissionais da sua instituição, com laudos ilimitados e suporte dedicado.
          </p>
        </div>
      </div>

      {/* Planos */}
      <div className="flex-1 px-4 pb-16">
        <div className="mx-auto max-w-4xl">
          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[420px] rounded-xl" />
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

          {!loading && !error && planos && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {planos.map((plano, idx) => {
                const destaque = idx === planos.length - 1; // maior plano em destaque
                return (
                  <div
                    key={plano.id}
                    className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm transition-shadow hover:shadow-lg ${
                      destaque ? 'border-2 border-primary' : 'border border-border'
                    }`}
                  >
                    {destaque && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          <Users className="h-3 w-3" />
                          Maior alcance
                        </span>
                      </div>
                    )}

                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                      <Building2 className="h-4 w-4" />
                      {plano.nome}
                    </div>

                    <div className="mt-2">
                      <span className="font-heading text-4xl font-bold text-foreground">
                        {formatPreco(plano.preco_mensal)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cobrado mensalmente · plano anual, 12 cobranças
                    </p>

                    <ul className="my-6 flex-1 space-y-3">
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        Laudos ilimitados
                      </li>
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        {plano.pacientes_max
                          ? `Até ${plano.pacientes_max.toLocaleString('pt-BR')} gestantes`
                          : 'Gestantes ilimitadas'}
                      </li>
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        Suporte dedicado
                      </li>
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        Onboarding assistido para toda a equipe
                      </li>
                    </ul>

                    <Button
                      className="w-full"
                      size="lg"
                      variant={destaque ? 'default' : 'outline'}
                      onClick={() => irParaPagamento(plano)}
                      disabled={!plano.link_pagamento_asaas}
                    >
                      Assinar agora
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-auto mt-10 flex max-w-2xl items-start gap-2 rounded-xl border border-border bg-white/60 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Você será direcionado para o ambiente seguro de pagamento da Asaas para concluir a
              assinatura. Após a confirmação do pagamento, o acesso da sua instituição ao MARI é
              liberado automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
