import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2, Clock, Copy, ExternalLink, FileText, Loader2, QrCode, Receipt, Wallet,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import CardSuporte from '@/components/CardSuporte';
import type { PagamentoConta, SituacaoPagamento } from '../../supabase/functions/_shared/pagamentosConta';

const COR_SITUACAO: Record<SituacaoPagamento, string> = {
  pago: 'bg-green-100 text-green-700 hover:bg-green-100',
  a_vencer: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  vencido: 'bg-red-100 text-red-700 hover:bg-red-100',
  estornado: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  em_analise: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
};

interface Pix { copia_e_cola: string | null; qr_code_base64: string | null; expira_em: string | null }

/**
 * Pagamentos (consultório): parcelas pagas e em aberto da própria conta no
 * Asaas; para as em aberto, boleto, Pix copia e cola e a fatura do Asaas.
 */
export default function PagamentosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [pixAberto, setPixAberto] = useState<PagamentoConta | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [carregandoPix, setCarregandoPix] = useState(false);

  const q = useQuery({
    queryKey: ['meus-pagamentos', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('meus-pagamentos', { body: { acao: 'listar' } });
      if (error || (data as { error?: string })?.error) throw new Error('falha');
      return (data?.pagamentos ?? []) as PagamentoConta[];
    },
  });

  const fmtData = (d: string | null) =>
    d ? new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fmtValor = (v: number) => v.toLocaleString(i18n.language, { style: 'currency', currency: 'BRL' });

  const pagamentos = q.data ?? [];
  const pagos = pagamentos.filter((p) => p.situacao === 'pago');
  const abertos = pagamentos.filter((p) => p.situacao === 'a_vencer' || p.situacao === 'vencido');
  const totalPago = pagos.reduce((s, p) => s + p.valor, 0);
  const totalParcelas = pagamentos.filter((p) => p.situacao !== 'estornado').length;

  const abrirPix = async (p: PagamentoConta) => {
    setPixAberto(p);
    setPix(null);
    setCarregandoPix(true);
    const { data, error } = await supabase.functions.invoke('meus-pagamentos', { body: { acao: 'pix', pagamento_id: p.id } });
    setCarregandoPix(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(t('pagamentos.erroPix'));
      setPixAberto(null);
      return;
    }
    setPix(data as Pix);
  };

  const copiarPix = async () => {
    if (!pix?.copia_e_cola) return;
    try {
      await navigator.clipboard.writeText(pix.copia_e_cola);
      toast.success(t('pagamentos.pixCopiado'));
    } catch {
      toast.error(t('pagamentos.erroCopiar'));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">{t('pagamentos.titulo')}</h1>
        <p className="mt-1 text-muted-foreground">{t('pagamentos.subtitulo')}</p>
      </header>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo icon={<CheckCircle2 className="h-5 w-5" />} cor="bg-green-100 text-green-700"
          label={t('pagamentos.resumoPagas')}
          valor={q.isLoading ? '…' : t('pagamentos.xDeY', { x: pagos.length, y: totalParcelas })} />
        <Resumo icon={<Wallet className="h-5 w-5" />} cor="bg-[#E8E0FF] text-[#7E69AB]"
          label={t('pagamentos.resumoTotalPago')} valor={q.isLoading ? '…' : fmtValor(totalPago)} />
        <Resumo icon={<Clock className="h-5 w-5" />} cor="bg-amber-100 text-amber-800"
          label={t('pagamentos.resumoEmAberto')} valor={q.isLoading ? '…' : String(abertos.length)} />
      </div>

      <div className="rounded-xl border border-[#E8E0FF] bg-[#F5F0FF] p-4 text-sm text-[#475569]">
        {t('pagamentos.comoFunciona')}
      </div>

      {/* Lista */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {q.isLoading && (
          <div className="space-y-3 p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        )}
        {q.isError && (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive">{t('pagamentos.erroCarregar')}</p>
            <Button variant="outline" className="mt-3" onClick={() => q.refetch()}>{t('common.tryAgain')}</Button>
          </div>
        )}
        {!q.isLoading && !q.isError && pagamentos.length === 0 && (
          <div className="p-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">{t('pagamentos.vazioTitulo')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('pagamentos.vazioTexto')}</p>
          </div>
        )}
        {pagamentos.length > 0 && (
          <ul className="divide-y divide-border">
            {pagamentos.map((p) => {
              const aberto = p.situacao === 'a_vencer' || p.situacao === 'vencido';
              return (
                <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {p.parcela ? t('pagamentos.parcela', { n: p.parcela }) : t('pagamentos.pagamentoUnico')}
                      </span>
                      <Badge className={COR_SITUACAO[p.situacao]}>{t(`pagamentos.situacao.${p.situacao}`)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmtValor(p.valor)} · {t(`pagamentos.forma.${p.forma ?? 'UNDEFINED'}`, { defaultValue: p.forma ?? '—' })}
                      {' · '}
                      {p.situacao === 'pago' && p.pagoEm
                        ? t('pagamentos.pagoEm', { data: fmtData(p.pagoEm) })
                        : t('pagamentos.venceEm', { data: fmtData(p.vencimento) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {aberto && p.linkBoleto && (
                      <Button asChild size="sm" variant="outline">
                        <a href={p.linkBoleto} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" /> {t('pagamentos.baixarBoleto')}</a>
                      </Button>
                    )}
                    {aberto && p.pixDisponivel && (
                      <Button size="sm" variant="outline" onClick={() => abrirPix(p)}>
                        <QrCode className="h-4 w-4" /> {t('pagamentos.pagarPix')}
                      </Button>
                    )}
                    {aberto && p.linkFatura && (
                      <Button asChild size="sm" className="bg-[#7E69AB] text-white hover:bg-[#6B5A96]">
                        <a href={p.linkFatura} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> {t('pagamentos.abrirFatura')}</a>
                      </Button>
                    )}
                    {p.linkComprovante && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={p.linkComprovante} target="_blank" rel="noopener noreferrer"><Receipt className="h-4 w-4" /> {t('pagamentos.verComprovante')}</a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CardSuporte />

      {/* Pix copia e cola */}
      <Dialog open={!!pixAberto} onOpenChange={(v) => { if (!v) { setPixAberto(null); setPix(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">{t('pagamentos.pixTitulo')}</DialogTitle>
            <DialogDescription>
              {pixAberto ? `${fmtValor(pixAberto.valor)} · ${t('pagamentos.venceEm', { data: fmtData(pixAberto.vencimento) })}` : ''}
            </DialogDescription>
          </DialogHeader>
          {carregandoPix && <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {pix && (
            <div className="space-y-4">
              {pix.qr_code_base64 && (
                <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt={t('pagamentos.pixQrAlt')} className="mx-auto h-52 w-52" />
              )}
              {pix.copia_e_cola && (
                <>
                  <p className="break-all rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground">{pix.copia_e_cola}</p>
                  <Button className="w-full bg-[#7E69AB] text-white hover:bg-[#6B5A96]" onClick={copiarPix}>
                    <Copy className="h-4 w-4" /> {t('pagamentos.copiarPix')}
                  </Button>
                </>
              )}
              <p className="text-center text-xs text-muted-foreground">{t('pagamentos.pixAviso')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string; cor: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className={`grid h-10 w-10 place-items-center rounded-full ${cor}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
        <p className="font-heading text-xl font-semibold text-foreground">{valor}</p>
      </div>
    </div>
  );
}
