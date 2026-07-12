import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import { AdminFiltrosProvider } from "@/contexts/AdminFiltrosContext";

export default function PreviewAdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const nomeVitrine = t("admin.preview.showcaseAdmin");
  return (
    <AdminFiltrosProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#F8FAFC]">
          <AdminSidebar
            nome={nomeVitrine}
            email="demo@mari.health"
            onSair={() => navigate("/vitrine")}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />
            <BarraFiltrosGlobais />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <Outlet context={{ nomeAdmin: nomeVitrine }} />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminFiltrosProvider>
  );
}
