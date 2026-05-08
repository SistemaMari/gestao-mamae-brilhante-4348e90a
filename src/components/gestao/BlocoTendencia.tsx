import { useContext } from 'react';
import { Info } from 'lucide-react';
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PainelTendencia } from '@/lib/painelEstrategicoTypes';
import { PdfModeContext } from './PdfModeContext';

interface Props {
  data: PainelTendencia;
  loading?: boolean;
  error?: string | null;
  showDataLabels?: boolean;
}

const TOOLTIP_TEXT =
  'Cada ponto do gráfico representa uma fotografia daquele mês: quantas gestantes estavam grávidas e quantas tinham DMG confirmado naquele momento. Como o diagnóstico de DMG geralmente acontece entre 24-28 semanas (3 a 5 meses após a primeira consulta), uma paciente pode entrar na unidade em um mês e aparecer como diagnosticada vários meses depois — por isso a fotografia mensal é a forma correta de medir prevalência ao longo do tempo.';

export default function BlocoTendencia({ data, loading, error, showDataLabels }: Props) {
  const isPdf = useContext(PdfModeContext);
  const semDados = data.every(d => d.total_gestantes === 0 && d.total_dmg_confirmadas === 0);

  return (
    <section className="space-y-3" data-pdf-section="tendencia">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Tendência da unidade
        </h2>
        {!isPdf && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Como ler este gráfico"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm text-xs leading-relaxed">
                {TOOLTIP_TEXT}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5">
          {semDados ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Sem dados nos últimos 6 meses.
            </div>
          ) : (
            <div style={{ width: '100%', height: showDataLabels ? 320 : 280 }}>
              <ResponsiveContainer>
                <LineChart
                  data={data}
                  margin={{ top: showDataLabels ? 24 : 8, right: 24, left: 0, bottom: showDataLabels ? 24 : 8 }}
                >
                  <CartesianGrid stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="mes_label"
                    stroke="#64748B"
                    tick={{ fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  {!showDataLabels && (
                    <RTooltip
                      contentStyle={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    />
                  )}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="total_gestantes"
                    name="Gestantes ativas"
                    stroke="#9b87f5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  >
                    {showDataLabels && (
                      <LabelList
                        dataKey="total_gestantes"
                        position="top"
                        offset={10}
                        style={{ fontSize: 11, fill: '#5F47A8', fontWeight: 600 }}
                      />
                    )}
                  </Line>
                  <Line
                    type="monotone"
                    dataKey="total_dmg_confirmadas"
                    name="DMG confirmadas"
                    stroke="#7E69AB"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  >
                    {showDataLabels && (
                      <LabelList
                        dataKey="total_dmg_confirmadas"
                        position="bottom"
                        offset={10}
                        style={{ fontSize: 11, fill: '#4A3D7A', fontWeight: 600 }}
                      />
                    )}
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="mt-2 text-right text-[12px] text-muted-foreground">
            Cada mês reflete o total de gestantes ativas (DUM nos últimos 280 dias)
            e DMG diagnosticadas até aquela data.
          </p>
        </div>
      )}
    </section>
  );
}
