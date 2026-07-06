import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
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
}

/** Corpo específico por motivo (insulinização tem card próprio, ver abaixo). */
function corpoPorMotivo(motivo: MotivoEncerramento, data?: string | null, obs?: string | null): string {
  const dataBR = formatDateBR(data);
  switch (motivo) {
    case 'parto':
      return `Acompanhamento encerrado — parto em ${dataBR}.`;
    case 'aborto':
      return `Acompanhamento encerrado — registro de aborto em ${dataBR}.`;
    case 'nao_retornou':
      return 'Acompanhamento encerrado — paciente não retornou.';
    case 'outro':
      return `Acompanhamento encerrado.${obs ? ` ${obs}` : ''}`;
    default:
      return 'Acompanhamento encerrado.';
  }
}

export default function EncerramentoInsulinizacaoCard({ motivo, data, obs, reteste }: Props) {
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
              ? 'Acompanhamento da MARI encerrado por insulinização'
              : `Acompanhamento da MARI encerrado — ${MOTIVO_ENCERRAMENTO_LABEL[motivo]}`}
          </h2>
          {isInsulinizacao ? (
            <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
              A introdução de insulina foi indicada e o laudo correspondente foi
              emitido com a conduta e os três arranjos de continuidade (obstetra
              conduzindo, associação com endocrinologista ou referência para
              serviço especializado). O acompanhamento ativo dentro da MARI se
              encerra neste ponto — toda a história clínica, laudos e perfis
              glicêmicos permanecem disponíveis para consulta nesta ficha.
            </p>
          ) : (
            <p className="mt-2 text-sm" style={{ color: '#6D28D9' }}>
              {corpoPorMotivo(motivo, data, obs)} Toda a história clínica, laudos e
              perfis glicêmicos permanecem disponíveis para consulta nesta ficha.
            </p>
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
            <strong>Continuidade clínica:</strong> siga os arranjos descritos no
            laudo de insulinização. A MARI não emitirá novos retornos automáticos
            para esta paciente.
          </p>
        </div>
      )}

      {reteste && (
        // Reteste puerperal — conduta acionável, em âmbar (só com DMG confirmado).
        <div
          className="flex items-start gap-3 rounded-lg border p-3"
          style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#B45309' }} />
          <p className="text-sm" style={{ color: '#92400E' }}>
            <strong>Reteste puerperal:</strong> realizar GTT 75g (jejum + 2h) entre{' '}
            <strong>{reteste.inicioBR}</strong> e <strong>{reteste.fimBR}</strong>{' '}
            ({reteste.origemLabel}).
          </p>
        </div>
      )}
    </div>
  );
}
