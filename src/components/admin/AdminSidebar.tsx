import { BarChart3, Map, Download, Users, Building2, Stethoscope } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const baseItems = [
  { title: "Painel", path: "", icon: BarChart3, exact: true },
  { title: "Diagnósticos", path: "/diagnosticos", icon: Map, exact: false },
  { title: "Filtros e Exportação", path: "/exportar", icon: Download, exact: false },
  { title: "Administradores", path: "/admins", icon: Users, exact: false },
  { title: "Contas Institucionais", path: "/institucionais", icon: Building2, exact: false },
  { title: "Contas Profissionais", path: "/profissionais", icon: Stethoscope, exact: false },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  // Detecta se estamos no modo vitrine para prefixar as URLs.
  const prefix = pathname.startsWith("/vitrine/admin") ? "/vitrine/admin" : "/admin";
  const items = baseItems.map((it) => ({
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
      <SidebarContent className="bg-white border-r border-[#E2E8F0]">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url, item.exact);
                return (
                  <SidebarMenuItem key={item.title}>
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
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
