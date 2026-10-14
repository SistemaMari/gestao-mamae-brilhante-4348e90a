import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileText, FileBarChart, Settings, Building2, Loader2, PlayCircle, UserRound } from "lucide-react";
import i18n from "@/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { SidebarLogo, SidebarRodapeUsuario } from "@/components/shell/SidebarMarca";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Chaves i18n (traduzidas no render — antes i18n.t no módulo não trocava de idioma).
const buildItems = (base: string) => [
  { titleKey: "nav.dashboard", path: base, icon: LayoutDashboard, exact: true },
  { titleKey: "nav.team", path: `${base}/equipe`, icon: Users, exact: false },
  { titleKey: "gestor.appShell.fichasUnidade", path: `${base}/fichas`, icon: FileText, exact: false },
  // Relatórios só no app real (a vitrine não tem relatórios salvos).
  ...(base.startsWith("/vitrine")
    ? []
    : [{ titleKey: "gestor.appShell.relatorios", path: `${base}/relatorios`, icon: FileBarChart, exact: false }]),
  { titleKey: "admin.sidebar.settings", path: `${base}/configuracoes`, icon: Settings, exact: false },
  // Tutorial só no app real; a vitrine não tem rota /vitrine/gestao/tutorial.
  ...(base.startsWith("/vitrine")
    ? []
    : [{ titleKey: "admin.sidebar.tutorial", path: `${base}/tutorial`, icon: PlayCircle, exact: false, separar: true }]),
];

function GestorSidebar({ nome, unidade, email, basePath, onSair }: { nome: string; unidade: string; email: string; basePath: string; onSair: () => void }) {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const items = buildItems(basePath);
  const isVitrine = basePath.startsWith("/vitrine");
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
      <SidebarLogo collapsed={collapsed} />
      <SidebarContent className="bg-white border-r border-[#E2E8F0]">
        {/* Unidade gerida — contexto fixo do gestor, logo abaixo do logo */}
        {!collapsed && unidade && (
          <div className="mx-3 mt-1 flex items-center gap-2 rounded-lg bg-[#F5F0FF] px-3 py-2 text-xs font-medium text-[#7E69AB]">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{unidade}</span>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.path, item.exact);
                return (
                  <div key={item.path}>
                    {"separar" in item && item.separar && <div className="my-1 border-t border-[#E2E8F0]" />}
                    <SidebarMenuItem>
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
                          {!collapsed && <span className="text-sm">{t(item.titleKey)}</span>}
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

      <SidebarRodapeUsuario
        collapsed={collapsed}
        nome={nome}
        papel={t("gestor.appShell.gestorUnidade")}
        email={email}
        links={isVitrine ? [] : [{ to: `${basePath}/perfil`, label: t("appShell.myProfile"), icon: UserRound }]}
        onSair={onSair}
      />
    </Sidebar>
  );
}

export default function AppShellGestor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith("/vitrine");
  const [carregando, setCarregando] = useState(!isVitrine);
  const [nome, setNome] = useState(isVitrine ? i18n.t("gestor.appShell.demoNome") : "");
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
          basePath={isVitrine ? "/vitrine/gestao" : "/gestao"}
          onSair={handleSair}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4">
            <SidebarTrigger className="text-[#64748B]" />
            <span className="text-sm text-[#64748B]" style={{ fontFamily: "Sora, sans-serif" }}>
              {t('gestor.appShell.gestaoUnidade')}
            </span>
            <div className="ml-auto">
              <LanguageSwitcher variant="compact" />
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet context={{ nomeGestor: nome }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
