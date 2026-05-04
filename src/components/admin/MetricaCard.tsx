interface MetricaCardProps {
  label: string;
  valor: number | string;
  formato?: "numero" | "percentual" | "moeda";
  variacao?: { valor: number; periodo: string };
}

function formatar(valor: number | string, formato: "numero" | "percentual" | "moeda"): string {
  if (typeof valor === "string") return valor;
  if (formato === "percentual") return `${valor}%`;
  if (formato === "moeda") {
    return `R$ ${valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return valor.toLocaleString("pt-BR");
}

export function MetricaCard({ label, valor, formato = "numero", variacao }: MetricaCardProps) {
  const positivo = variacao ? variacao.valor >= 0 : false;
  return (
    <div
      className="rounded-lg bg-white shadow-sm"
      style={{ border: "1px solid #E2E8F0", padding: 20 }}
    >
      <div
        className="text-sm"
        style={{ fontFamily: "Plus Jakarta Sans, sans-serif", color: "#64748B" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[28px] font-bold leading-tight"
        style={{ fontFamily: "Sora, sans-serif", color: "#1E293B" }}
      >
        {formatar(valor, formato)}
      </div>
      {variacao && (
        <div
          className="mt-1 text-[12px]"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          <span style={{ color: positivo ? "#16A34A" : "#DC2626", fontWeight: 600 }}>
            {positivo ? "↑" : "↓"} {Math.abs(variacao.valor)}
            {formato === "percentual" ? "%" : ""}
          </span>
          <span style={{ color: "#64748B" }}> vs {variacao.periodo}</span>
        </div>
      )}
    </div>
  );
}

export default MetricaCard;
