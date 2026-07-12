import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  fichas: { profissional_id: string; profissional_nome: string }[];
}

export default function PacientesPorProfissional({ fichas }: Props) {
  const { t } = useTranslation();
  const counts = useMemo(() => {
    const map = new Map<string, { nome: string; count: number }>();
    fichas.forEach(f => {
      const cur = map.get(f.profissional_id);
      if (cur) cur.count += 1;
      else map.set(f.profissional_id, { nome: f.profissional_nome, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [fichas]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">{t('gestao.pacientesPorProfissional.title')}</h2>
      {counts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('gestao.pacientesPorProfissional.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('management.professional')}</TableHead>
                <TableHead className="text-right">{t('nav.patients')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map(c => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
