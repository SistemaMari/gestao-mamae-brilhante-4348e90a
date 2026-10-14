import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  compararIndicador,
  textoVariacao,
  type SentidoIndicador,
  type UnidadeIndicador,
} from '@/lib/linhaCuidado';
import CardInfoTooltip from './CardInfoTooltip';

interface VariacaoProps {
  atual: number | null | undefined;
  anterior: number | null | undefined;
  unidade: UnidadeIndicador;
  sentido: SentidoIndicador;
}

const TOM_CLASSE = {
  bom: 'bg-emerald-50 text-emerald-700',
  ruim: 'bg-rose-50 text-rose-700',
  neutro: 'bg-slate-100 text-slate-600',
} as const;

/** Seta ↑↓ com a variação vs. o período anterior (cor pelo sentido do indicador). */
export function VariacaoPeriodo({ atual, anterior, unidade, sentido }: VariacaoProps) {
  const { t, i18n } = useTranslation();
  const v = compararIndicador(atual, anterior, unidade, sentido);
  if (v.direcao === 'sem_base') {
    return <span className="text-[11px] text-muted-foreground">{t('gestao.linhaCuidado.semBase')}</span>;
  }
  if (v.direcao === 'igual') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM_CLASSE.neutro}`}>
        <Minus className="h-3 w-3" />
        {t('gestao.linhaCuidado.igual')}
      </span>
    );
  }
  const Icon = v.direcao === 'subiu' ? ArrowUp : ArrowDown;
  const texto = textoVariacao(v, unidade, i18n.language);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TOM_CLASSE[v.tom]}`}>
      <Icon className="h-3 w-3" />
      {unidade === 'dias' ? t('gestao.linhaCuidado.dias', { valor: texto }) : texto}
      <span className="font-normal opacity-80">{t('gestao.linhaCuidado.vsAnterior')}</span>
    </span>
  );
}

interface CardProps extends VariacaoProps {
  titulo: string;
  tooltip: string;
  valor: string;
  detalhe?: string;
  Icon: React.ElementType;
  destaque?: boolean;
  /** Abaixo da variação (ex.: selo da meta da rede). */
  rodape?: React.ReactNode;
}

/** Card de indicador no padrão dos blocos do painel + variação do período. */
export default function LinhaDeCuidadoIndicador({ titulo, tooltip, valor, detalhe, Icon, destaque, rodape, ...variacao }: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        destaque ? 'border-rose-200 border-l-4 border-l-rose-400' : 'border-[#E2E8F0]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
            <CardInfoTooltip text={tooltip} />
          </div>
          <p className="mt-1 font-heading text-[32px] font-bold leading-none text-[#1E293B]">{valor}</p>
          {detalhe && <p className="mt-1 text-xs text-[#475569]">{detalhe}</p>}
          <div className="mt-2">
            <VariacaoPeriodo {...variacao} />
          </div>
          {rodape}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${destaque ? 'bg-rose-50' : 'bg-[#F5F0FF]'}`}>
          <Icon className={`h-5 w-5 ${destaque ? 'text-rose-500' : 'text-[#9b87f5]'}`} />
        </div>
      </div>
    </div>
  );
}
