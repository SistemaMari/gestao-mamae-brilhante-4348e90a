import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

export function AdminHeader() {
  const { t } = useTranslation();
  return (
    <header className="flex h-16 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 md:px-6">
      <SidebarTrigger className="text-[#64748B]" />
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-9 w-9 rounded-lg shrink-0"
          style={{ background: "linear-gradient(135deg, #7C4DBA, #5EEAD4)" }}
          aria-hidden
        />
        <h1
          className="font-semibold text-[#1E293B] truncate"
          style={{ fontFamily: "Sora, sans-serif" }}
        >
          <span className="hidden md:inline">{t("admin.header.titleFull")}</span>
          <span className="md:hidden">{t("admin.header.titleShort")}</span>
        </h1>
      </div>
    </header>
  );
}
