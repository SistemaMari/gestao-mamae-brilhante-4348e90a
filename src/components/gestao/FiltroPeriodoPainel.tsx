import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseDateLocal } from '@/lib/dateUtils';
import { calcularPeriodo, type PresetPeriodo } from '@/lib/periodo';

export interface FiltroPeriodoValor {
  preset: PresetPeriodo;
  inicio: string; // YYYY-MM-DD
  fim: string;
}

interface Props {
  value: FiltroPeriodoValor;
  onChange: (v: FiltroPeriodoValor) => void;
}

/**
 * Filtro de período do painel da unidade — mesmos presets do gestor geral
 * (FiltrosGlobais), mas controlado por props (sem o contexto do gestor geral).
 */
export default function FiltroPeriodoPainel({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState<DateRange | undefined>(
    value.preset === 'custom'
      ? { from: parseDateLocal(value.inicio) ?? undefined, to: parseDateLocal(value.fim) ?? undefined }
      : undefined,
  );
  const [presetLocal, setPresetLocal] = useState<PresetPeriodo>(value.preset);

  const onPreset = (p: PresetPeriodo) => {
    setPresetLocal(p);
    if (p !== 'custom') onChange({ preset: p, ...calcularPeriodo(p) });
  };

  const onRange = (r: DateRange | undefined) => {
    setCustom(r);
    if (r?.from && r?.to) onChange({ preset: 'custom', ...calcularPeriodo('custom', { from: r.from, to: r.to }) });
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        <div className="w-full md:w-56">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('gestao.filtroPeriodo.label')}
          </label>
          <Select value={presetLocal} onValueChange={(v) => onPreset(v as PresetPeriodo)}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('gestorGeral.filtrosGlobais.preset7d')}</SelectItem>
              <SelectItem value="30d">{t('gestorGeral.filtrosGlobais.preset30d')}</SelectItem>
              <SelectItem value="90d">{t('gestorGeral.filtrosGlobais.preset90d')}</SelectItem>
              <SelectItem value="12m">{t('gestorGeral.filtrosGlobais.preset12m')}</SelectItem>
              <SelectItem value="ano">{t('gestorGeral.filtrosGlobais.presetAno')}</SelectItem>
              <SelectItem value="custom">{t('gestorGeral.filtrosGlobais.presetCustom')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {presetLocal === 'custom' && (
          <div className="w-full md:w-72">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('gestao.filtroPeriodo.intervalo')}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start bg-white">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {custom?.from && custom?.to
                    ? `${format(custom.from, 'dd/MM/yy')} – ${format(custom.to, 'dd/MM/yy')}`
                    : t('gestao.filtroPeriodo.selecione')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={custom} onSelect={onRange} numberOfMonths={2} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <p className="text-xs text-muted-foreground md:flex-1 md:pb-2">{t('gestao.filtroPeriodo.ajuda')}</p>
      </div>
    </div>
  );
}
