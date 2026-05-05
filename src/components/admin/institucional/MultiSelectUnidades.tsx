import { useMemo, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface UnidadeOption {
  id: string;
  nome: string;
  cidade?: string | null;
}

interface Props {
  unidades: UnidadeOption[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function MultiSelectUnidades({
  unidades,
  selecionadas,
  onChange,
  disabled,
}: Props) {
  const total = unidades.length;
  const sel = selecionadas.length;
  const allChecked = total > 0 && sel === total;
  const partial = sel > 0 && sel < total;

  const allRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (allRef.current) {
      (allRef.current as any).dataset.state = allChecked
        ? "checked"
        : partial
          ? "indeterminate"
          : "unchecked";
    }
  }, [allChecked, partial]);

  function toggleAll() {
    if (allChecked) onChange([]);
    else onChange(unidades.map((u) => u.id));
  }

  function toggleOne(id: string) {
    if (selecionadas.includes(id)) onChange(selecionadas.filter((x) => x !== id));
    else onChange([...selecionadas, id]);
  }

  const setSel = useMemo(() => new Set(selecionadas), [selecionadas]);

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <label className="flex items-center gap-2 border-b bg-[#F5F3FA] px-3 py-2 text-sm font-medium">
          <Checkbox
            ref={allRef as any}
            checked={partial ? "indeterminate" : allChecked}
            onCheckedChange={toggleAll}
            disabled={disabled || total === 0}
          />
          Selecionar todas
        </label>
        <div className="max-h-[320px] overflow-y-auto">
          {total === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nenhuma unidade cadastrada.
            </p>
          ) : (
            unidades.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-[#F9F7FC]"
              >
                <Checkbox
                  checked={setSel.has(u.id)}
                  onCheckedChange={() => toggleOne(u.id)}
                  disabled={disabled}
                />
                <span>
                  {u.nome}
                  {u.cidade ? (
                    <span className="text-muted-foreground"> ({u.cidade})</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {sel} de {total} selecionada{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
