import { CalendarCheck, HeartPulse, Search, Target, UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { faixasComPct, type LinhaCuidadoBloco, type LinhaCuidadoResposta } from '@/lib/linhaCuidado';
import { avaliarIndicador, type IndicadorMeta, type MetasRede } from '@/lib/metas';
import { formatarPeriodoCurto } from '@/lib/periodo';
import CardInfoTooltip from './CardInfoTooltip';
import LinhaDeCuidadoFunil from './LinhaDeCuidadoFunil';
import LinhaDeCuidadoIndicador, { VariacaoPeriodo } from './LinhaDeCuidadoIndicador';
import SeloMeta from './SeloMeta';

interface Props {
  data: LinhaCuidadoResposta | null | undefined;
  loading?: boolean;
  error?: string | null;
  /** 'unidade' = painel do gestor de unidade (e drill-down); 'rede' = consolidado do gestor geral. */
  escopo?: 'unidade' | 'rede';
  /** Metas da rede (metas_rede). Sem meta no indicador = sem selo. */
  metas?: MetasRede | null;
  /** Linha explicativa sobre as metas (ex.: "Meta definida pela gestão da rede"). */
  notaMetas?: string | null;
}

type RenderSelo = (indicador: IndicadorMeta) => React.ReactNode;

const pct = (v: number | null | undefined, locale?: string) =>
  v == null ? '—' : `${v.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;

function CaixaSecao({ titulo, tooltip, children }: { titulo: string; tooltip: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-[#1E293B]">{titulo}</h3>
        <CardInfoTooltip text={tooltip} />
      </div>
      {children}
    </div>
  );
}

function Adesao({ a, b, criterios, selo }: { a: LinhaCuidadoBloco['adesao']; b: LinhaCuidadoBloco['adesao']; criterios: LinhaCuidadoBloco['criterios']; selo: RenderSelo }) {
  const { t, i18n } = useTranslation();
  const itens = [
    {
      chave: 'completo',
      indicador: 'perfil_completo_pct' as const,
      titulo: t('gestao.linhaCuidado.completo'),
      tip: t('gestao.linhaCuidado.completoTip'),
      valor: a.perfil_completo_pct,
      anterior: b.perfil_completo_pct,
      detalhe: t('gestao.linhaCuidado.completoDetalhe', { n: a.com_perfil_completo, total: a.diagnosticadas }),
    },
    {
      chave: 'meta',
      indicador: 'ultimo_na_meta_pct' as const,
      titulo: t('gestao.linhaCuidado.meta'),
      tip: t('gestao.linhaCuidado.metaTip'),
      valor: a.ultimo_na_meta_pct,
      anterior: b.ultimo_na_meta_pct,
      detalhe: t('gestao.linhaCuidado.metaDetalhe', { n: a.ultimo_na_meta, total: a.com_perfil }),
    },
  ];
  return (
    <CaixaSecao titulo={t('gestao.linhaCuidado.adesaoTitle')} tooltip={t('gestao.linhaCuidado.adesaoTip')}>
      <div className="space-y-4">
        {itens.map((it) => (
          <div key={it.chave}>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">{it.titulo}</p>
              <CardInfoTooltip text={it.tip} />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="font-heading text-2xl font-bold text-[#1E293B]">{pct(it.valor, i18n.language)}</p>
              <p className="text-xs text-[#475569]">{it.detalhe}</p>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F1F0FB]">
              <div className="h-full rounded-full bg-[#9b87f5]" style={{ width: `${Math.min(100, it.valor ?? 0)}%` }} />
            </div>
            <div className="mt-1.5">
              <VariacaoPeriodo atual={it.valor} anterior={it.anterior} unidade="pct" sentido="bom_subir" />
            </div>
            {selo(it.indicador)}
          </div>
        ))}
      </div>
      {/* Critério provisório: limiares vêm do banco (fonte única: _linha_cuidado_calc). */}
      <p className="mt-4 border-t border-[#F1F5F9] pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t('gestao.linhaCuidado.criterio', { dias: criterios.perfil_min_dias, pct: criterios.meta_pct })}
      </p>
    </CaixaSecao>
  );
}

function Tempos({ a, b, selo }: { a: LinhaCuidadoBloco['tempos']; b: LinhaCuidadoBloco['tempos']; selo: RenderSelo }) {
  const { t, i18n } = useTranslation();
  const itens: { chave: string; valor: number | null; anterior: number | null; n: number; indicador?: IndicadorMeta }[] = [
    { chave: 'gjGtt', valor: a.gj_gtt_mediana_dias, anterior: b.gj_gtt_mediana_dias, n: a.gj_gtt_n, indicador: 'gj_gtt_mediana_dias' },
    { chave: 'diagPerfil', valor: a.diag_perfil_mediana_dias, anterior: b.diag_perfil_mediana_dias, n: a.diag_perfil_n },
    { chave: 'diagInsulina', valor: a.diag_insulina_mediana_dias, anterior: b.diag_insulina_mediana_dias, n: a.diag_insulina_n },
  ];
  return (
    <CaixaSecao titulo={t('gestao.linhaCuidado.temposTitle')} tooltip={t('gestao.linhaCuidado.temposTip')}>
      <div className="divide-y divide-[#F1F5F9]">
        {itens.map((it) => (
          <div key={it.chave} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1E293B]">{t(`gestao.linhaCuidado.${it.chave}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`gestao.linhaCuidado.${it.chave}Desc`)}</p>
              {it.indicador && selo(it.indicador)}
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="font-heading text-xl font-bold text-[#1E293B]">
                {it.valor == null
                  ? '—'
                  : t('gestao.linhaCuidado.dias', { valor: Number(it.valor).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {it.n > 0 ? t('gestao.linhaCuidado.baseN', { n: it.n }) : t('gestao.linhaCuidado.semCasos')}
              </p>
              <div className="mt-1">
                <VariacaoPeriodo atual={it.valor} anterior={it.anterior} unidade="dias" sentido="ruim_subir" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </CaixaSecao>
  );
}

function PerfilGestantes({ a, b }: { a: LinhaCuidadoBloco['perfil_gestantes']; b: LinhaCuidadoBloco['perfil_gestantes'] }) {
  const { t, i18n } = useTranslation();
  const faixas = faixasComPct(a.faixas_idade);
  return (
    <CaixaSecao titulo={t('gestao.linhaCuidado.perfilTitle')} tooltip={t('gestao.linhaCuidado.perfilTip')}>
      <p className="mb-3 text-xs text-[#475569]">{t('gestao.linhaCuidado.atendidas', { n: a.atendidas })}</p>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#64748B]">{t('gestao.linhaCuidado.idadeTitulo')}</p>
      <div className="space-y-2">
        {faixas
          .filter((f) => f.faixa !== 'sem_info' || f.n > 0)
          .map((f) => (
            <div key={f.faixa} className="flex items-center gap-3 text-xs">
              <span className="w-40 shrink-0 text-[#475569]">{t(`gestao.linhaCuidado.faixa_${f.faixa}`)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F1F0FB]">
                <div
                  className={`h-full rounded-full ${f.faixa === 'sem_info' ? 'bg-[#CBD5E1]' : 'bg-[#9b87f5]'}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-[#1E293B]">
                {f.n} <span className="text-muted-foreground">({pct(f.pct, i18n.language)})</span>
              </span>
            </div>
          ))}
      </div>
      <div className="mt-4 border-t border-[#F1F5F9] pt-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-muted-foreground">{t('gestao.linhaCuidado.dmgAnterior')}</p>
          <CardInfoTooltip text={t('gestao.linhaCuidado.dmgAnteriorTip')} />
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="font-heading text-2xl font-bold text-[#1E293B]">{pct(a.dmg_anterior_pct, i18n.language)}</p>
          <p className="text-xs text-[#475569]">
            {t('gestao.linhaCuidado.dmgAnteriorDetalhe', { n: a.dmg_anterior, total: a.atendidas })}
          </p>
        </div>
        <div className="mt-1.5">
          <VariacaoPeriodo atual={a.dmg_anterior_pct} anterior={b.dmg_anterior_pct} unidade="pct" sentido="neutro" />
        </div>
      </div>
    </CaixaSecao>
  );
}

/**
 * Seção "Linha de cuidado": funil (rastreio → diagnóstico → desfecho),
 * perda de seguimento, adesão ao perfil glicêmico, tempos e perfil das
 * gestantes — tudo no período, com comparação ao período anterior.
 */
export default function LinhaDeCuidado({ data, loading, error, escopo = 'unidade', metas, notaMetas }: Props) {
  const { t, i18n } = useTranslation();
  const a = data?.atual;
  const b = data?.anterior;
  // Selo da meta da rede (só nos indicadores com meta definida).
  const selo: RenderSelo = (indicador) => {
    if (!a || metas?.[indicador] == null) return null;
    const r = avaliarIndicador(a, indicador, metas);
    return <SeloMeta indicador={indicador} situacao={r.situacao} meta={r.meta} />;
  };

  return (
    <section className="space-y-3" data-pdf-section="linha-cuidado">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t('gestao.linhaCuidado.title')}</h2>
          <CardInfoTooltip text={t('gestao.linhaCuidado.tooltip')} />
        </div>
        {a && b && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(escopo === 'rede' ? 'gestao.linhaCuidado.subtitleRede' : 'gestao.linhaCuidado.subtitle', {
              periodo: formatarPeriodoCurto(a.periodo),
            })}{' '}
            {t('gestao.linhaCuidado.comparacao', { periodo: formatarPeriodoCurto(b.periodo) })}
          </p>
        )}
        {notaMetas && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
            <Target className="h-3.5 w-3.5 shrink-0 text-[#9b87f5]" aria-hidden />
            {notaMetas}
          </p>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : loading || !a || !b ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : a.funil.rastreadas === 0 && a.perfil_gestantes.atendidas === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {t('gestao.linhaCuidado.vazio')}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LinhaDeCuidadoIndicador
              titulo={t('gestao.linhaCuidado.rastreadas')}
              tooltip={t('gestao.linhaCuidado.rastreadasTip')}
              valor={String(a.funil.rastreadas)}
              Icon={Search}
              atual={a.funil.rastreadas}
              anterior={b.funil.rastreadas}
              unidade="contagem"
              sentido="bom_subir"
            />
            <LinhaDeCuidadoIndicador
              titulo={t('gestao.linhaCuidado.diagnosticadas')}
              tooltip={t('gestao.linhaCuidado.diagnosticadasTip')}
              valor={String(a.funil.diagnosticadas)}
              detalhe={
                a.funil.taxa_diagnostico_pct != null
                  ? t('gestao.linhaCuidado.taxaDiag', {
                      pct: a.funil.taxa_diagnostico_pct.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
                    })
                  : undefined
              }
              Icon={HeartPulse}
              atual={a.funil.diagnosticadas}
              anterior={b.funil.diagnosticadas}
              unidade="contagem"
              sentido="neutro"
            />
            <LinhaDeCuidadoIndicador
              titulo={t('gestao.linhaCuidado.perda')}
              tooltip={t('gestao.linhaCuidado.perdaTip')}
              valor={pct(a.funil.perda_seguimento_pct, i18n.language)}
              detalhe={t('gestao.linhaCuidado.perdaDetalhe', {
                n: a.funil.encerradas.nao_retornou,
                total: a.funil.diagnosticadas,
              })}
              Icon={UserMinus}
              destaque
              atual={a.funil.perda_seguimento_pct}
              anterior={b.funil.perda_seguimento_pct}
              unidade="pct"
              sentido="ruim_subir"
              rodape={selo('perda_seguimento_pct')}
            />
            <LinhaDeCuidadoIndicador
              titulo={t('gestao.linhaCuidado.antes28')}
              tooltip={t('gestao.linhaCuidado.antes28Tip')}
              valor={pct(a.tempos.diag_antes_28s_pct, i18n.language)}
              detalhe={t('gestao.linhaCuidado.antes28Detalhe', {
                n: a.tempos.diag_antes_28s,
                total: a.tempos.diag_com_ig,
              })}
              Icon={CalendarCheck}
              atual={a.tempos.diag_antes_28s_pct}
              anterior={b.tempos.diag_antes_28s_pct}
              unidade="pct"
              sentido="bom_subir"
              rodape={selo('diag_antes_28s_pct')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <LinhaDeCuidadoFunil funil={a.funil} />
            </div>
            <div className="lg:col-span-2">
              <Adesao a={a.adesao} b={b.adesao} criterios={a.criterios} selo={selo} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tempos a={a.tempos} b={b.tempos} selo={selo} />
            <PerfilGestantes a={a.perfil_gestantes} b={b.perfil_gestantes} />
          </div>
        </>
      )}
    </section>
  );
}
