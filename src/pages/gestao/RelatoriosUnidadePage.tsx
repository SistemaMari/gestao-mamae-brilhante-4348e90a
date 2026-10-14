import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileBarChart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Relatorio {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  origem: string | null;
  arquivo_path: string;
  created_at: string;
}

/** "2026-09-01" → "setembro de 2026" no idioma da tela. */
function rotuloMes(iso: string, locale: string): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Relatórios mensais da unidade (gerados automaticamente pelo
 * gerar-relatorios-mensais e salvos em relatorios_unidade + bucket
 * `relatorios`). Antes o gestor só via um aviso de status em Configurações,
 * sem como baixar. RLS e storage já liberam a leitura para o gestor da unidade.
 */
export default function RelatoriosUnidadePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErro(false);
      try {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('unidade_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!prof?.unidade_id) {
          setRelatorios([]);
          return;
        }
        const { data, error } = await supabase
          .from('relatorios_unidade')
          .select('id, periodo_inicio, periodo_fim, origem, arquivo_path, created_at')
          .eq('unidade_id', prof.unidade_id)
          .order('periodo_inicio', { ascending: false })
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRelatorios((data ?? []) as Relatorio[]);
      } catch (e) {
        console.error('[RelatoriosUnidadePage]', e);
        setErro(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const baixar = async (r: Relatorio) => {
    setBaixando(r.id);
    try {
      const { data, error } = await supabase.storage.from('relatorios').createSignedUrl(r.arquivo_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error('sem URL');
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (e) {
      console.error('[RelatoriosUnidadePage] download', e);
      toast.error(t('gestao.relatorios.erroBaixar'));
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
          <FileBarChart className="h-6 w-6 text-primary" />
          {t('gestao.relatorios.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('gestao.relatorios.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('gestao.relatorios.carregando')}
        </div>
      ) : erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {t('gestao.relatorios.erroCarregar')}
        </div>
      ) : relatorios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t('gestao.relatorios.vazio')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-[#5B3A8C] text-left text-white">
              <tr>
                <th className="px-4 py-3 font-medium">{t('gestao.relatorios.colMes')}</th>
                <th className="px-4 py-3 font-medium">{t('gestao.relatorios.colOrigem')}</th>
                <th className="px-4 py-3 font-medium">{t('gestao.relatorios.colGeradoEm')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {relatorios.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium capitalize text-foreground">
                    {rotuloMes(r.periodo_inicio, i18n.language)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.origem === 'automatico' ? t('gestao.relatorios.origemAutomatico') : t('gestao.relatorios.origemManual')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString(i18n.language)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => baixar(r)} disabled={baixando === r.id}>
                      {baixando === r.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      {t('gestao.relatorios.baixar')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
