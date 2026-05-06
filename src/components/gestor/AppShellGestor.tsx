import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Settings, LogOut, Building2, Loader2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Painel", path: "/gestao", icon: LayoutDashboard, exact: true },
  { title: "Equipe", path: "/gestao/equipe", icon: Users, exact: false },
  { title: "Fichas da unidade", path: "/gestao/fichas", icon: FileText, exact: false },
  { title: "Configurações", path: "/gestao/configuracoes", icon: Settings, exact: false },
];

function iniciais(nome?: string | null) {
  if (!nome) return "GU";
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function GestorSidebar({ nome, unidade, email, onSair }: { nome: string; unidade: string; email: string; onSair: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string, exact: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  return (
    <Sidebar
      collapsible="icon"
      style={{
        ["--sidebar-background" as string]: "0 0% 100%",
        ["--sidebar-foreground" as string]: "215 16% 47%",
        ["--sidebar-border" as string]: "214 32% 91%",
        ["--sidebar-accent" as string]: "252 100% 94%",
        ["--sidebar-accent-foreground" as string]: "260 25% 54%",
      }}
    >
      <SidebarContent className="bg-white border-r border-[#E2E8F0] flex flex-col">
        {/* Identidade */}
        <div className="border-b border-[#E2E8F0] p-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, #7E69AB, #9b87f5)", fontFamily: "Sora, sans-serif" }}
            >
              {iniciais(nome)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
                  {nome || "—"}
                </p>
                <p className="text-xs text-[#7E69AB]">Gestor de Unidade</p>
              </div>
            )}
          </div>
          {!collapsed && unidade && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{unidade}</span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.path, item.exact);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.path}
                        end={item.exact}
                        className={
                          active
                            ? "flex items-center gap-3 bg-[#E8E0FF] text-[#7E69AB] font-medium rounded-md"
                            : "flex items-center gap-3 text-[#64748B] hover:bg-[#F1F5F9] rounded-md"
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Rodapé */}
        <div className="mt-auto border-t border-[#E2E8F0] p-3 space-y-2">
          {!collapsed && email && (
            <p className="truncate px-2 text-xs text-[#94A3B8]">{email}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onSair}
            className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AppShellGestor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith("/vitrine");
  const [carregando, setCarregando] = useState(!isVitrine);
  const [nome, setNome] = useState(isVitrine ? "Dra. Demonstração" : "");
  const [unidade, setUnidade] = useState(isVitrine ? "Hospital Demo MARI" : "");

  useEffect(() => {
    if (isVitrine) return;
    let cancelado = false;
    (async () => {
      if (!user?.id) {
        navigate("/login", { replace: true });
        return;
      }
      const { data } = await supabase
        .from("profissionais")
        .select("nome, unidades:unidade_id ( nome )")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelado) return;
      setNome(data?.nome ?? "");
      const u = (data as any)?.unidades;
      setUnidade(u?.nome ?? "");
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, navigate, isVitrine]);

  const handleSair = async () => {
    if (isVitrine) {
      navigate("/vitrine", { replace: true });
      return;
    }
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7E69AB]" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#F8FAFC]">
        <GestorSidebar
          nome={nome}
          unidade={unidade}
          email={isVitrine ? "demo@mari.health" : user?.email ?? ""}
          onSair={handleSair}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4">
            <SidebarTrigger className="text-[#64748B]" />
            <span className="text-sm text-[#64748B]" style={{ fontFamily: "Sora, sans-serif" }}>
              Gestão da Unidade
            </span>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
