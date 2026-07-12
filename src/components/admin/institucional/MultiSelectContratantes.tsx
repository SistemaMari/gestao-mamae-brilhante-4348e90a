import { useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";

export interface ContratanteOption {
  id: string;
  nome: string;
  status?: string;
}

interface Props {
  contratantes: ContratanteOption[];
  selecionadas: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Quando true, opções com status !== 'ativo' aparecem mas ficam desabilitadas (preserva vínculos pré-existentes). */
  desabilitarEncerrados?: boolean;
}

export default function MultiSelectContratantes({
  contratantes,
  selecionadas,
  onChange,
  disabled,
  desabilitarEncerrados = false,
}: Props) {
  const { t } = useTranslation();
  const total = contratantes.length;
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
    else onChange(contratantes.filter((c) => !desabilitarEncerrados || c.status === "ativo" || selecionadas.includes(c.id)).map((c) => c.id));
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
          {t("admin.multiSelectContratantes.selectAll")}
        </label>
        <div className="max-h-[320px] overflow-y-auto">
          {total === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("admin.multiSelectContratantes.empty")}
            </p>
          ) : (
            contratantes.map((c) => {
              const isEncerrado = c.status && c.status !== "ativo";
              const jaSelecionado = setSel.has(c.id);
              const itemDisabled = disabled || (desabilitarEncerrados && isEncerrado && !jaSelecionado);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-[#F9F7FC] ${itemDisabled ? "opacity-60" : ""}`}
                >
                  <Checkbox
                    checked={jaSelecionado}
                    onCheckedChange={() => toggleOne(c.id)}
                    disabled={itemDisabled}
                  />
                  <span>
                    {c.nome}
                    {isEncerrado ? (
                      <span className="text-muted-foreground"> ({c.status})</span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("admin.multiSelectContratantes.selectedCount", { sel, total })}
      </p>
    </div>
  );
}
