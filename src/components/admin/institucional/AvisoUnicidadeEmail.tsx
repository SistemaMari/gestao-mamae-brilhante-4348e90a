import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AvisoUnicidadeEmail() {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 rounded-md border-l-4 border-l-[#F59E0B] bg-[#FEF3C7] p-3 text-sm text-[#7C2D12]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{t("admin.institucional.emailUniquenessWarning")}</p>
    </div>
  );
}
