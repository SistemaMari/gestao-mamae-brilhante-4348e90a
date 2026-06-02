import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle, Copy, QrCode, FileText, Loader2, AlertCircle } from 'lucide-react';
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

// ─── Plano info ───────────────────────────────────────────────────────────────
const PLANOS: Record<string, { nome: string; preco: string; laudos: number }> = {
  inicial:       { nome: 'Inicial',       preco: 'R$ 79,00/mês',  laudos: 10  },
  intermediaria: { nome: 'Intermediária', preco: 'R$ 139,00/mês', laudos: 35  },
  profissional:  { nome: 'Profissional',  preco: 'R$ 299,00/mês', laudos: 100 },
};

// ─── Schema de validação ─────────────────────────────────────────────────────
const schema = z.object({
  nome:     z.string().min(3, 'Nome muito curto'),
  email:    z.string().email('E-mail inválido'),
  cpf:      z.string().min(14, 'CPF inválido'),
  telefone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Tipos de retorno da edge function ───────────────────────────────────────
type PaymentResult =
  | { billing_type: 'PIX';    pix_qr_code_image: string; pix_copia_cola: string; plano: { nome: string; preco: number } }
  | { billing_type: 'BOLETO'; boleto_linha_digitavel: string; boleto_pdf_url: string; due_date: string; plano: { nome: string; preco: number } };

// ─── Componente principal ────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const planoInfo = PLANOS[slug];

  const [step, setStep] = useState<'dados' | 'pagamento' | 'confirmacao'>('dados');
  const [billingType, setBillingType] = useState<'PIX' | 'BOLETO'>('PIX');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [formValues, setFormValues] = useState<FormData | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!planoInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <p className="text-foreground font-semibold mb-4">Plano não encontrado.</p>
          <Button onClick={() => navigate('/vitrine/planos')}>Ver planos</Button>
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-assinatura-asaas', {
        body: {
          plano_slug: slug,
          nome: formValues.nome,
          email: formValues.email,
          cpf: formValues.cpf.replace(/\D/g, ''),
          telefone: formValues.telefone?.replace(/\D/g, '') ?? '',
          billing_type: billingType,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as PaymentResult);
      setStep('confirmacao');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
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
        <span className="text-muted-foreground text-sm ml-auto">Checkout seguro</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-6">

          {/* Resumo do plano */}
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Plano selecionado</p>
                <p className="font-heading text-xl font-bold text-foreground mt-1">{planoInfo.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{planoInfo.laudos} laudos/mês</p>
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
                  {s === 'dados' ? 'Seus dados' : s === 'pagamento' ? 'Pagamento' : 'Confirmação'}
                </span>
                {i < 2 && <div className="w-6 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Dados pessoais ── */}
          {step === 'dados' && (
            <form onSubmit={handleSubmit(onSubmitDados)} className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="font-heading text-lg font-semibold text-foreground">Seus dados</h2>

              <div className="space-y-1">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" placeholder="Dr(a). Maria Silva" {...register('nome')} />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={watch('cpf') ?? ''}
                    onChange={e => setValue('cpf', maskCpf(e.target.value))}
                  />
                  {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telefone">Celular <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input
                    id="telefone"
                    placeholder="(11) 99999-0000"
                    value={watch('telefone') ?? ''}
                    onChange={e => setValue('telefone', maskPhone(e.target.value))}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-bold mt-2">Continuar</Button>
            </form>
          )}

          {/* ── Step 2: Forma de pagamento ── */}
          {step === 'pagamento' && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-5">
              <h2 className="font-heading text-lg font-semibold text-foreground">Forma de pagamento</h2>

              <div className="grid grid-cols-2 gap-3">
                {(['PIX', 'BOLETO'] as const).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setBillingType(bt)}
                    className={`rounded-lg border-2 p-4 flex flex-col items-center gap-2 transition-all ${
                      billingType === bt
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    {bt === 'PIX'
                      ? <QrCode className={`h-7 w-7 ${billingType === bt ? 'text-primary' : 'text-muted-foreground'}`} />
                      : <FileText className={`h-7 w-7 ${billingType === bt ? 'text-primary' : 'text-muted-foreground'}`} />
                    }
                    <span className={`font-semibold text-sm ${billingType === bt ? 'text-primary' : 'text-foreground'}`}>
                      {bt === 'PIX' ? 'Pix' : 'Boleto'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {bt === 'PIX' ? 'Aprovação imediata' : 'Até 3 dias úteis'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Após confirmar o pagamento, você receberá um <strong>e-mail para definir sua senha</strong> e acessar o sistema.
              </div>

              <Button
                onClick={handleConfirmarPagamento}
                disabled={loading}
                className="w-full h-11 font-bold"
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…</>
                  : `Gerar ${billingType === 'PIX' ? 'QR Code Pix' : 'Boleto'}`
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
                  {result.billing_type === 'PIX' ? 'QR Code Pix gerado!' : 'Boleto gerado!'}
                </h2>
              </div>

              {result.billing_type === 'PIX' && (
                <div className="space-y-4">
                  {result.pix_qr_code_image && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${result.pix_qr_code_image}`}
                        alt="QR Code Pix"
                        className="w-48 h-48 rounded-lg border border-border"
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Pix Copia e Cola</p>
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
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Linha Digitável</p>
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
                  <p className="text-xs text-muted-foreground">Vencimento: {new Date(result.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(result.boleto_pdf_url, '_blank')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Abrir boleto PDF
                  </Button>
                </div>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm text-foreground">
                <p className="font-semibold mb-1">O que acontece depois?</p>
                <p className="text-muted-foreground text-xs">
                  Após a confirmação do pagamento, você receberá um <strong>e-mail</strong> com o link para criar sua senha e acessar o MARI.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
