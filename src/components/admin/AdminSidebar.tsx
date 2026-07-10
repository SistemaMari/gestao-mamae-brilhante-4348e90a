import { BarChart3, Map, Download, Users, Building2, Stethoscope, FileText, PlayCircle, Film, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import mariLogo from "@/assets/mari-logo.png";

const baseItems = [
  { title: "Painel", path: "", icon: BarChart3, exact: true },
  { title: "Diagnósticos", path: "/diagnosticos", icon: Map, exact: false },
  { title: "Filtros e Exportação", path: "/exportar", icon: Download, exact: false },
  { title: "Administradores", path: "/admins", icon: Users, exact: false },
  { title: "Contas Institucionais", path: "/institucionais", icon: Building2, exact: false },
  { title: "Contas Profissionais", path: "/profissionais", icon: Stethoscope, exact: false },
  { title: "Textos de Laudo", path: "/laudos", icon: FileText, exact: false },
  { title: "Gerenciar Tutoriais", path: "/tutoriais", icon: Film, exact: false },
  { title: "Tutorial", path: "/tutorial", icon: PlayCircle, exact: false },
];

function iniciais(nome?: string | null) {
  if (!nome) return "AD";
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface AdminSidebarProps {
  nome?: string;
  email?: string;
  onSair?: () => void;
}

export function AdminSidebar({ nome, email, onSair }: AdminSidebarProps = {}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const nomeFinal = nome || "Administrador";
  const emailFinal = email ?? user?.email ?? "";

  const sair =
    onSair ??
    (async () => {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    });

  // Detecta se estamos no modo vitrine para prefixar as URLs.
  const prefix = pathname.startsWith("/vitrine/admin") ? "/vitrine/admin" : "/admin";
  const isVitrine = prefix === "/vitrine/admin";
  const items = baseItems
    // Tutorial e Configurações só no admin real; a vitrine não tem essas rotas.
    .filter((it) => !(isVitrine && (it.path.startsWith("/tutorial") || it.path === "/configuracoes")))
    .map((it) => ({
      ...it,
      url: it.path === "" ? prefix : `${prefix}${it.path}`,
    }));

  const isActive = (url: string, exact: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  return (
    <Sidebar
      collapsible="icon"
      style={{
        // CORREÇÃO 1 — sidebar branca com borda clara
        ["--sidebar-background" as string]: "0 0% 100%",
        ["--sidebar-foreground" as string]: "215 16% 47%", // #64748B
        ["--sidebar-border" as string]: "214 32% 91%", // #E2E8F0
        ["--sidebar-accent" as string]: "252 100% 94%", // #E8E0FF
        ["--sidebar-accent-foreground" as string]: "260 25% 54%", // #7E69AB
      }}
    >
      <SidebarHeader className="bg-white border-r border-[#E2E8F0] p-3">
        {collapsed ? (
          <img
            src={mariLogo}
            alt="MARI"
            className="h-9 w-9 rounded-md object-cover"
          />
        ) : (
          <img
            src={mariLogo}
            alt="MARI — Maternal ARtificial Intelligence"
            className="w-full rounded-lg"
          />
        )}
      </SidebarHeader>
      <SidebarContent className="bg-white border-r border-[#E2E8F0]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url, item.exact);
                return (
                  <div key={item.title}>
                    {item.path === "/tutorial" && (
                      <div className="my-1 border-t border-[#E2E8F0]" />
                    )}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink
                          to={item.url}
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
                  </div>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Rodapé: identidade + sair */}
      <SidebarFooter className="border-t border-[#E2E8F0] bg-[#F5F0FF] p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #7E69AB, #9b87f5)", fontFamily: "Sora, sans-serif" }}
              >
                {iniciais(nomeFinal)}
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold text-[#1E293B]"
                  style={{ fontFamily: "Sora, sans-serif" }}
                >
                  {nomeFinal}
                </p>
                {emailFinal && (
                  <p className="truncate text-xs text-[#94A3B8]">{emailFinal}</p>
                )}
              </div>
            </div>
            {!isVitrine && (
              <NavLink
                to={`${prefix}/configuracoes`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                    isActive
                      ? "bg-[#E8E0FF] text-[#7E69AB] font-medium"
                      : "text-[#64748B] hover:bg-[#F1F5F9]",
                  )
                }
              >
                <Settings className="h-4 w-4 shrink-0" />
                Configurações
              </NavLink>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={sair}
              className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {!isVitrine && (
              <NavLink
                to={`${prefix}/configuracoes`}
                className={({ isActive }) =>
                  cn(
                    "flex h-9 w-9 items-center justify-center rounded-md",
                    isActive
                      ? "bg-[#E8E0FF] text-[#7E69AB]"
                      : "text-[#64748B] hover:bg-[#F1F5F9]",
                  )
                }
                aria-label="Configurações"
              >
                <Settings className="h-4 w-4" />
              </NavLink>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={sair}
              className="text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
