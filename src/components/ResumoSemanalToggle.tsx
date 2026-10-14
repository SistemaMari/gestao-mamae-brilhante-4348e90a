import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';

// As RPCs ainda não estão no types.ts gerado (entram quando o Lovable regenerar).
type RespostaRpc<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface RpcResumoSemanal {
  rpc(fn: 'obter_receber_resumo_semanal'): RespostaRpc<boolean>;
  rpc(fn: 'definir_receber_resumo_semanal', args: { p_receber: boolean }): RespostaRpc<boolean>;
}
const db = supabase as unknown as RpcResumoSemanal;

/**
 * Interruptor "Receber o resumo semanal por e-mail" (gestor de unidade e
 * gestor geral). Lê/grava só pela RPC (obter_/definir_receber_resumo_semanal),
 * que muda apenas essa coluna da própria pessoa.
 * Na vitrine não chama o banco (estado só local).
 */
export function ResumoSemanalToggle({ vitrine = false, descricao }: { vitrine?: boolean; descricao: string }) {
  const { t } = useTranslation();
  const [receber, setReceber] = useState<boolean | null>(vitrine ? true : null);
  const [carregando, setCarregando] = useState(!vitrine);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (vitrine) return;
    let ativo = true;
    (async () => {
      const { data, error } = await db.rpc('obter_receber_resumo_semanal');
      if (!ativo) return;
      if (error) console.warn('[ResumoSemanalToggle] erro ao ler preferência:', error);
      // NULL = não é gestor; erro = função ainda não aplicada → esconde o controle.
      setReceber(error ? null : data);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [vitrine]);

  const alterar = async (valor: boolean) => {
    if (vitrine) { setReceber(valor); return; }
    const anterior = receber;
    setReceber(valor);
    setSalvando(true);
    const { error } = await db.rpc('definir_receber_resumo_semanal', { p_receber: valor });
    setSalvando(false);
    if (error) {
      setReceber(anterior);
      toast.error(t('gestao.configuracoes.resumoSemanalErro'));
      return;
    }
    toast.success(valor ? t('gestao.configuracoes.resumoSemanalLigado') : t('gestao.configuracoes.resumoSemanalDesligado'));
  };

  if (carregando) {
    return <div className="h-6 w-64 animate-pulse rounded bg-muted" />;
  }
  if (receber === null) {
    return <p className="text-sm text-muted-foreground">{t('gestao.configuracoes.resumoSemanalIndisponivel')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#475569]">{descricao}</p>
      <label className="flex items-center gap-3 text-sm font-medium text-foreground">
        <Switch
          checked={receber}
          disabled={salvando}
          onCheckedChange={alterar}
          aria-label={t('gestao.configuracoes.resumoSemanalReceber')}
        />
        {t('gestao.configuracoes.resumoSemanalReceber')}
      </label>
    </div>
  );
}
