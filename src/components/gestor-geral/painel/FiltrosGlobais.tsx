import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseDateLocal } from "@/lib/dateUtils";
import {
  calcularPeriodo,
  useFiltrosGestorGeral,
  type FiltrosState,
  type PresetPeriodo,
} from "@/contexts/FiltrosGestorGeralContext";

const DEBOUNCE_MS = 500;

export default function FiltrosGlobais() {
  const { t } = useTranslation();
  const { unidades, filtros, setFiltros } = useFiltrosGestorGeral();

  const [draft, setDraft] = useState<FiltrosState>(filtros);
  const [custom, setCustom] = useState<DateRange | undefined>(
    filtros.preset === "custom"
      ? { from: parseDateLocal(filtros.dataInicio) ?? undefined, to: parseDateLocal(filtros.dataFim) ?? undefined }
      : undefined,
  );
  const [openUnidades, setOpenUnidades] = useState(false);

  // Sync se mudar de fora
  useEffect(() => {
    setDraft(filtros);
  }, [filtros]);

  const todasIds = useMemo(() => unidades.map((u) => u.id), [unidades]);
  const sel = draft.unidadesSelecionadas; // null | string[]
  const todasSelecionadas = sel === null;
  const numSelecionadas = sel === null ? todasIds.length : sel.length;

  const labelUnidades = todasSelecionadas
    ? t('gestorGeral.filtrosGlobais.todasUnidades', { count: todasIds.length })
    : numSelecionadas === 0
      ? t('gestorGeral.filtrosGlobais.nenhumaSelecionada')
      : t('gestorGeral.filtrosGlobais.parcialSelecionadas', { sel: numSelecionadas, total: todasIds.length });

  const toggleSelecionarTodas = () => {
    // Toggle: se todas marcadas → desmarca tudo (=> []). Senão (incluindo []) → marca todas (=> null).
    setDraft({
      ...draft,
      unidadesSelecionadas: todasSelecionadas ? [] : null,
    });
  };

  const toggleUnidade = (id: string) => {
    const baseSet = new Set<string>(sel === null ? todasIds : sel);
    if (baseSet.has(id)) baseSet.delete(id);
    else baseSet.add(id);
    const arr = Array.from(baseSet);
    // Se ficou igual a todas → volta pro default null (= todas)
    if (arr.length === todasIds.length) {
      setDraft({ ...draft, unidadesSelecionadas: null });
    } else {
      setDraft({ ...draft, unidadesSelecionadas: arr });
    }
  };

  const onPresetChange = (v: PresetPeriodo) => {
    if (v !== "custom") {
      const p = calcularPeriodo(v);
      setDraft({ ...draft, preset: v, dataInicio: p.inicio, dataFim: p.fim });
    } else {
      setDraft({ ...draft, preset: v });
    }
  };

  // Custom range -> atualiza datas no draft
  useEffect(() => {
    if (draft.preset !== "custom") return;
    if (custom?.from && custom?.to) {
      const p = calcularPeriodo("custom", { from: custom.from, to: custom.to });
      setDraft((d) => ({ ...d, dataInicio: p.inicio, dataFim: p.fim }));
    }
  }, [custom, draft.preset]);

  // Debounce: aplica draft para o context
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    // Skip se igual
    if (
      draft.preset === filtros.preset &&
      draft.dataInicio === filtros.dataInicio &&
      draft.dataFim === filtros.dataFim &&
      JSON.stringify(draft.unidadesSelecionadas) ===
        JSON.stringify(filtros.unidadesSelecionadas)
    ) {
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setFiltros(draft);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [draft, filtros, setFiltros]);

  const chipsList = sel === null ? [] : sel;

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        {/* Unidades */}
        <div className="flex-1 min-w-0">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('gestorGeral.filtrosGlobais.unidadesLabel')}
          </label>
          <Popover open={openUnidades} onOpenChange={setOpenUnidades}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between bg-white"
              >
                <span className="truncate">{labelUnidades}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('gestorGeral.filtrosGlobais.buscarUnidade')} />
                <CommandList>
                  <CommandEmpty>{t('gestorGeral.filtrosGlobais.nenhumaEncontrada')}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={toggleSelecionarTodas}>
                      <Checkbox
                        checked={todasSelecionadas}
                        className="mr-2"
                        aria-label={t('gestorGeral.filtrosGlobais.selecionarTodas')}
                      />
                      <span className="font-medium">
                        {todasSelecionadas ? t('gestorGeral.filtrosGlobais.desmarcarTodas') : t('gestorGeral.filtrosGlobais.selecionarTodas')}
                      </span>
                    </CommandItem>
                    {unidades.map((u) => {
                      const checked = sel === null ? true : sel.includes(u.id);
                      return (
                        <CommandItem key={u.id} onSelect={() => toggleUnidade(u.id)}>
                          <Checkbox checked={checked} className="mr-2" />
                          <span className="truncate">{u.nome}</span>
                          {checked && <Check className="ml-auto h-4 w-4 opacity-60" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Preset */}
        <div className="w-full md:w-56">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('gestorGeral.filtrosGlobais.periodoLabel')}
          </label>
          <Select value={draft.preset} onValueChange={(v) => onPresetChange(v as PresetPeriodo)}>
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

        {/* Custom range */}
        {draft.preset === "custom" && (
          <div className="w-full md:w-72">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('gestorGeral.filtrosGlobais.intervaloLabel')}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start bg-white">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {custom?.from && custom?.to
                    ? `${format(custom.from, "dd/MM/yy")} – ${format(custom.to, "dd/MM/yy")}`
                    : t('gestorGeral.filtrosGlobais.selecione')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={custom}
                  onSelect={setCustom}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {chipsList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chipsList.map((id) => {
            const u = unidades.find((x) => x.id === id);
            if (!u) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className={cn("bg-[#F1F0FB] text-[#7E69AB] border-[#E8E0FF]")}
              >
                {u.nome}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
