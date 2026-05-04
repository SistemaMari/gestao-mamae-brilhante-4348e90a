import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import { AdminFiltrosProvider } from "@/contexts/AdminFiltrosContext";

export default function PreviewAdminLayout() {
  return (
    <AdminFiltrosProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#F8FAFC]">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader nomeAdmin="Administrador (vitrine)" />
            <BarraFiltrosGlobais />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminFiltrosProvider>
  );
}
