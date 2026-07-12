import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, FileBarChart, Activity, BarChart3, Settings, LogOut, Briefcase, Loader2, PlayCircle } from "lucide-react";
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

const buildItems = (base: string, t: (key: string) => string) => [
  { title: t("gestorGeral.appShell.navVisaoGeral"), path: `${base}/visao-geral`, icon: LayoutGrid, exact: false },
  { title: t("gestorGeral.appShell.navConsolidador"), path: `${base}/consolidador`, icon: FileBarChart, exact: false },
  { title: t("gestorGeral.appShell.navDiagnostico"), path: `${base}/diagnostico`, icon: Activity, exact: false },
  { title: t("gestorGeral.appShell.navComparador"), path: `${base}/comparador`, icon: BarChart3, exact: false },
  { title: t("gestorGeral.appShell.navConfiguracoes"), path: `${base}/configuracoes`, icon: Settings, exact: false },
  // Tutorial só no app real; a vitrine não tem rota /vitrine/consolidar/tutorial.
  ...(base.startsWith("/vitrine")
    ? []
    : [{ title: t("gestorGeral.appShell.navTutorial"), path: `${base}/tutorial`, icon: PlayCircle, exact: false }]),
];

function iniciais(nome?: string | null) {
  if (!nome) return "GG";
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function GestorGeralSidebar({
  nome,
  detalhe,
  email,
  basePath,
  onSair,
}: {
  nome: string;
  detalhe: string;
  email: string;
  basePath: string;
  onSair: () => void;
}) {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const items = buildItems(basePath, t);

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
      <SidebarContent className="bg-white border-r border-[#E2E8F0] flex flex-col overflow-hidden">
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
                <p className="text-xs text-[#7E69AB]">{t("gestorGeral.appShell.roleLabel")}</p>
              </div>
            )}
          </div>
          {!collapsed && detalhe && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{detalhe}</span>
            </div>
          )}
        </div>

        <SidebarGroup className="flex-1 min-h-0 overflow-y-auto">
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

        <div className="shrink-0 border-t border-[#E2E8F0] p-3 space-y-2 bg-white">
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
            {!collapsed && t("common.logout")}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AppShellGestorGeral() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith("/vitrine");
  const [carregando, setCarregando] = useState(!isVitrine);
  const [nome, setNome] = useState(isVitrine ? t("gestorGeral.appShell.demoNome") : "");
  const [detalhe, setDetalhe] = useState(
    isVitrine ? t("gestorGeral.appShell.demoDetalhe") : "",
  );

  useEffect(() => {
    if (isVitrine) return;
    let cancelado = false;
    (async () => {
      if (!user?.id) {
        navigate("/login", { replace: true });
        return;
      }
      const { data } = await supabase
        .from("gestores_gerais")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelado) return;
      setNome(data?.nome ?? "");
      setDetalhe("");
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
        <GestorGeralSidebar
          nome={nome}
          detalhe={detalhe}
          email={isVitrine ? "demo@mari.health" : user?.email ?? ""}
          basePath={isVitrine ? "/vitrine/consolidar" : "/consolidar"}
          onSair={handleSair}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4">
            <SidebarTrigger className="text-[#64748B]" />
            <span className="text-sm text-[#64748B]" style={{ fontFamily: "Sora, sans-serif" }}>
              {t("gestorGeral.appShell.headerLabel")}
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
