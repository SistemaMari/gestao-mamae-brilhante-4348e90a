import { AlertTriangle } from "lucide-react";

export default function AvisoUnicidadeEmail() {
  return (
    <div className="flex gap-2 rounded-md border-l-4 border-l-[#F59E0B] bg-[#FEF3C7] p-3 text-sm text-[#7C2D12]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        E-mails são únicos no sistema. Se este e-mail já está cadastrado como
        admin, profissional, gestor de outra unidade ou gestor geral, a criação
        será bloqueada.
      </p>
    </div>
  );
}
