import { Construction } from "lucide-react";

interface PlaceholderSecaoProps {
  titulo: string;
  mensagem?: string;
}

export function PlaceholderSecao({
  titulo,
  mensagem = "Esta seção será construída em breve.",
}: PlaceholderSecaoProps) {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="flex flex-col items-center text-center max-w-md w-full rounded-xl border px-8 py-12"
        style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}
      >
        <div className="mb-4 rounded-full p-3" style={{ background: "#E8E0FF" }}>
          <Construction className="h-7 w-7" style={{ color: "#9b87f5" }} />
        </div>
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: "#1E293B", fontFamily: "Sora, sans-serif" }}
        >
          {titulo}
        </h2>
        <p className="text-sm" style={{ color: "#64748B" }}>
          {mensagem}
        </p>
      </div>
    </div>
  );
}
