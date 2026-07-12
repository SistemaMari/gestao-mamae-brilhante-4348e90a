import { BarChart3, Map, Download, Users, Building2, Stethoscope, FileText, PlayCircle, Film, CreditCard, Lightbulb, MessageSquareHeart, Heart, Settings, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
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
  { titleKey: "admin.sidebar.panel", path: "", icon: BarChart3, exact: true },
  { titleKey: "admin.sidebar.diagnostics", path: "/diagnosticos", icon: Map, exact: false },
  { titleKey: "admin.sidebar.filtersExport", path: "/exportar", icon: Download, exact: false },
  { titleKey: "admin.sidebar.admins", path: "/admins", icon: Users, exact: false },
  { titleKey: "admin.sidebar.institutionalAccounts", path: "/institucionais", icon: Building2, exact: false },
  { titleKey: "admin.sidebar.professionalAccounts", path: "/profissionais", icon: Stethoscope, exact: false },
  { titleKey: "admin.sidebar.reportTexts", path: "/laudos", icon: FileText, exact: false },
  { titleKey: "admin.sidebar.plans", path: "/planos", icon: CreditCard, exact: false },
  { titleKey: "admin.sidebar.dashboardTips", path: "/dicas", icon: Lightbulb, exact: false },
  { titleKey: "admin.sidebar.feedbacks", path: "/feedbacks", icon: MessageSquareHeart, exact: false, badge: "feedbacks_novos" as const },
  { titleKey: "admin.sidebar.testimonials", path: "/depoimentos", icon: Heart, exact: false, badge: "depoimentos_pendentes" as const },
  { titleKey: "admin.sidebar.manageTutorials", path: "/tutoriais", icon: Film, exact: false },
  { titleKey: "admin.sidebar.tutorial", path: "/tutorial", icon: PlayCircle, exact: false },
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
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const nomeFinal = nome || t("admin.overview.adminFallback");
  const emailFinal = email ?? user?.email ?? "";

  const sair =
    onSair ??
    (async () => {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    });

  // Badges: feedbacks novos + depoimentos pendentes
  const [badges, setBadges] = useState<{ feedbacks_novos: number; depoimentos_pendentes: number }>({
    feedbacks_novos: 0, depoimentos_pendentes: 0,
  });
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const [{ count: fCount }, { count: dCount }] = await Promise.all([
        supabase.from('feedbacks_usuario').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
        supabase.from('depoimentos_usuario').select('id', { count: 'exact', head: true }).is('aprovado', null),
      ]);
      if (!cancel) setBadges({ feedbacks_novos: fCount ?? 0, depoimentos_pendentes: dCount ?? 0 });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancel = true; clearInterval(t); };
  }, [pathname]);

  // Detecta se estamos no modo vitrine para prefixar as URLs.
  const prefix = pathname.startsWith("/vitrine/admin") ? "/vitrine/admin" : "/admin";
  const isVitrine = prefix === "/vitrine/admin";
  const items = baseItems
    // Tutorial e Configurações só no admin real; a vitrine não tem essas rotas.
    .filter((it) => !(isVitrine && (it.path.startsWith("/tutorial") || it.path === "/configuracoes" || it.path === "/planos")))
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
                  <div key={item.titleKey}>
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
                          {!collapsed && <span className="text-sm flex-1">{t(item.titleKey)}</span>}
                          {!collapsed && (item as any).badge && badges[(item as any).badge as keyof typeof badges] > 0 && (
                            <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {badges[(item as any).badge as keyof typeof badges]}
                            </span>
                          )}
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
                {t("admin.sidebar.settings")}
              </NavLink>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={sair}
              className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("common.logout")}
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
                aria-label={t("admin.sidebar.settings")}
              >
                <Settings className="h-4 w-4" />
              </NavLink>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={sair}
              className="text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label={t("common.logout")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
