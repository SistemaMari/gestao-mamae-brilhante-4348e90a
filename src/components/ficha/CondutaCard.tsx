/**
 * 36B REV3 — Card de conduta retornado pelo motor de decisão da Ficha A (36A).
 * Exibe a conduta, doses (quando aplicável) e a próxima ficha recomendada.
 * Inclui controles de pactuação (Regra 2 e Regra 4 não-confirma) e
 * confirmação da memória do glicosímetro (Regra 4).
 */
import { FileText, Heart, AlertTriangle, ArrowRight } from 'lucide-react';
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

// Rótulos voltados ao usuário: descrevem o PERFIL, sem expor o código interno
// "Ficha A/B/C/D/E" (jargão de dev). Sem a IG (até/após 30 sem) — a paciente pode
// precisar de insulina antes das 30 semanas, então afirmar a janela ali engana.
const FICHA_LABEL: Record<ProximaFicha, string> = {
  ficha_a: 'Perfil de 4 pontos',
  ficha_b: 'Perfil de 6 pontos com insulina',
  ficha_c: 'Perfil de 4 pontos',
  ficha_d: 'Perfil de 6 pontos com insulina',
  ficha_e: 'Perfil de 6 pontos sem insulina',
};

interface Props {
  decisao: DecisaoBackend;
  pactuacao: 'aceita' | 'recusa' | null;
  memoria: 'confirma' | 'nao_confirma' | null;
  onPactuacao: (v: 'aceita' | 'recusa') => void;
  onMemoria: (v: 'confirma' | 'nao_confirma') => void;
  disabled?: boolean;
}

export default function CondutaCard({ decisao, pactuacao, memoria, onPactuacao, onMemoria, disabled }: Props) {
  const { conduta_gerada: conduta, regra_aplicada: regra, proxima_ficha_recomendada: proxima } = decisao;
  if (!conduta) return null;

  const stylesPorConduta: Record<Conduta, { bg: string; border: string; title: string; text: string; label: string; icon: typeof Heart }> = {
    manter_mev:    { bg: '#DCFCE7', border: '#86EFAC', title: '#166534', text: '#15803D', label: 'MANTER MEV (15 dias)', icon: Heart },
    reforcar_mev:  { bg: '#FFEDD5', border: '#FDBA74', title: '#9A3412', text: '#C2410C', label: 'REFORÇAR MEV — pactuar com a paciente', icon: AlertTriangle },
    insulina:      { bg: '#FEF3C7', border: '#FCD34D', title: '#92400E', text: '#B45309', label: 'INICIAR INSULINA', icon: AlertTriangle },
    avaliar_memoria: { bg: '#E0F2FE', border: '#7DD3FC', title: '#075985', text: '#0369A1', label: 'AVALIAR MEMÓRIA DO GLICOSÍMETRO', icon: FileText },
  };
  const s = stylesPorConduta[conduta];
  const Icon = s.icon;

  return (
    <div className="rounded-xl border-2 p-4 space-y-3" style={{ backgroundColor: s.bg, borderColor: s.border }}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: s.title }} />
        <h3 className="text-sm font-bold" style={{ color: s.title }}>{s.label}</h3>
      </div>

      {regra && (
        <p className="text-xs" style={{ color: s.text }}>
          Regra aplicada: <span className="font-semibold">{regra.replace('_', ' ').replace('regra ', 'Regra ')}</span>
        </p>
      )}

      {/* Regra 2 e Regra 4 não-confirma → pactuação */}
      {(conduta === 'reforcar_mev' || (conduta === 'avaliar_memoria' && memoria === 'nao_confirma')) && (
        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-xs font-semibold" style={{ color: s.title }}>
            Pactuação com a paciente:
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
              Aceita reforçar MEV (novo teste em 7-10 dias)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={pactuacao === 'recusa' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onPactuacao('recusa')}
              className={pactuacao === 'recusa' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              Recusa — iniciar insulina
            </Button>
          </div>
        </div>
      )}

      {/* Regra 4 → memória */}
      {conduta === 'avaliar_memoria' && (
        <div className="rounded-lg bg-white/70 p-3 space-y-2">
          <p className="text-xs font-semibold" style={{ color: s.title }}>
            Memória do glicosímetro confere com os valores anotados?
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
              Confirma → ampliar para 6 pontos sem insulina
            </Button>
            <Button
              type="button"
              size="sm"
              variant={memoria === 'nao_confirma' ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onMemoria('nao_confirma')}
              className={memoria === 'nao_confirma' ? 'bg-[#7C4DBA] hover:bg-[#7E69AB] text-white' : ''}
            >
              Não confirma → conversa estruturada + pactuação
            </Button>
          </div>
        </div>
      )}

      {/* Doses (quando aplicável) */}
      {decisao.dose_total != null && (
        <div className="rounded-lg bg-white/70 p-3">
          <p className="text-xs font-semibold" style={{ color: s.title }}>Dose inicial de insulina NPH</p>
          <p className="font-heading text-2xl font-bold leading-none" style={{ color: s.title }}>
            {decisao.dose_total} <span className="text-sm font-medium opacity-80">UI/dia</span>
          </p>
          {decisao.dose_manha != null && decisao.dose_noite != null && (
            <p className="text-xs" style={{ color: s.text }}>
              {decisao.dose_manha} UI manhã + {decisao.dose_noite} UI às 22h • fórmula: 0,5 UI/kg/dia
            </p>
          )}
        </div>
      )}

      {/* Próxima ficha */}
      {proxima && (
        <div className="flex items-center gap-2 text-xs" style={{ color: s.text }}>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>Próxima consulta: <strong>{FICHA_LABEL[proxima]}</strong></span>
        </div>
      )}

      {/* Pendências */}
      {decisao.pendencias.length > 0 && (
        <p className="text-xs italic" style={{ color: s.text }}>
          Pendente: {decisao.pendencias.join(', ')}
        </p>
      )}
    </div>
  );
}
