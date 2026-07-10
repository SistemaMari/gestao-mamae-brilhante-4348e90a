import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BarraFiltrosGlobais } from "@/components/admin/BarraFiltrosGlobais";
import { AdminFiltrosProvider } from "@/contexts/AdminFiltrosContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [verificando, setVerificando] = useState(true);
  const [nomeAdmin, setNomeAdmin] = useState("");

  // Verificação de admin — roda em toda navegação dentro de /admin/*
  useEffect(() => {
    let cancelado = false;

    const verificar = async () => {
      if (!user?.id) {
        navigate("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelado) return;

      if (error || !data) {
        navigate("/login", { replace: true });
        return;
      }

      setNomeAdmin(data.nome ?? "Administrador");
      setVerificando(false);
    };

    setVerificando(true);
    verificar();

    return () => {
      cancelado = true;
    };
  }, [user?.id, pathname, navigate]);

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7C4DBA]" />
      </div>
    );
  }

  return (
    <AdminFiltrosProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[#F8FAFC]">
          <AdminSidebar nome={nomeAdmin} email={user?.email} />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />
            {/* Barra de filtros: escondida na Visão Geral (/admin) — lá ela é
                renderizada dentro da página, acima dos gráficos que realmente
                filtra. Nas demais páginas segue no topo. */}
            {!["/admin", "/admin/admins", "/admin/institucionais", "/admin/profissionais", "/admin/laudos", "/admin/tutorial", "/admin/tutoriais"].includes(pathname) && <BarraFiltrosGlobais />}
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <Outlet context={{ nomeAdmin }} />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminFiltrosProvider>
  );
}
