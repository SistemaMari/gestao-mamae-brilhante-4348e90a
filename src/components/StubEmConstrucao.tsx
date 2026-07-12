import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  titulo: string;
}

export default function StubEmConstrucao({ titulo }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8E0FF]">
          <Construction className="h-6 w-6 text-[#7E69AB]" />
        </div>
        <h1 className="text-xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">{t("stubEmConstrucao.message")}</p>
      </div>
    </div>
  );
}
