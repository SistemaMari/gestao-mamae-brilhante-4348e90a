import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarClock, CreditCard, Info, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRenovacaoPlano } from '@/hooks/useRenovacaoPlano';
import { PerfilCard as Card, PerfilCardTitle as CardTitle } from '@/components/perfil/PerfilCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const MOTIVOS = ['nao_uso', 'preco', 'dificil', 'falta_funcao', 'mudanca', 'outro'] as const;

/**
 * Meu plano (consultório): ano pago, renovar e "não quero renovar".
 * A MARI é anuidade e não renova sozinha. "Não quero renovar" não interrompe o
 * ano em curso: acesso e parcelas seguem até o fim (edge nao-renovar-plano).
 */
export default function CardMeuPlano() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const r = useRenovacaoPlano();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<string>('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const location = useLocation();
  const ancora = useRef<HTMLDivElement>(null);
  const pronto = !r.loading && r.aplica;

  // Vindo do aviso do topo (/perfil#meu-plano): rola até aqui.
  useEffect(() => {
    if (pronto && location.hash === '#meu-plano') ancora.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pronto, location.hash]);

  if (r.loading || !r.aplica || !r.fim) return null;

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fimTxt = fmt(r.fim);
  const vencido = (r.dias ?? 0) < 0;

  const confirmar = async () => {
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('nao-renovar-plano', {
      body: { acao: 'nao_renovar', motivo: motivo || undefined, comentario: comentario.trim() || undefined },
    });
    setEnviando(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(t('meuPlano.erroPedido'));
      return;
    }
    setAberto(false);
    toast.success(t('meuPlano.pedidoRegistrado', { data: fimTxt }));
    r.recarregar();
  };

  const desfazer = async () => {
    setEnviando(true);
    const { error } = await supabase.functions.invoke('nao-renovar-plano', { body: { acao: 'desfazer' } });
    setEnviando(false);
    if (error) { toast.error(t('meuPlano.erroPedido')); return; }
    toast.success(t('meuPlano.pedidoDesfeito'));
    r.recarregar();
  };

  return (
    <div id="meu-plano" ref={ancora} className="scroll-mt-24">
    <Card>
      <CardTitle icon={CreditCard}>{t('meuPlano.titulo')}</CardTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('meuPlano.plano')}</p>
          <p className="mt-1 font-medium text-foreground">{r.planoNome ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('meuPlano.anoAtual')}</p>
          <p className="mt-1 font-medium text-foreground">
            {r.inicio ? fmt(r.inicio) : '—'} → {fimTxt}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('meuPlano.mesDeUso')}</p>
          <p className="mt-1 font-medium text-foreground">
            {vencido ? t('meuPlano.vencido') : t('meuPlano.mesDe12', { mes: r.mes })}
          </p>
        </div>
      </div>

      {/* Situação da renovação */}
      {r.pedido ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">{t('meuPlano.pedidoAbertoTitulo', { data: fmt(r.pedido.criado_em) })}</p>
            <p className="mt-1 text-amber-800/90">{t('meuPlano.pedidoAbertoTexto', { data: fimTxt })}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#E8E0FF] bg-[#F5F0FF] p-4">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#7E69AB]" />
          <p className="text-sm text-[#475569]">
            {vencido
              ? t('meuPlano.textoVencido', { data: fimTxt })
              : r.emJanela
                ? t('meuPlano.textoJanela', { dias: r.dias, data: fimTxt })
                : t('meuPlano.textoNormal', { data: fimTxt })}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => navigate('/planos')} className="bg-[#7E69AB] text-white hover:bg-[#6B5A96]">
          {t('meuPlano.renovar')}
        </Button>
        {r.pedido ? (
          <Button variant="outline" onClick={desfazer} disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />} {t('meuPlano.mudeiDeIdeia')}
          </Button>
        ) : !vencido && (
          <Button variant="ghost" className="text-muted-foreground" onClick={() => setAberto(true)}>
            {t('meuPlano.naoRenovar')}
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('meuPlano.notaRenovarAntes')}</p>

      {/* Confirmação de "não quero renovar" */}
      <Dialog open={aberto} onOpenChange={(v) => !enviando && setAberto(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{t('meuPlano.dialogTitulo')}</DialogTitle>
            <DialogDescription>{t('meuPlano.dialogSubtitulo')}</DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            <li>• {t('meuPlano.regraAnuidade')}</li>
            <li>• {t('meuPlano.regraParcelas')}</li>
            <li>• {t('meuPlano.regraAcesso', { data: fimTxt })}</li>
            <li>• {t('meuPlano.regraDepois')}</li>
          </ul>

          {r.garantia && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p>{t('meuPlano.garantia7Dias')}</p>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <Label>{t('meuPlano.motivoLabel')}</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder={t('meuPlano.motivoPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>{t(`meuPlano.motivos.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('meuPlano.comentarioLabel')}</Label>
              <Textarea value={comentario} onChange={(e) => setComentario(e.target.value.slice(0, 1000))} rows={3} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
              {t('meuPlano.voltar')}
            </Button>
            <Button variant="destructive" onClick={confirmar} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 animate-spin" />} {t('meuPlano.confirmarNaoRenovar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </div>
  );
}
