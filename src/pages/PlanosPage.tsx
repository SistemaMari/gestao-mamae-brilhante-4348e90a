import { useEffect, useState, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Crown, ArrowLeft, AlertCircle, BadgePercent, Building2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePromocaoLancamento } from '@/hooks/usePromocaoLancamento';
import {
  DESCONTO_LANCAMENTO_PCT, precoLancamento, anuidade, precoPorGestante, formatarBRL,
} from '@/lib/precoLancamento';

// Plano Personalizado (acima do maior limite): atendimento pelo time comercial.
const LINK_FALE_CONOSCO = 'https://unni.chat/mari-faleconosco-pv';

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
  link_pagamento_asaas: string | null;
  metricas_habilitado: boolean;
}

export default function PlanosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { ativa: promoAtiva } = usePromocaoLancamento();
  const idioma = i18n.language;

  const labelSuporte = (suporte: string): string => {
    if (suporte === 'email') return t('planos.supportEmail');
    if (suporte === 'prioritario') return t('planos.supportPriority');
    return suporte;
  };
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
      // Planos institucionais (Até 1000/5000 gestantes) só são vendidos pelo
      // link direto do Asaas, nunca aqui dentro do app.
      .eq('exibir_no_app', true)
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

  // Toda compra (nova, upgrade ou downgrade) é ANUAL e acontece no link do Asaas
  // — o mesmo da página de vendas. O webhook reconhece o plano pelo link.
  const handleAssinar = (plano: Plano) => {
    if (plano.link_pagamento_asaas) window.location.href = plano.link_pagamento_asaas;
  };

  const renderHeader = () => (
    <div className="mb-10 text-center">
      {user && (
        <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
      )}
      <h1 className="font-heading text-3xl font-bold text-foreground">
        {t('planos.chooseYourPlan')}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t('planos.chooseSubtitle')}
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
              {t('planos.loadError')}
            </p>
            <Button onClick={fetchPlanos}>{t('common.tryAgain')}</Button>
          </div>
        )}

        {!loading && !error && planos && planos.length === 0 && (
          <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {t('planos.noPlans')}
            </p>
          </div>
        )}

        {!loading && !error && planos && planos.length > 0 && promoAtiva && (
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#C6F432] px-5 py-2.5 text-sm text-[#1A2E05]">
              <BadgePercent className="h-5 w-5 shrink-0" />
              <span>
                <Trans
                  i18nKey="planos.promoBanner"
                  values={{ pct: DESCONTO_LANCAMENTO_PCT }}
                  components={{ strong: <strong className="text-base font-bold" /> }}
                />
              </span>
            </div>
          </div>
        )}

        {!loading && !error && planos && planos.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {planos.map((plano, idx) => {
              const isAtual = !!planoAtualId && plano.id === planoAtualId;
              // Destaque marketing: card do meio (índice 1) — independente do plano atual.
              const destaqueMarketing = idx === 1;

              let botaoTexto = t('planos.subscribeTo', { plano: plano.nome });
              let botaoVariant: 'default' | 'outline' | 'secondary' = 'default';
              let botaoDisabled = false;

              if (isAtual) {
                botaoTexto = t('planos.currentPlan');
                botaoVariant = 'outline';
                botaoDisabled = true;
              } else if (precoAtual !== null) {
                if (plano.preco_mensal > precoAtual) {
                  botaoTexto = t('planos.upgrade');
                  botaoVariant = 'default';
                } else if (plano.preco_mensal < precoAtual) {
                  botaoTexto = t('planos.downgrade');
                  botaoVariant = 'secondary';
                }
              }

              const precoEfetivo = promoAtiva ? precoLancamento(plano.preco_mensal) : plano.preco_mensal;
              const porGestante = precoPorGestante(precoEfetivo, plano.pacientes_max);

              const limitePacientes =
                plano.pacientes_max === null
                  ? t('planos.unlimitedPatients')
                  : t('planos.upToPatients', { count: plano.pacientes_max });

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
                        {t('planos.yourCurrentPlan')}
                      </Badge>
                    </div>
                  ) : destaqueMarketing ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                        <Crown className="mr-1 h-3 w-3" />
                        {t('planos.mostPopular')}
                      </Badge>
                    </div>
                  ) : null}

                  <div className="mb-4">
                    <h3 className="font-heading text-xl font-semibold text-foreground">
                      {plano.nome}
                    </h3>
                    {/* Plano anual: R$ X por ano, pago no link do Asaas (Pix à vista ou cartão). */}
                    <div className="mt-3">
                      {promoAtiva && (
                        <p className="text-sm text-muted-foreground line-through decoration-red-500 decoration-2">
                          {formatarBRL(anuidade(plano.preco_mensal), idioma)}
                        </p>
                      )}
                      <p className="mt-0.5">
                        <span className="font-heading text-3xl font-bold text-foreground">
                          {formatarBRL(anuidade(precoEfetivo), idioma)}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">{t('planos.perYear')}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('planos.annualNote')}</p>
                    </div>
                    {porGestante !== null && (
                      <span className="mt-3 inline-block rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-medium text-[#065F46]">
                        {t('planos.perPatient', { valor: formatarBRL(porGestante, idioma, true) })}
                      </span>
                    )}
                  </div>

                  <ul className="mb-6 flex-1 space-y-2.5">
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {t('planos.unlimitedReports')}
                    </li>
                    {plano.metricas_habilitado && (
                      <li className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                        {t('planos.dashboard')}
                      </li>
                    )}
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {limitePacientes}
                    </li>
                    <li className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {labelSuporte(plano.suporte)}
                    </li>
                    {/* Cursos removidos da descrição dos planos (a pedido).
                        `cursos_inclusos` segue no banco e continua liberando o
                        acesso em "Meus cursos" — apenas não é mais listado aqui. */}
                  </ul>

                  <Button
                    className="w-full"
                    variant={botaoVariant}
                    disabled={botaoDisabled || !plano.link_pagamento_asaas}
                    onClick={() => handleAssinar(plano)}
                  >
                    {botaoTexto}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && planos && planos.length > 0 && (() => {
          const maiorLimite = Math.max(0, ...planos.map((p) => p.pacientes_max ?? 0));
          if (maiorLimite <= 0) return null;
          return (
            <div className="mt-8 flex flex-col gap-5 rounded-xl border border-[#E4DDFB] bg-[#F5F3FF] p-6 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                <Building2 className="h-6 w-6 text-[#7C4DBA]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('planos.personalizadoTitulo')}
                </p>
                <h3 className="mt-0.5 font-heading text-lg font-bold text-foreground">
                  {t('planos.personalizadoSubtitulo', { count: maiorLimite })}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('planos.personalizadoTexto')}</p>
              </div>
              <Button asChild className="shrink-0 bg-[#15803D] font-semibold uppercase tracking-wide text-white hover:bg-[#166534]">
                <a href={LINK_FALE_CONOSCO} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  {t('planos.personalizadoBotao')}
                </a>
              </Button>
            </div>
          );
        })()}

        {user && (
          <p className="mt-8 text-center text-sm font-medium text-foreground">
            {t('planos.sameEmailNote')}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('planos.launchPricingNote')}
        </p>
      </div>
    </div>
  );
}
