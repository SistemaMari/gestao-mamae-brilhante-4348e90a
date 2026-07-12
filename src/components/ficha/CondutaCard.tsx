/**
 * 36B REV3 — Card de conduta retornado pelo motor de decisão da Ficha A (36A).
 * Exibe a conduta, doses (quando aplicável) e a próxima ficha recomendada.
 * Inclui controles de pactuação (Regra 2 e Regra 4 não-confirma) e
 * confirmação da memória do glicosímetro (Regra 4).
 */
import { FileText, Heart, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type Regra = 'regra_manter' | 'regra_2' | 'regra_3' | 'regra_4';
export type Conduta = 'manter_mev' | 'reforcar_mev' | 'insulina' | 'avaliar_memoria';
export type ProximaFicha = 'ficha_a' | 'ficha_b' | 'ficha_c' | 'ficha_d' | 'ficha_e';

export interface DecisaoBackend {
  regra_aplicada: Regra | null;
  conduta_gerada: Conduta | null;
  proxima_ficha_recomendada: ProximaFicha | null;
  dose_total: number | null;
  dose_manha: number | null;
  dose_noite: number | null;
  pendencias: string[];
}

interface Props {
  decisao: DecisaoBackend;
  pactuacao: 'aceita' | 'recusa' | null;
  memoria: 'confirma' | 'nao_confirma' | null;
  onPactuacao: (v: 'aceita' | 'recusa') => void;
  onMemoria: (v: 'confirma' | 'nao_confirma') => void;
  disabled?: boolean;
}

export default function CondutaCard({ decisao, pactuacao, memoria, onPactuacao, onMemoria, disabled }: Props) {
  const { t } = useTranslation();
  const { conduta_gerada: conduta, proxima_ficha_recomendada: proxima } = decisao;
  if (!conduta) return null;

  // 42I — insulina é terminal: proxima ∈ {ficha_b, ficha_d} encerra o
  // acompanhamento; não anunciar "próxima consulta: perfil 6 pontos".
  const insulinaTerminal = proxima === 'ficha_b' || proxima === 'ficha_d';

  // Rótulos voltados ao usuário: descrevem o PERFIL, sem expor o código interno
  // "Ficha A/B/C/D/E" (jargão de desenvolvimento, que o clínico não conhece).
  const FICHA_LABEL: Record<ProximaFicha, string> = {
    ficha_a: t('ficha.condutaCard.fichaA'),
    ficha_b: t('ficha.condutaCard.fichaB'),
    ficha_c: t('ficha.condutaCard.fichaC'),
    ficha_d: t('ficha.condutaCard.fichaD'),
    ficha_e: t('ficha.condutaCard.fichaE'),
  };

  const stylesPorConduta: Record<Conduta, { bg: string; border: string; title: string; text: string; label: string; icon: typeof Heart }> = {
    manter_mev:    { bg: '#DCFCE7', border: '#86EFAC', title: '#166534', text: '#15803D', label: t('ficha.condutaCard.condutaManterMev'), icon: Heart },
    reforcar_mev:  { bg: '#FFEDD5', border: '#FDBA74', title: '#9A3412', text: '#C2410C', label: t('ficha.condutaCard.condutaReforcarMev'), icon: AlertTriangle },
    insulina:      { bg: '#FEF3C7', border: '#FCD34D', title: '#92400E', text: '#B45309', label: t('ficha.condutaCard.condutaInsulina'), icon: AlertTriangle },
    avaliar_memoria: { bg: '#E0F2FE', border: '#7DD3FC', title: '#075985', text: '#0369A1', label: t('ficha.condutaCard.condutaAvaliarMemoria'), icon: FileText },
  };
  const s = stylesPorConduta[conduta];
  const Icon = s.icon;

  return (
    <div className="rounded-xl border-2 p-4 space-y-3" style={{ backgroundColor: s.bg, borderColor: s.border }}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: s.title }} />
        <h3 className="text-sm font-bold" style={{ color: s.title }}>{s.label}</h3>
      </div>

      {/* 42I — "Regra N" é rótulo interno do motor; não expor ao usuário final. */}

      {/* Regra 2 e Regra 4 não-confirma → pactuação */}
      {(conduta === 'reforcar_mev' || (conduta === 'avaliar_memoria' && memoria === 'nao_confirma')) && (
        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-xs font-semibold" style={{ color: s.title }}>
            {t('ficha.condutaCard.pactuacaoLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={pactuacao === 'aceita' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onPactuacao('aceita')}
              className={pactuacao === 'aceita' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              {t('ficha.condutaCard.aceitaReforcarMev')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pactuacao === 'recusa' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onPactuacao('recusa')}
              className={pactuacao === 'recusa' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              {t('ficha.condutaCard.recusaIniciarInsulina')}
            </Button>
          </div>
        </div>
      )}

      {/* Regra 4 → memória */}
      {conduta === 'avaliar_memoria' && (
        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-xs font-semibold" style={{ color: s.title }}>
            {t('ficha.condutaCard.memoriaPergunta')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={memoria === 'confirma' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onMemoria('confirma')}
              className={memoria === 'confirma' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              {t('ficha.condutaCard.memoriaConfirma')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={memoria === 'nao_confirma' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onMemoria('nao_confirma')}
              className={memoria === 'nao_confirma' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              {t('ficha.condutaCard.memoriaNaoConfirma')}
            </Button>
          </div>
        </div>
      )}

      {/* Doses (quando aplicável) */}
      {decisao.dose_total != null && (
        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-xs font-semibold" style={{ color: s.title }}>{t('ficha.condutaCard.doseInicialLabel')}</p>
          <p className="font-heading text-2xl font-bold leading-none" style={{ color: s.title }}>
            {decisao.dose_total} <span className="text-sm font-medium opacity-80">{t('ficha.condutaCard.uiPerDay')}</span>
          </p>
          {decisao.dose_manha != null && decisao.dose_noite != null && (
            <p className="text-xs" style={{ color: s.text }}>
              {t('ficha.condutaCard.doseBreakdown', { manha: decisao.dose_manha, noite: decisao.dose_noite })}
            </p>
          )}
        </div>
      )}

      {/* Próxima ficha — ou encerramento quando a conduta é insulina (terminal) */}
      {insulinaTerminal ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: s.text }}>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{t('ficha.condutaCard.acompanhamentoEncerrado')}</span>
        </div>
      ) : (
        proxima && (
          <div className="flex items-center gap-2 text-xs" style={{ color: s.text }}>
            <ArrowRight className="h-3.5 w-3.5" />
            <span>{t('ficha.condutaCard.proximaConsulta')} <strong>{FICHA_LABEL[proxima]}</strong></span>
          </div>
        )
      )}

      {/* Pendências */}
      {decisao.pendencias.length > 0 && (
        <p className="text-xs italic" style={{ color: s.text }}>
          {t('ficha.condutaCard.pendente', { lista: decisao.pendencias.join(', ') })}
        </p>
      )}
    </div>
  );
}
