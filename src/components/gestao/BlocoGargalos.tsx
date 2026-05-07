import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PainelGargalos } from '@/lib/painelEstrategicoTypes';
import CardInfoTooltip from './CardInfoTooltip';

const TOOLTIPS: Record<string, string> = {
  sem_gj:
    'Pacientes com primeira consulta registrada mas sem glicemia de jejum no atendimento. A GJ é o primeiro exame de rastreamento de DMG (protocolo Febrasgo) e deve ser solicitada na primeira consulta de pré-natal — inclusive para identificar diabete pré-gestacional. Falha aqui significa que o rastreamento não começou.',
  gtt:
    'Pacientes acima de 28 semanas que ainda não fizeram o Teste de Tolerância à Glicose. A janela ideal de rastreamento é 24-28 semanas — depois disso, o diagnóstico fica tardio e o tempo de tratamento antes do parto encurta. Convocar essas pacientes é prioridade.',
  sem_retorno:
    'Pacientes diagnosticadas com DMG cujo último atendimento foi há mais de 14 dias. DMG exige acompanhamento próximo (perfis glicêmicos quinzenais, ajuste de tratamento). Ausência de retorno pode indicar abandono — fator crítico de risco para o binômio mãe-bebê.',
};

interface Props {
  data: PainelGargalos;
  loading?: boolean;
  error?: string | null;
}

type Severidade = 'amarelo' | 'laranja' | 'vermelho';

const PALETA: Record<Severidade, { border: string; bg: string; iconBg: string; iconText: string }> = {
  amarelo: {
    border: 'border-yellow-200',
    bg: 'bg-yellow-50',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-700',
  },
  laranja: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
  },
  vermelho: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconText: 'text-red-700',
  },
};

export default function BlocoGargalos({ data, loading, error }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/vitrine') ? '/vitrine/gestao' : '/gestao';

  const itens: Array<{
    key: string;
    titulo: string;
    descricao: string;
    severidade: Severidade;
    data: { count: number; paciente_ids: string[] };
  }> = [
    {
      key: 'sem_gj',
      titulo: 'Sem GJ na primeira consulta',
      descricao: 'Pacientes com atendimento mas sem glicemia de jejum registrada.',
      severidade: 'amarelo',
      data: data.sem_gj_primeira_consulta,
    },
    {
      key: 'gtt',
      titulo: 'GTT em atraso',
      descricao: 'IG ≥ 28 semanas sem TTOG registrado.',
      severidade: 'laranja',
      data: data.atrasadas_gtt,
    },
    {
      key: 'sem_retorno',
      titulo: 'DMG confirmado sem retorno',
      descricao: 'Sem registro de atendimento há mais de 14 dias.',
      severidade: 'vermelho',
      data: data.confirmadas_sem_retorno,
    },
  ];

  const total = itens.reduce((s, i) => s + i.data.count, 0);

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Gargalos de cuidado
      </h2>
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          Nenhum gargalo identificado. A unidade está em dia com os fluxos críticos.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {itens.map(it => {
            const tem = it.data.count > 0;
            const p = PALETA[it.severidade];
            return (
              <div
                key={it.key}
                className={`rounded-xl border p-5 ${
                  tem ? `${p.border} ${p.bg}` : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      tem ? p.iconBg : 'bg-muted'
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${tem ? p.iconText : 'text-muted-foreground'}`}
                    />
                  </div>
                  <span className="font-heading text-2xl font-bold text-foreground tabular-nums">
                    {it.data.count}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-foreground">{it.titulo}</p>
                  <CardInfoTooltip text={TOOLTIPS[it.key]} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{it.descricao}</p>
                {tem && (
                  <button
                    onClick={() => navigate(`${basePath}/fichas`)}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ver pacientes <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
