/**
 * V4 — Card de registro dos resultados de exames de crescimento e vitalidade fetal.
 * Abre em todas as fichas de retorno; cada campo é opcional (null = "sem dados").
 * O frontend NÃO decide conduta aqui — apenas coleta os resultados e exibe um
 * ALERTA visual quando há achado da Família 2 (vitalidade/morfologia). O texto do
 * alerta é placeholder até ratificação clínica das especialistas.
 *
 * `hidePfeCaLa`: na Ficha A/C, PFE/CA/LA já são coletados no checklist do Retorno 2
 * (que dirige a insulina — regra_fetal); ali este card os oculta para não duplicar.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defsVisiveisNaIg, alertasFamilia2, type ExamesFetaisState, type DefExameFetal } from './examesFetaisItems';
import { janelaDaIg, type RespostaVigenteCrescimento } from '@/lib/janelaCrescimentoFetal';
import { formatDateBR } from '@/lib/dateUtils';

interface Props {
  value: ExamesFetaisState;
  onChange: (next: ExamesFetaisState) => void;
  hidePfeCaLa?: boolean;
  /** IG (semanas) na consulta — oculta campos com igMinima ainda não atingida
   *  (CMF a partir de 28 sem; CTG/PBF a partir de 32 sem). */
  igSemanas?: number | null;
  /** Exames de uma vez só (ex.: morfológico) já registrados em consulta anterior
   *  desta paciente — o card não pergunta de novo. */
  jaRegistrados?: string[];
  /** Resultado do ultrassom de crescimento JÁ lido nesta janela (28–32 ou 36ª).
   *  Presente → os campos desse exame aparecem fechados, sem repergunta. */
  respostaVigente?: RespostaVigenteCrescimento | null;
  disabled?: boolean;
}

function Pill({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-[#7C4DBA] text-white border-[#7C4DBA]'
          : 'bg-white text-[#5B21B6] border-[#D6BCFA] hover:bg-[#F1F0FB]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export default function ExamesFetaisCard({ value, onChange, hidePfeCaLa, igSemanas, jaRegistrados, respostaVigente, disabled }: Props) {
  const { t } = useTranslation();
  const set = <K extends keyof ExamesFetaisState>(k: K, v: ExamesFetaisState[K]) => onChange({ ...value, [k]: v });

  const visiveis = defsVisiveisNaIg(igSemanas)
    .filter((d) => !(hidePfeCaLa && d.ocultaNaFichaAC))
    // exame de uma vez já registrado antes → não repergunta
    .filter((d) => !(d.umaVez && jaRegistrados?.includes(d.key)));
  const usg = visiveis.filter((d) => d.grupo === 'usg');
  const usgCrescimento = usg.filter((d) => d.exameCrescimento);
  const usgOutros = usg.filter((d) => !d.exameCrescimento);
  const vigilancia = visiveis.filter((d) => d.grupo === 'vigilancia');
  const alertas = alertasFamilia2(value);
  // Resultado do ultrassom de crescimento desta janela já lido em outra consulta.
  // O botão de corrigir existe porque a UI só edita a consulta MAIS RECENTE: sem
  // ele, um registro errado ficaria preso até a janela seguinte.
  const [corrigindo, setCorrigindo] = useState(false);
  const travado = !!respostaVigente && !corrigindo;
  const janela = respostaVigente?.janela ?? janelaDaIg(igSemanas);

  const renderLinha = (d: DefExameFetal) => {
    const atual = value[d.key];
    return (
      <div key={d.key} className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-foreground">{t(d.labelKey)}</span>
        <div className="flex flex-wrap gap-2">
          {d.opcoes.map((op) => (
            <Pill key={op.value} disabled={disabled} active={atual === op.value} onClick={() => set(d.key, op.value as ExamesFetaisState[typeof d.key])}>
              {t(op.labelKey)}
            </Pill>
          ))}
          {/* "Sem dados" = null (IG ainda não permite ou exame não trazido) */}
          <Pill disabled={disabled} active={atual == null} onClick={() => set(d.key, null)}>
            {t('ficha.examesFetais.semDados')}
          </Pill>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[#5B21B6]">{t('ficha.examesFetais.title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('ficha.examesFetais.tooltip')}</p>
      </div>

      {usg.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.examesFetais.grupoUsg')}</p>
          {usgOutros.map(renderLinha)}

          {/* Campos lidos do ULTRASSOM DE CRESCIMENTO: pertencem ao exame, não à
              consulta. Já lido nesta janela → exibe fechado; janela nova (36ª) →
              volta a perguntar, com a legenda avisando que são parâmetros novos. */}
          {usgCrescimento.length > 0 && (
            <div className="space-y-3">
              {janela && (
                <p className="text-[11px] italic text-[#7E69AB]">
                  {t(janela === 'j2832'
                    ? 'ficha.checklistRetorno2.janela2832'
                    : 'ficha.checklistRetorno2.janela36')}
                </p>
              )}
              {travado ? (
                <div className="rounded-lg border border-[#D6BCFA] bg-white/70 p-3 space-y-2">
                  <p className="text-xs text-[#5B21B6]">
                    {t('ficha.checklistRetorno2.jaRespondido', {
                      data: formatDateBR(respostaVigente!.data),
                      ig: respostaVigente!.igSemanas ?? '—',
                    })}
                  </p>
                  {usgCrescimento.map((d) => {
                    const v = (respostaVigente!.valores as Record<string, string | null | undefined>)[d.key] ?? null;
                    const op = d.opcoes.find((o) => o.value === v);
                    return (
                      <div key={d.key} className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-foreground">{t(d.labelKey)}</span>
                        <span className="text-xs font-semibold text-[#5B21B6]">
                          {op ? t(op.labelKey) : t('ficha.examesFetais.semDados')}
                        </span>
                      </div>
                    );
                  })}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => setCorrigindo(true)}
                      className="text-[11px] underline text-[#7E69AB] hover:text-[#5B21B6]"
                    >
                      {t('ficha.checklistRetorno2.corrigirExame')}
                    </button>
                  )}
                </div>
              ) : (
                usgCrescimento.map(renderLinha)
              )}
            </div>
          )}
        </div>
      )}

      {vigilancia.length > 0 && (
        <div className="space-y-3 border-t border-[#E5E0F2] pt-3">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.examesFetais.grupoVigilancia')}</p>
          {vigilancia.map(renderLinha)}
        </div>
      )}

      {alertas.length > 0 && (
        <div className="rounded-lg border-2 p-3 space-y-1" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: '#92400E' }} />
            <span className="text-xs font-bold" style={{ color: '#92400E' }}>{t('ficha.examesFetais.alertaTitulo')}</span>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {alertas.map((a) => (
              <li key={a.key} className="text-xs" style={{ color: '#B45309' }}>{t(a.alertaKey)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
