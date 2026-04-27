import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  inicio: Date | null;
  fim: Date | null;
  onChange: (inicio: Date | null, fim: Date | null) => void;
}

const PRESETS = [
  { label: '7 dias', dias: 7 },
  { label: '30 dias', dias: 30 },
  { label: '90 dias', dias: 90 },
  { label: '12 meses', dias: 365 },
];

export default function FiltroPeriodoGlobal({ inicio, fim, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const aplicarPreset = (dias: number) => {
    const fimD = new Date();
    const inicioD = new Date(Date.now() - dias * 86400000);
    onChange(inicioD, fimD);
  };

  const limpar = () => onChange(null, null);

  const label = inicio && fim
    ? `${format(inicio, 'dd/MM/yyyy', { locale: ptBR })} – ${format(fim, 'dd/MM/yyyy', { locale: ptBR })}`
    : 'Todo o período';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <Button key={p.dias} size="sm" variant="outline" onClick={() => aplicarPreset(p.dias)}>
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className={cn('justify-start', !inicio && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={inicio && fim ? { from: inicio, to: fim } : undefined}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange(range.from, range.to);
                setOpen(false);
              } else if (range?.from) {
                onChange(range.from, null);
              }
            }}
            numberOfMonths={2}
            className={cn('p-3 pointer-events-auto')}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      {inicio && (
        <Button size="sm" variant="ghost" onClick={limpar}>
          Limpar
        </Button>
      )}
    </div>
  );
}
