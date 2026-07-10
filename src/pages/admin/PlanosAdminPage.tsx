import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreditCard, Pencil, Loader2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Plano {
  id: string;
  slug: string;
  nome: string;
  laudos_por_mes: number;
  preco_mensal: number;
  link_pagamento_asaas: string | null;
  ordem: number;
}

interface FormState {
  id: string;
  slug: string;
  nome: string;
  laudos_por_mes: number;
  laudos_original: number;
  preco_str: string;
  preco_original: number;
  link_pagamento_asaas: string;
  propagacao: 'preservar' | 'reajustar';
}

const fmtPreco = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PlanosAdminPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmarReajuste, setConfirmarReajuste] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-planos'],
    queryFn: async () => {
      const [resPlanos, resProfs] = await Promise.all([
        supabase
          .from('planos')
          .select('id, slug, nome, laudos_por_mes, preco_mensal, link_pagamento_asaas, ordem')
          .order('ordem', { ascending: true }),
        supabase.from('profissionais').select('plano_id'),
      ]);
      if (resPlanos.error) throw resPlanos.error;
      const planos = (resPlanos.data ?? []) as Plano[];
      const contagem: Record<string, number> = {};
      (resProfs.data ?? []).forEach((p) => {
        if (p.plano_id) contagem[p.plano_id] = (contagem[p.plano_id] ?? 0) + 1;
      });
      return { planos, contagem };
    },
  });

  const planos = data?.planos ?? [];
  const contagem = data?.contagem ?? {};

  function editar(p: Plano) {
    setForm({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      laudos_por_mes: p.laudos_por_mes,
      laudos_original: p.laudos_por_mes,
      preco_str: String(p.preco_mensal),
      preco_original: p.preco_mensal,
      link_pagamento_asaas: p.link_pagamento_asaas ?? '',
      propagacao: 'preservar',
    });
  }

  const laudosMudou = form ? form.laudos_por_mes !== form.laudos_original : false;
  const precoNum = form ? (Number(form.preco_str) || 0) : 0;
  const precoMudou = form ? precoNum !== form.preco_original : false;
  const mudouAlgo = laudosMudou || precoMudou;
  const afetados = form ? (contagem[form.id] ?? 0) : 0;

  function iniciarSalvar() {
    if (!form) return;
    if (!form.nome.trim()) {
      toast.error('Informe o nome do plano.');
      return;
    }
    // Reajustar o PREÇO dos clientes atuais mexe em cobrança real → confirma antes.
    if (form.propagacao === 'reajustar' && precoMudou) {
      setConfirmarReajuste(true);
      return;
    }
    void executarSalvar();
  }

  async function executarSalvar() {
    if (!form) return;
    const preco = Number(form.preco_str) || 0;
    setConfirmarReajuste(false);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('planos')
        .update({
          nome: form.nome.trim(),
          laudos_por_mes: form.laudos_por_mes,
          preco_mensal: preco,
          link_pagamento_asaas: form.link_pagamento_asaas.trim() || null,
        })
        .eq('id', form.id);
      if (error) throw error;

      const reajustar = form.propagacao === 'reajustar';

      // Laudos: propaga o limite aos clientes atuais (no banco).
      if (reajustar && laudosMudou) {
        const { error: errProp } = await supabase
          .from('profissionais')
          .update({ laudos_limite: form.laudos_por_mes })
          .eq('plano_id', form.id);
        if (errProp) throw errProp;
      }

      // Preço: reajusta as assinaturas atuais direto no Asaas (cobrança real).
      if (reajustar && precoMudou) {
        const { data, error: errAsaas } = await supabase.functions.invoke(
          'reajustar-assinaturas-plano',
          { body: { plano_id: form.id, novo_valor: preco } },
        );
        if (errAsaas) {
          toast.error('Plano salvo, mas houve erro ao reajustar as assinaturas no Asaas.');
        } else {
          const r = data as { total: number; atualizadas: number; falhas: unknown[] };
          if (r.falhas?.length) {
            toast.error(`Plano salvo. Asaas: ${r.atualizadas}/${r.total} reajustadas — ${r.falhas.length} falha(s).`);
          } else if (r.total > 0) {
            toast.success(`Plano salvo e ${r.atualizadas} assinatura(s) reajustada(s) no Asaas.`);
          } else {
            toast.success('Plano salvo. Nenhuma assinatura ativa no Asaas para reajustar.');
          }
        }
      } else {
        toast.success(
          reajustar && laudosMudou
            ? 'Plano atualizado e limite de laudos aplicado aos clientes atuais.'
            : 'Plano atualizado.',
        );
      }

      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-planos'] });
    } catch (e) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">Planos</h1>
        <p className="mt-1 text-muted-foreground">
          Edite nome, laudos/mês, preço e link de pagamento de cada plano de consultório.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-foreground">Não foi possível carregar os planos.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {planos.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: '#E8E0FF' }}
              >
                <CreditCard className="h-5 w-5" style={{ color: '#7C4DBA' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-heading font-bold text-foreground">{p.nome}</p>
                  <Badge variant="outline" className="shrink-0">{p.slug}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {p.laudos_por_mes} laudos/mês · {fmtPreco(p.preco_mensal)}/mês
                  {contagem[p.id] ? ` · ${contagem[p.id]} cliente(s)` : ''}
                </p>
                {p.link_pagamento_asaas && (
                  <a
                    href={p.link_pagamento_asaas}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: '#7C4DBA' }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Link Asaas
                  </a>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => editar(p)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Editar plano</DialogTitle>
            <DialogDescription>
              {form?.slug ? `Plano "${form.slug}".` : ''} O preço vale para novas assinaturas.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Laudos por mês</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={String(form.laudos_por_mes)}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '');
                      setForm({ ...form, laudos_por_mes: d ? Number(d) : 0 });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço (R$/mês)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.preco_str}
                    onChange={(e) => {
                      // dígitos + um separador decimal (vírgula vira ponto)
                      let v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                      const p = v.split('.');
                      if (p.length > 2) v = `${p[0]}.${p.slice(1).join('')}`;
                      setForm({ ...form, preco_str: v });
                    }}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  O preço vale para <strong className="font-medium text-foreground">novas assinaturas</strong>.
                  As assinaturas atuais só mudam se você escolher{' '}
                  <strong className="font-medium text-foreground">"Reajustar geral"</strong> (aí o novo valor é
                  aplicado às cobranças ativas no Asaas).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Link de pagamento (Asaas)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://www.asaas.com/c/..."
                    value={form.link_pagamento_asaas}
                    onChange={(e) => setForm({ ...form, link_pagamento_asaas: e.target.value })}
                  />
                  {form.link_pagamento_asaas.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        window.open(form.link_pagamento_asaas.trim(), '_blank', 'noopener,noreferrer')
                      }
                      aria-label="Abrir link do Asaas"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Link do produto no Asaas — facilita o acesso na hora de conferir/editar a cobrança.
                </p>
              </div>

              {mudouAlgo && (
                <div className="space-y-2 rounded-md border border-[#E8E0FF] bg-[#F5F0FF] p-3">
                  <p className="text-sm font-medium text-foreground">
                    Você alterou {laudosMudou && `laudos/mês (${form.laudos_original} → ${form.laudos_por_mes})`}
                    {laudosMudou && precoMudou && ' e '}
                    {precoMudou && `preço (${fmtPreco(form.preco_original)} → ${fmtPreco(precoNum)})`}. Aplicar a quem?
                  </p>
                  <RadioGroup
                    value={form.propagacao}
                    onValueChange={(v) =>
                      setForm({ ...form, propagacao: v as 'preservar' | 'reajustar' })
                    }
                    className="gap-2"
                  >
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <RadioGroupItem value="preservar" className="mt-0.5" />
                      <span>
                        <span className="font-medium">Preservar clientes atuais</span> — vale só para
                        novos cadastros/renovações. Os {afetados} cliente(s) atuais mantêm o que já têm.
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <RadioGroupItem value="reajustar" className="mt-0.5" />
                      <span>
                        <span className="font-medium">Reajustar geral</span> — aplica já aos {afetados}{' '}
                        cliente(s) atuais.
                        {precoMudou && ' O preço reajusta as cobranças ativas no Asaas (cobrança real).'}
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#7C4DBA' }}
              onClick={iniciarSalvar}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação do reajuste de PREÇO nas assinaturas atuais (cobrança real) */}
      <AlertDialog open={confirmarReajuste} onOpenChange={(open) => !open && setConfirmarReajuste(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reajustar a cobrança dos clientes atuais?</AlertDialogTitle>
            <AlertDialogDescription>
              {form && (
                <>
                  Isso vai alterar a <strong>cobrança real</strong> das assinaturas ativas deste plano no
                  Asaas para <strong>{fmtPreco(precoNum)}/mês</strong>
                  {afetados ? <> (até {afetados} cliente(s))</> : null}. Os clientes atuais passarão a pagar o
                  novo valor. Esta ação afeta faturamento e não se desfaz sozinha.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executarSalvar()}
              style={{ backgroundColor: '#7C4DBA' }}
              className="text-white hover:opacity-90"
            >
              Sim, reajustar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
