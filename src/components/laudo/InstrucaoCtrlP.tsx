import { Printer } from 'lucide-react';

export default function InstrucaoCtrlP() {
  return (
    <div className="no-print flex items-center gap-2 text-[11px] text-[#94A3B8]">
      <Printer className="h-3.5 w-3.5" />
      <span>
        Para salvar ou imprimir esta ficha em PDF: pressione Ctrl+P (Windows) ou Cmd+P (Mac) e escolha
        "Salvar como PDF".
      </span>
    </div>
  );
}
