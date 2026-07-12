import { useTranslation } from "react-i18next";
import type { RegistroAutoria } from "@/hooks/useAutoriaFicha";

interface Props {
  registro: RegistroAutoria | null;
  /** Rótulo opcional (ex.: "Laudo gerado por"). Default: "Atendimento registrado por". */
  label?: string;
}

/**
 * Rodapé padrão de autoria nos cards clínicos.
 * Renderiza nada se não houver registro (consultório ou pré-carimbo).
 * Estética alinhada à lista do Histórico de atendimentos.
 */
export default function AutoriaRodape({ registro, label }: Props) {
  const { t, i18n } = useTranslation();
  if (!registro) return null;

  const resolvedLabel = label ?? t("clinico.autoriaRodape.defaultLabel");

  const data = new Date(registro.created_at).toLocaleString(i18n.language, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const partes: string[] = [];
  partes.push(t("clinico.autoriaRodape.doctorPrefix", { nome: registro.profissional_nome }));
  if (registro.profissional_crm) partes.push(t("clinico.autoriaRodape.crm", { crm: registro.profissional_crm }));
  if (registro.profissional_especialidade) partes.push(registro.profissional_especialidade);
  partes.push(data);

  return (
    <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{resolvedLabel}:</span>{" "}
      {partes.join(" — ")}
    </div>
  );
}
