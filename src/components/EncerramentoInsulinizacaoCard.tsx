import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatDateBR } from '@/lib/dateUtils';
import { MOTIVO_ENCERRAMENTO_LABEL, type MotivoEncerramento } from '@/lib/motivoEncerramento';

/**
 * PROMPT 42B / 42E — Card ÚNICO de encerramento do acompanhamento.
 *
 * 42B: nasceu como o card de insulinização (Hipótese 3, ≤30 semanas).
 * 42E: estendido para ser o card único por MOTIVO — absorve o antigo
 * EncerramentoPartoCard (cuja copy estava incorreta) e cobre os motivos
 * manuais (parto, aborto, não retornou, outro).
 *
 * A visibilidade passou a ser decidida por `motivo_encerramento` (fonte de
 * verdade), resolvido no parent (ponte status_ficha → motivo). O bloco de
 * reteste puerperal é passado já computado (`reteste`) pelo parent, que detém
 * o predicado de DMG-confirmado e a âncora por motivo — o card apenas exibe.
 */

export interface RetesteInfo {
  /** Início da janela, já formatado dd/MM/yyyy. */
  inicioBR: string;
  /** Fim da janela, já formatado dd/MM/yyyy. */
  fimBR: string;
  /** Origem da âncora, ex.: "a partir da data do parto" / "a partir da DPP estimada". */
  origemLabel: string;
}

interface Props {
  motivo: MotivoEncerramento;
  /** ISO 'YYYY-MM-DD' do evento (parto/aborto). */
  data?: string | null;
  /** Texto livre (motivo "outro"). */
  obs?: string | null;
  /** Bloco de reteste puerperal já computado no parent; ausente = não exibir. */
  reteste?: RetesteInfo | null;
  /**
   * Conclusão clínica editável (do painel admin / `laudo_textos`), por motivo
   * (parto/aborto/nao_retornou). Quando presente, substitui o texto padrão.
   * "Outro" e insulinização não recebem — mantêm o texto próprio.
   */
  conclusaoTexto?: string | null;
}

/** Corpo específico por motivo (insulinização tem card próprio, ver abaixo). */
function corpoPorMotivo(
  t: TFunction,
  motivo: MotivoEncerramento,
  data?: string | null,
  obs?: string | null,
): string {
  const dataBR = formatDateBR(data);
  switch (motivo) {
    case 'parto':
      return t('encerramentoInsulinizacao.corpo.parto', { data: dataBR });
    case 'aborto':
      return t('encerramentoInsulinizacao.corpo.aborto', { data: dataBR });
    case 'nao_retornou':
      return t('encerramentoInsulinizacao.corpo.naoRetornou');
    case 'outro':
      return obs
        ? t('encerramentoInsulinizacao.corpo.outroComObs', { obs })
        : t('encerramentoInsulinizacao.corpo.outro');
    default:
      return t('encerramentoInsulinizacao.corpo.default');
  }
}

export default function EncerramentoInsulinizacaoCard({ motivo, data, obs, reteste, conclusaoTexto }: Props) {
  const { t } = useTranslation();
  const isInsulinizacao = motivo === 'insulinizacao';

  return (
    <div
      className="rounded-xl border-2 p-5 space-y-4"
      style={{ backgroundColor: '#F1F0FB', borderColor: '#D6BCFA' }}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: '#7C3AED' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: '#5B21B6' }}>
            {isInsulinizacao
              ? t('encerramentoInsulinizacao.titleInsulinizacao')
              : t('encerramentoInsulinizacao.titleMotivo', { motivo: MOTIVO_ENCERRAMENTO_LABEL[motivo] })}
          </h2>
          {isInsulinizacao ? (
            <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
              {t('encerramentoInsulinizacao.insulinizacaoBody')}
            </p>
          ) : (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: '#6D28D9' }}>
                {conclusaoTexto ?? corpoPorMotivo(t, motivo, data, obs)}
              </p>
              <p className="mt-2 text-xs" style={{ color: '#6D28D9' }}>
                {t('encerramentoInsulinizacao.historicoDisponivel')}
              </p>
            </>
          )}
        </div>
      </div>

      {isInsulinizacao && (
        <div
          className="flex items-start gap-3 rounded-lg border p-3"
          style={{ backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' }}
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#4338CA' }} />
          <p className="text-sm" style={{ color: '#3730A3' }}>
            <Trans i18nKey="encerramentoInsulinizacao.continuidadeClinica" components={{ strong: <strong /> }} />
          </p>
        </div>
      )}

      {reteste && (
        // Reteste puerperal — conduta acionável, em amarelo-ovo (só com DMG confirmado).
        <div
          className="flex items-start gap-3 rounded-lg border p-3"
          style={{ backgroundColor: '#FEF9C3', borderColor: '#FACC15' }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#CA8A04' }} />
          <p className="text-sm" style={{ color: '#713F12' }}>
            <Trans
              i18nKey="encerramentoInsulinizacao.retestePuerperal"
              components={{ strong: <strong /> }}
              values={{ inicio: reteste.inicioBR, fim: reteste.fimBR, origem: reteste.origemLabel }}
            />
          </p>
        </div>
      )}
    </div>
  );
}
