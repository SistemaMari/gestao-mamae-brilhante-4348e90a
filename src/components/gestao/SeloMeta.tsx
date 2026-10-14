import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BASE_MINIMA_META, CFG_META, type IndicadorMeta, type SituacaoMeta } from '@/lib/metas';
import { useFormatarMeta, useTextoSituacao } from '@/hooks/useTextosMeta';
import CardInfoTooltip from './CardInfoTooltip';

// Tons suaves: "não atingiu" em âmbar (atenção), nunca vermelho.
const TOM = {
  atingida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  nao_atingida: 'bg-amber-50 text-amber-800 border-amber-200',
  neutro: 'bg-slate-50 text-slate-600 border-slate-200',
} as const;

/** Ícone da situação (✓ atingida, ✗ não atingida, i poucos dados/sem dados). */
export function IconeSituacao({ situacao, className = 'h-4 w-4' }: { situacao: SituacaoMeta; className?: string }) {
  if (situacao === 'atingida') return <CheckCircle2 className={`${className} text-emerald-600`} aria-hidden />;
  if (situacao === 'nao_atingida') return <XCircle className={`${className} text-amber-600`} aria-hidden />;
  if (situacao === 'sem_meta') return null;
  return <Info className={`${className} text-slate-400`} aria-hidden />;
}

interface Props {
  indicador: IndicadorMeta;
  situacao: SituacaoMeta;
  meta: number | null;
  className?: string;
}

/** Selo "Meta atingida / Abaixo da meta / Acima do limite / Poucos dados" + "Meta: mínimo X". */
export default function SeloMeta({ indicador, situacao, meta, className = 'mt-1.5' }: Props) {
  const { t } = useTranslation();
  const formatar = useFormatarMeta();
  const textoSituacao = useTextoSituacao();
  const texto = textoSituacao(indicador, situacao);
  if (texto == null || meta == null) return null;
  const tom = situacao === 'atingida' || situacao === 'nao_atingida' ? TOM[situacao] : TOM.neutro;
  const chaveMeta = CFG_META[indicador].sentido === 'maximo' ? 'gestao.metas.metaMax' : 'gestao.metas.metaMin';
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tom}`}>
        <IconeSituacao situacao={situacao} className="h-3 w-3" />
        {texto}
      </span>
      <span className="text-[11px] text-muted-foreground">{t(chaveMeta, { valor: formatar(indicador, meta) })}</span>
      {situacao === 'poucos_dados' && <CardInfoTooltip text={t('gestao.metas.poucosDadosTip', { n: BASE_MINIMA_META })} />}
    </div>
  );
}
