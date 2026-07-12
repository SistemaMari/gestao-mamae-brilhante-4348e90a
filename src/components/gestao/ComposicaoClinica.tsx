import { Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CardInfoTooltip from './CardInfoTooltip';

export interface ProfissionalEquipe {
  id: string;
  nome: string;
  especialidade: string | null;
  perfil_clinico?: string | null;
}

type Categoria = 'gineco' | 'endo' | 'enfermeira' | 'nutri' | 'outros';

function classificar(p: ProfissionalEquipe): Categoria {
  const esp = (p.especialidade || '').toLowerCase();
  const pc = (p.perfil_clinico || '').toLowerCase();
  if (/ginec|obstetr/.test(esp)) return 'gineco';
  if (/endocrin/.test(esp)) return 'endo';
  if (pc === 'enfermeira' || /enferm/.test(esp)) return 'enfermeira';
  if (pc === 'nutricionista' || /nutri/.test(esp)) return 'nutri';
  return 'outros';
}

const LABEL_KEYS: Record<Categoria, string> = {
  gineco: 'gestao.composicaoClinica.gineco',
  endo: 'gestao.composicaoClinica.endo',
  enfermeira: 'gestao.composicaoClinica.enfermeira',
  nutri: 'gestao.composicaoClinica.nutri',
  outros: 'gestao.composicaoClinica.outros',
};

const ORDEM: Categoria[] = ['gineco', 'endo', 'enfermeira', 'nutri', 'outros'];

interface Props {
  profissionais: ProfissionalEquipe[];
  loading?: boolean;
  erro?: boolean;
}

export default function ComposicaoClinica({ profissionais, loading, erro }: Props) {
  const { t } = useTranslation();
  const counts: Record<Categoria, number> = {
    gineco: 0, endo: 0, enfermeira: 0, nutri: 0, outros: 0,
  };
  profissionais.forEach(p => { counts[classificar(p)] += 1; });
  const max = Math.max(...ORDEM.map(c => counts[c]), 1);
  const semEndo = counts.endo === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('gestao.composicaoClinica.title')}
        </h2>
        <CardInfoTooltip text={t('gestao.composicaoClinica.tooltip')} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {ORDEM.map(c => (
            <div key={c} className="h-5 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : erro ? (
        <p className="text-sm text-muted-foreground">{t('gestao.composicaoClinica.erro')}</p>
      ) : (
        <>
          <div className="space-y-3">
            {ORDEM.map(cat => {
              const v = counts[cat];
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-[180px] shrink-0 text-sm text-foreground">
                    {t(LABEL_KEYS[cat])}
                  </span>
                  <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: '#7F77DD' }}
                    />
                  </div>
                  <span
                    className="w-6 shrink-0 text-right text-base tabular-nums"
                    style={{ fontWeight: 500 }}
                  >
                    {v}
                  </span>
                </div>
              );
            })}
          </div>
          {semEndo && (
            <div
              className="mt-4 rounded-r-md text-sm"
              style={{
                backgroundColor: '#FAEEDA',
                borderLeft: '3px solid #BA7517',
                color: '#633806',
                padding: '10px 12px',
              }}
            >
              ⚠️ {t('gestao.composicaoClinica.semEndoAviso')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
