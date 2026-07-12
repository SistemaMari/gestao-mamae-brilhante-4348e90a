import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function EmptyStateSemSelecao() {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F0FB]">
        <Filter className="h-5 w-5 text-[#7E69AB]" />
      </div>
      <h3
        className="text-base font-semibold text-[#1E293B]"
        style={{ fontFamily: "Sora, sans-serif" }}
      >
        {t('gestorGeral.emptyStateSemSelecao.title')}
      </h3>
      <p className="mt-1 text-sm text-[#64748B]">
        {t('gestorGeral.emptyStateSemSelecao.descricao')}
      </p>
    </div>
  );
}
