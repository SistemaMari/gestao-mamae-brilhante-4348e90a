import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
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
import { Switch } from '@/components/ui/switch';
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
  pacientes_max: number | null;
  preco_mensal: number;
  link_pagamento_asaas: string | null;
  metricas_habilitado: boolean;
  ordem: number;
}

interface FormState {
  id: string;
  slug: string;
  nome: string;
  pacientes_max: number | null;
  pacientes_original: number | null;
  preco_str: string;
  preco_original: number;
  link_pagamento_asaas: string;
  metricas_habilitado: boolean;
  propagacao: 'preservar' | 'reajustar';
}

export default function PlanosAdminPage() {
  const { t, i18n } = useTranslation();
  const fmtPreco = (v: number) =>
    v.toLocaleString(i18n.language, { style: 'currency', currency: 'BRL' });
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
          .select('id, slug, nome, pacientes_max, preco_mensal, link_pagamento_asaas, metricas_habilitado, ordem')
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
      pacientes_max: p.pacientes_max,
      pacientes_original: p.pacientes_max,
      preco_str: String(p.preco_mensal),
      preco_original: p.preco_mensal,
      link_pagamento_asaas: p.link_pagamento_asaas ?? '',
      metricas_habilitado: p.metricas_habilitado,
      propagacao: 'preservar',
    });
  }

  const pacientesMudou = form ? form.pacientes_max !== form.pacientes_original : false;
  const precoNum = form ? (Number(form.preco_str) || 0) : 0;
  const precoMudou = form ? precoNum !== form.preco_original : false;
  const mudouAlgo = pacientesMudou || precoMudou;
  const afetados = form ? (contagem[form.id] ?? 0) : 0;

  function iniciarSalvar() {
    if (!form) return;
    if (!form.nome.trim()) {
      toast.error(t('admin.planos.nameRequired'));
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
          pacientes_max: form.pacientes_max,
          preco_mensal: preco,
          link_pagamento_asaas: form.link_pagamento_asaas.trim() || null,
          metricas_habilitado: form.metricas_habilitado,
        })
        .eq('id', form.id);
      if (error) throw error;

      // Pacientes: o limite é lido direto do plano (join ao vivo em
      // pode_criar_ficha), então a mudança já vale imediatamente para todos
      // os clientes atuais — não precisa de propagação nem escolha do admin.
      const reajustar = form.propagacao === 'reajustar';

      // Preço: reajusta as assinaturas atuais direto no Asaas (cobrança real).
      if (reajustar && precoMudou) {
        const { data, error: errAsaas } = await supabase.functions.invoke(
          'reajustar-assinaturas-plano',
          { body: { plano_id: form.id, novo_valor: preco } },
        );
        if (errAsaas) {
          toast.error(t('admin.planos.savedAsaasError'));
        } else {
          const r = data as { total: number; atualizadas: number; falhas: unknown[] };
          if (r.falhas?.length) {
            toast.error(t('admin.planos.savedAsaasPartial', { atualizadas: r.atualizadas, total: r.total, falhas: r.falhas.length }));
          } else if (r.total > 0) {
            toast.success(t('admin.planos.savedAsaasSuccess', { atualizadas: r.atualizadas }));
          } else {
            toast.success(t('admin.planos.savedNoActive'));
          }
        }
      } else {
        toast.success(
          pacientesMudou
            ? t('admin.planos.savedWithPacientes', { count: afetados })
            : t('admin.planos.saved'),
        );
      }

      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-planos'] });
    } catch (e) {
      toast.error(t('admin.planos.saveError', { error: (e as Error).message }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">{t('admin.planos.title')}</h1>
        <p className="mt-1 text-muted-foreground">
          {t('admin.planos.subtitle')}
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
          <p className="text-foreground">{t('admin.planos.loadError')}</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {planos.map((p) => {
            const nAssinantes = contagem[p.id] ?? 0;
            return (
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
                  {p.pacientes_max !== null
                    ? t('admin.planos.patientsLimit', { count: p.pacientes_max })
                    : t('admin.planos.patientsUnlimited')} · {t('admin.planos.pricePerMonth', { preco: fmtPreco(p.preco_mensal) })}
                  {' · '}
                  <span className={p.metricas_habilitado ? 'text-secondary' : 'text-muted-foreground'}>
                    {p.metricas_habilitado ? t('admin.planos.metricsOn') : t('admin.planos.metricsOff')}
                  </span>
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
                    {t('admin.planos.linkAsaas')}
                  </a>
                )}
              </div>
              <div
                className="flex shrink-0 flex-col items-center rounded-lg px-4 py-2"
                style={{ backgroundColor: '#F5F0FF' }}
                aria-label={t('admin.planos.subscribersCount', { count: nAssinantes })}
              >
                <span
                  className="font-heading text-2xl font-bold leading-none"
                  style={{ color: '#7C4DBA' }}
                >
                  {nAssinantes}
                </span>
                <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('admin.planos.subscribersLabel', { count: nAssinantes })}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => editar(p)} aria-label={t('common.edit')}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{t('admin.planos.editTitle')}</DialogTitle>
            <DialogDescription>
              {form?.slug ? t('admin.planos.editPlanSlug', { slug: form.slug }) + ' ' : ''}{t('admin.planos.priceNewSubscriptions')}
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('common.name')}</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t('admin.planos.patientsLimitLabel')}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={t('admin.planos.patientsUnlimited')}
                    value={form.pacientes_max === null ? '' : String(form.pacientes_max)}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '');
                      setForm({ ...form, pacientes_max: d ? Number(d) : null });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.planos.patientsLimitHelp')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('admin.planos.priceLabel')}</Label>
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
                  <Trans
                    i18nKey="admin.planos.priceInfo"
                    components={{ strong: <strong className="font-medium text-foreground" /> }}
                  />
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('admin.planos.paymentLinkLabel')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://www.asaas.com/paymentCampaign/show/..."
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
                      aria-label={t('admin.planos.openAsaasLink')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.planos.paymentLinkHelp')}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label className="text-sm font-medium text-foreground">{t('admin.planos.metricsToggleLabel')}</Label>
                  <p className="text-xs text-muted-foreground">{t('admin.planos.metricsToggleHelp')}</p>
                </div>
                <Switch
                  checked={form.metricas_habilitado}
                  onCheckedChange={(checked) => setForm({ ...form, metricas_habilitado: checked })}
                />
              </div>

              {mudouAlgo && (
                <div className="space-y-2 rounded-md border border-[#E8E0FF] bg-[#F5F0FF] p-3">
                  {pacientesMudou && (
                    <p className="text-sm text-foreground">
                      {t('admin.planos.pacientesMudouInfo', {
                        from: form.pacientes_original ?? '∞',
                        to: form.pacientes_max ?? '∞',
                        count: afetados,
                      })}
                    </p>
                  )}

                  {precoMudou && (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {t('admin.planos.changedPrefix')}{' '}
                        {t('admin.planos.changedPrice', { from: fmtPreco(form.preco_original), to: fmtPreco(precoNum) })}
                        {t('admin.planos.changedSuffix')}
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
                            <Trans
                              i18nKey="admin.planos.optPreservar"
                              count={afetados}
                              values={{ count: afetados }}
                              components={{ b: <span className="font-medium" /> }}
                            />
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <RadioGroupItem value="reajustar" className="mt-0.5" />
                          <span>
                            <Trans
                              i18nKey="admin.planos.optReajustar"
                              count={afetados}
                              values={{ count: afetados }}
                              components={{ b: <span className="font-medium" /> }}
                            />
                            {t('admin.planos.optReajustarAsaas')}
                          </span>
                        </label>
                      </RadioGroup>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#7C4DBA' }}
              onClick={iniciarSalvar}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação do reajuste de PREÇO nas assinaturas atuais (cobrança real) */}
      <AlertDialog open={confirmarReajuste} onOpenChange={(open) => !open && setConfirmarReajuste(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.planos.confirmReajusteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {form && (
                <>
                  <Trans
                    i18nKey="admin.planos.confirmReajusteBody"
                    values={{ preco: fmtPreco(precoNum) }}
                    components={{ b: <strong /> }}
                  />
                  {afetados ? (
                    <>{' '}{t('admin.planos.confirmReajusteAffected', { count: afetados })}</>
                  ) : null}
                  {' '}{t('admin.planos.confirmReajusteTail')}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executarSalvar()}
              style={{ backgroundColor: '#7C4DBA' }}
              className="text-white hover:opacity-90"
            >
              {t('admin.planos.confirmReajusteAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
