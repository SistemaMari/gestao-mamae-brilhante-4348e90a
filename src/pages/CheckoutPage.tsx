import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle, Copy, QrCode, FileText, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

// ─── Máscaras ────────────────────────────────────────────────────────────────
function maskCpf(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskPhone(v: string) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}
function maskCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
function maskExpiry(v: string) {
  return v.replace(/\D/g, '').slice(0, 4)
    .replace(/(\d{2})(\d)/, '$1/$2');
}
function maskCep(v: string) {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// ─── Plano info ───────────────────────────────────────────────────────────────
const PLANOS: Record<string, { nome: string; preco: string; laudos: number }> = {
  inicial:       { nome: 'Inicial',       preco: 'R$ 79,00/mês',  laudos: 10  },
  intermediaria: { nome: 'Intermediária', preco: 'R$ 139,00/mês', laudos: 35  },
  profissional:  { nome: 'Profissional',  preco: 'R$ 299,00/mês', laudos: 100 },
};

// ─── Schema de validação ─────────────────────────────────────────────────────
const schema = z.object({
  nome:     z.string().min(3, 'checkout.errNomeCurto'),
  email:    z.string().email('checkout.errEmailInvalido'),
  cpf:      z.string().min(14, 'checkout.errCpfInvalido'),
  telefone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Tipos de retorno da edge function ───────────────────────────────────────
type PaymentResult =
  | { billing_type: 'PIX';         pix_qr_code_image: string; pix_copia_cola: string; plano: { nome: string; preco: number } }
  | { billing_type: 'BOLETO';      boleto_linha_digitavel: string; boleto_pdf_url: string; due_date: string; plano: { nome: string; preco: number } }
  | { billing_type: 'CREDIT_CARD'; subscription_id: string; plano: { nome: string; preco: number } };

// ─── Componente principal ────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const planoInfo = PLANOS[slug];

  const [step, setStep] = useState<'dados' | 'pagamento' | 'confirmacao'>('dados');
  const [billingType, setBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [formValues, setFormValues] = useState<FormData | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardCep, setCardCep] = useState('');
  const [cardAddressNumber, setCardAddressNumber] = useState('');

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!planoInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <p className="text-foreground font-semibold mb-4">{t('checkout.planoNaoEncontrado')}</p>
          <Button onClick={() => navigate('/vitrine/planos')}>{t('checkout.verPlanos')}</Button>
        </div>
      </div>
    );
  }

  const onSubmitDados = (data: FormData) => {
    setFormValues(data);
    setStep('pagamento');
  };

  const handleConfirmarPagamento = async () => {
    if (!formValues) return;
    if (billingType === 'CREDIT_CARD' && (!cardNumber || !cardExpiry || !cardCvv || !cardCep)) {
      toast.error(t('checkout.preenchaCartao'));
      return;
    }
    setLoading(true);
    try {
      const [expiryMonth, expiryYear] = cardExpiry.split('/');
      const { data, error } = await supabase.functions.invoke('criar-assinatura-asaas', {
        body: {
          plano_slug: slug,
          nome: formValues.nome,
          email: formValues.email,
          cpf: formValues.cpf.replace(/\D/g, ''),
          telefone: formValues.telefone?.replace(/\D/g, '') ?? '',
          billing_type: billingType,
          ...(billingType === 'CREDIT_CARD' && {
            credit_card_number: cardNumber.replace(/\s/g, ''),
            credit_card_expiry_month: expiryMonth,
            credit_card_expiry_year: `20${expiryYear}`,
            credit_card_cvv: cardCvv,
            cep: cardCep,
            address_number: cardAddressNumber || 'S/N',
          }),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as PaymentResult);
      setStep('confirmacao');
    } catch (e: any) {
      toast.error(e.message ?? t('checkout.erroProcessar'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('checkout.copiado'));
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Layout wrapper ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(252,100%,97%)] to-[hsl(168,60%,95%)] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => step === 'dados' ? navigate('/vitrine/planos') : setStep('dados')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">M</span>
          </div>
          <span className="font-heading font-bold text-sm tracking-widest uppercase text-foreground">MARI</span>
        </div>
        <span className="text-muted-foreground text-sm ml-auto">{t('checkout.checkoutSeguro')}</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-6">

          {/* Resumo do plano */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{t('checkout.planoSelecionado')}</p>
                <p className="font-heading text-xl font-bold text-foreground mt-1">{planoInfo.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('checkout.laudosPorMes', { count: planoInfo.laudos })}</p>
              </div>
              <p className="font-heading text-2xl font-bold text-primary">{planoInfo.preco}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {(['dados', 'pagamento', 'confirmacao'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-primary text-white' :
                  ['dados', 'pagamento', 'confirmacao'].indexOf(step) > i ? 'bg-secondary text-secondary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                <span className={step === s ? 'text-foreground' : 'text-muted-foreground'}>
                  {s === 'dados' ? t('checkout.stepDados') : s === 'pagamento' ? t('checkout.stepPagamento') : t('checkout.stepConfirmacao')}
                </span>
                {i < 2 && <div className="w-6 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Dados pessoais ── */}
          {step === 'dados' && (
            <form onSubmit={handleSubmit(onSubmitDados)} className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="font-heading text-lg font-semibold text-foreground">{t('checkout.stepDados')}</h2>

              <div className="space-y-1">
                <Label htmlFor="nome">{t('checkout.nomeCompleto')}</Label>
                <Input id="nome" placeholder={t('checkout.nomePlaceholder')} {...register('nome')} />
                {errors.nome && <p className="text-xs text-destructive">{t(errors.nome.message as string)}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{t(errors.email.message as string)}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="cpf">{t('checkout.cpf')}</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={watch('cpf') ?? ''}
                    onChange={e => setValue('cpf', maskCpf(e.target.value))}
                  />
                  {errors.cpf && <p className="text-xs text-destructive">{t(errors.cpf.message as string)}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telefone">{t('checkout.celular')} <span className="text-muted-foreground text-xs">{t('common.optional')}</span></Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 99999-0000"
                    value={watch('telefone') ?? ''}
                    onChange={e => setValue('telefone', maskPhone(e.target.value))}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-bold mt-2">{t('checkout.continuar')}</Button>
            </form>
          )}

          {/* ── Step 2: Forma de pagamento ── */}
          {step === 'pagamento' && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">{t('checkout.formaPagamento')}</h2>

              <div className="grid grid-cols-3 gap-3">
                {([
                  { bt: 'PIX',         icon: QrCode,      label: t('checkout.pix'),    sub: t('checkout.pixSub') },
                  { bt: 'BOLETO',      icon: FileText,    label: t('checkout.boleto'), sub: t('checkout.boletoSub')   },
                  { bt: 'CREDIT_CARD', icon: CreditCard,  label: t('checkout.cartao'), sub: t('checkout.cartaoSub')    },
                ] as const).map(({ bt, icon: Icon, label, sub }) => (
                  <button
                    key={bt}
                    onClick={() => setBillingType(bt)}
                    className={`rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                      billingType === bt
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Icon className={`h-7 w-7 ${billingType === bt ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-semibold text-sm ${billingType === bt ? 'text-primary' : 'text-foreground'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">{sub}</span>
                  </button>
                ))}
              </div>

              {/* Campos do cartão */}
              {billingType === 'CREDIT_CARD' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <Label>{t('checkout.numeroCartao')}</Label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={e => setCardNumber(maskCard(e.target.value))}
                      maxLength={19}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('checkout.validade')}</Label>
                      <Input
                        placeholder={t('checkout.validadePlaceholder')}
                        value={cardExpiry}
                        onChange={e => setCardExpiry(maskExpiry(e.target.value))}
                        maxLength={5}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('checkout.cvv')}</Label>
                      <Input
                        placeholder="123"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{t('checkout.cep')}</Label>
                      <Input
                        placeholder="00000-000"
                        value={cardCep}
                        onChange={e => setCardCep(maskCep(e.target.value))}
                        maxLength={9}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('checkout.numero')} <span className="text-muted-foreground text-xs">{t('checkout.numeroEndereco')}</span></Label>
                      <Input
                        placeholder="123"
                        value={cardAddressNumber}
                        onChange={e => setCardAddressNumber(e.target.value.slice(0, 10))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {t('checkout.aposConfirmarPre')} <strong>{t('checkout.aposConfirmarStrong')}</strong> {t('checkout.aposConfirmarPos')}
              </div>

              <Button
                onClick={handleConfirmarPagamento}
                disabled={loading}
                className="w-full h-11 font-bold"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('checkout.processando')}</>
                  : billingType === 'PIX' ? t('checkout.gerarQrCodePix')
                  : billingType === 'BOLETO' ? t('checkout.gerarBoleto')
                  : t('checkout.pagarComCartao')
                }
              </Button>
            </div>
          )}

          {/* ── Step 3: Confirmação ── */}
          {step === 'confirmacao' && result && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-secondary" />
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  {result.billing_type === 'PIX' ? t('checkout.qrCodePixGerado')
                  : result.billing_type === 'BOLETO' ? t('checkout.boletoGerado')
                  : t('checkout.pagamentoConfirmado')}
                </h2>
              </div>

              {result.billing_type === 'CREDIT_CARD' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-secondary/10 border border-secondary/30 p-4 flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{t('checkout.assinaturaAtiva')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('checkout.planoPrefix')} <strong>{result.plano.nome}</strong> {t('checkout.assinadoSucesso')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {result.billing_type === 'PIX' && (
                <div className="space-y-4">
                  {result.pix_qr_code_image && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${result.pix_qr_code_image}`}
                        alt={t('checkout.qrCodePixAlt')}
                        className="w-48 h-48 rounded-lg border border-border"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{t('checkout.pixCopiaCola')}</p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={result.pix_copia_cola}
                        className="text-xs font-mono bg-muted/40"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(result.pix_copia_cola)}
                      >
                        <Copy className={`h-4 w-4 ${copied ? 'text-secondary' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {result.billing_type === 'BOLETO' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">{t('checkout.linhaDigitavel')}</p>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={result.boleto_linha_digitavel}
                        className="text-xs font-mono bg-muted/40"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(result.boleto_linha_digitavel)}
                      >
                        <Copy className={`h-4 w-4 ${copied ? 'text-secondary' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('checkout.vencimento', { data: new Date(result.due_date + 'T12:00:00').toLocaleDateString(i18n.language) })}</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(result.boleto_pdf_url, '_blank')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t('checkout.abrirBoletoPdf')}
                  </Button>
                </div>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-foreground">
                <p className="font-semibold mb-1">{t('checkout.oQueAconteceDepois')}</p>
                <p className="text-muted-foreground text-xs">
                  {t('checkout.aposConfirmacaoPre')} <strong>{t('checkout.aposConfirmacaoStrong')}</strong> {t('checkout.aposConfirmacaoPos')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
