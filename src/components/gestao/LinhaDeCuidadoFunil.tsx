import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { linhasFunil, type EtapaFunil, type LinhaCuidadoBloco } from '@/lib/linhaCuidado';
import CardInfoTooltip from './CardInfoTooltip';

const COR: Record<EtapaFunil, string> = {
  rastreadas: '#9b87f5',
  diagnosticadas: '#7E69AB',
  em_acompanhamento: '#9b87f5',
  insulinizacao: '#7E69AB',
  parto: '#C4B5FD',
  aborto: '#94A3B8',
  nao_retornou: '#E11D48', // perda de seguimento em destaque
  outro: '#CBD5E1',
};

const ALTURA_LINHA = 34;

function Barras({
  dados,
  maximo,
}: {
  dados: Array<{ etapa: EtapaFunil; rotulo: string; n: number }>;
  maximo: number;
}) {
  return (
    <div style={{ width: '100%', height: dados.length * ALTURA_LINHA + 8 }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }} barCategoryGap={6}>
          <XAxis type="number" hide domain={[0, Math.max(maximo, 1)]} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={160}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: '#475569' }}
          />
          <Bar dataKey="n" radius={[0, 6, 6, 0]} isAnimationActive={false} background={{ fill: '#F8FAFC', radius: 6 }}>
            {dados.map((d) => (
              <Cell key={d.etapa} fill={COR[d.etapa]} />
            ))}
            <LabelList dataKey="n" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#1E293B' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Funil em barras horizontais: rastreio → diagnóstico → situação de hoje das diagnosticadas. */
export default function LinhaDeCuidadoFunil({ funil }: { funil: LinhaCuidadoBloco['funil'] }) {
  const { t, i18n } = useTranslation();
  const linhas = linhasFunil(funil);
  const rotulo = (e: EtapaFunil) => t(`gestao.linhaCuidado.etapa_${e}`);
  const rastreio = linhas
    .filter((l) => l.grupo === 'rastreio')
    .map((l) => ({ etapa: l.etapa, rotulo: rotulo(l.etapa), n: l.n }));
  const desfechos = linhas
    .filter((l) => l.grupo === 'desfecho')
    .map((l) => ({ etapa: l.etapa, rotulo: rotulo(l.etapa), n: l.n }));

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-[#1E293B]">{t('gestao.linhaCuidado.funilTitle')}</h3>
        <CardInfoTooltip text={t('gestao.linhaCuidado.funilTip')} />
      </div>
      <Barras dados={rastreio} maximo={funil.rastreadas} />
      {funil.taxa_diagnostico_pct != null && (
        <p className="mb-3 pl-1 text-xs text-muted-foreground">
          {t('gestao.linhaCuidado.taxaDiag', {
            pct: funil.taxa_diagnostico_pct.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
          })}
        </p>
      )}
      <p className="mb-1 border-t border-[#F1F5F9] pt-3 text-xs font-medium uppercase tracking-wide text-[#64748B]">
        {t('gestao.linhaCuidado.funilDesfechos')}
      </p>
      <Barras dados={desfechos} maximo={funil.diagnosticadas} />
    </div>
  );
}
