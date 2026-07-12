import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface Props {
  notas?: string[];
}

export const getNotasPadrao = (): string[] => [
  i18n.t('laudo.notasTecnicas.nota1'),
  i18n.t('laudo.notasTecnicas.nota2'),
  i18n.t('laudo.notasTecnicas.nota3'),
  i18n.t('laudo.notasTecnicas.nota4'),
];

export default function NotasTecnicasCard({ notas }: Props) {
  const { t } = useTranslation();
  const items = notas ?? getNotasPadrao();
  return (
    <section className="laudo-notas rounded-xl border border-border bg-[#F1F5F9] p-4">
      <p className="mb-1.5 text-xs font-semibold text-foreground">{t('laudo.notasTecnicas.title')}</p>
      <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
        {items.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
