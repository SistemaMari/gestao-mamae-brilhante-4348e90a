import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CidadeComboboxProps {
  value: string;
  onChange: (cidade: string) => void;
  cidades: string[];
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

/**
 * Combobox com busca interna para selecionar cidade.
 * Suporta listas grandes (ex.: 853 municípios de MG) usando Command + Popover.
 */
export default function CidadeCombobox({
  value,
  onChange,
  cidades,
  disabled,
  placeholder = 'Selecione a cidade...',
  emptyMessage = 'Nenhuma cidade encontrada.',
  className,
}: CidadeComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Digite para buscar..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {cidades.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === c ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {c}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
