import { Filter } from "lucide-react";

export default function EmptyStateSemSelecao() {
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F0FB]">
        <Filter className="h-5 w-5 text-[#7E69AB]" />
      </div>
      <h3
        className="text-base font-semibold text-[#1E293B]"
        style={{ fontFamily: "Sora, sans-serif" }}
      >
        Nenhuma unidade selecionada
      </h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Selecione ao menos uma unidade no filtro acima para visualizar dados.
      </p>
    </div>
  );
}
