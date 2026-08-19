/**
 * V4 — Versão read-only do card "Exames de crescimento e vitalidade fetal", para
 * REGISTRAR no laudo os resultados que a gestante trouxe. Mostra apenas os campos
 * respondidos (valor != null / != "sem dados"). Espelha os rótulos do card editável
 * via EXAMES_FETAIS_DEFS. Renderiza nada quando nenhum campo foi preenchido.
 */
import { useTranslation } from 'react-i18next';
import { EXAMES_FETAIS_DEFS, type ExamesFetaisState, type ExameFetalCampo } from './examesFetaisItems';
import { janelaDaIg } from '@/lib/janelaCrescimentoFetal';

export default function ExamesFetaisReadOnly(
  { value, igSemanas }: { value: ExamesFetaisState; igSemanas?: number | null },
) {
  const { t } = useTranslation();
  const janela = janelaDaIg(igSemanas);

  const respondidos = EXAMES_FETAIS_DEFS
    .map((d) => {
      const atual = value[d.key];
      if (atual == null) return null;
      const op = d.opcoes.find((o) => o.value === atual);
      return { key: d.key, grupo: d.grupo, crescimento: !!d.exameCrescimento, label: t(d.labelKey), valor: op ? t(op.labelKey) : String(atual) };
    })
    .filter((x): x is { key: ExameFetalCampo; grupo: 'usg' | 'vigilancia'; crescimento: boolean; label: string; valor: string } => x != null);


  if (respondidos.length === 0) return null;

  const usg = respondidos.filter((r) => r.grupo === 'usg');
  const vig = respondidos.filter((r) => r.grupo === 'vigilancia');

  const linha = (r: { key: string; label: string; valor: string }) => (
    <div key={r.key} className="flex items-center justify-between gap-3">
      <span className="text-xs text-foreground">{r.label}</span>
      <span className="text-xs font-medium text-[#5B21B6]">{r.valor}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-3">
      <h3 className="text-sm font-bold text-[#5B21B6]">{t('ficha.examesFetais.title')}</h3>
      {usg.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.examesFetais.grupoUsg')}</p>
          {/* Diz de QUAL dos dois ultrassons de crescimento vêm estes parâmetros —
              sem isso o mesmo resultado, repetido nas consultas da janela, parece
              exame novo a cada laudo. */}
          {janela && usg.some((r) => r.crescimento) && (
            <p className="text-[11px] italic text-[#7E69AB]">
              {t(janela === 'j2832'
                ? 'ficha.checklistRetorno2.janela2832'
                : 'ficha.checklistRetorno2.janela36')}
            </p>
          )}
          {usg.map(linha)}
        </div>
      )}
      {vig.length > 0 && (
        <div className="space-y-2 border-t border-[#E5E0F2] pt-3">
          <p className="text-xs font-semibold text-[#7E69AB]">{t('ficha.examesFetais.grupoVigilancia')}</p>
          {vig.map(linha)}
        </div>
      )}
    </div>
  );
}
