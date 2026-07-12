import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  Building2, BarChart3, ShieldCheck, Activity, BookOpen, GraduationCap, Map, Download, Stethoscope,
  UserPlus, History, CreditCard, UserCircle, PlayCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import mariLogo from '@/assets/mari-logo.png';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  dividerBefore?: boolean;
}

const navByProfile: Record<string, NavItem[]> = {
  consultorio: [
    { label: 'appSidebar.patients', icon: Users, path: '/dashboard' },
    { label: 'appSidebar.newPatient', icon: UserPlus, path: '/paciente/nova' },
    { label: 'appSidebar.myCourses', icon: GraduationCap, path: '/meus-cursos' },
    { label: 'appSidebar.metrics', icon: BarChart3, path: '/dashboard/metricas' },
    { label: 'appSidebar.plans', icon: CreditCard, path: '/planos' },
    { label: 'appSidebar.profile', icon: UserCircle, path: '/perfil' },
  ],
  institucional: [
    { label: 'appSidebar.patients', icon: Users, path: '/dashboard' },
    { label: 'appSidebar.newPatient', icon: UserPlus, path: '/paciente/nova' },
    { label: 'appSidebar.tutorial', icon: PlayCircle, path: '/tutorial', dividerBefore: true },
  ],
  gestor: [
    { label: 'appSidebar.dashboard', icon: LayoutDashboard, path: '/gestao' },
    { label: 'appSidebar.team', icon: Users, path: '/gestao/equipe' },
    { label: 'appSidebar.reports', icon: BarChart3, path: '/gestao' },
    { label: 'appSidebar.settings', icon: Settings, path: '/gestao' },
  ],
  gestor_geral: [
    { label: 'appSidebar.consolidation', icon: BarChart3, path: '/consolidar' },
    { label: 'appSidebar.units', icon: Building2, path: '/consolidar' },
    { label: 'appSidebar.reports', icon: FileText, path: '/consolidar' },
  ],
  admin: [
    { label: 'appSidebar.panel', icon: ShieldCheck, path: '/admin' },
    { label: 'appSidebar.diagnostics', icon: Map, path: '/admin/diagnosticos' },
    { label: 'appSidebar.filtersExport', icon: Download, path: '/admin/exportar' },
    { label: 'appSidebar.admins', icon: Users, path: '/admin/admins' },
    { label: 'appSidebar.institutionalAccounts', icon: Building2, path: '/admin/institucionais' },
    { label: 'appSidebar.professionalAccounts', icon: Stethoscope, path: '/admin/profissionais' },
  ],
};

function iniciais(nome?: string | null) {
  if (!nome) return 'US';
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function AppSidebar() {
  const { t } = useTranslation();
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [nomeProfissional, setNomeProfissional] = useState<string>('');

  const items = navByProfile[profile || 'consultorio'] || navByProfile.consultorio;
  const isInstitucional = profile === 'institucional';

  useEffect(() => {
    if (!isInstitucional || !user?.id) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from('profissionais')
        .select('nome')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelado) setNomeProfissional(data?.nome ?? '');
    })();
    return () => { cancelado = true; };
  }, [isInstitucional, user?.id]);

  const profileLabels: Record<string, string> = {
    consultorio: t('appSidebar.profileConsultorio'),
    institucional: t('appSidebar.profileInstitucional'),
    gestor: t('appSidebar.profileGestor'),
    gestor_geral: t('appSidebar.profileGestorGeral'),
    admin: t('appSidebar.profileAdmin'),
  };

  const isActive = (path: string) => location.pathname === path;

  // ============ Layout específico Institucional (espelha Admin) ============
  if (isInstitucional) {
    const nomeFinal = nomeProfissional || user?.email?.split('@')[0] || t('appSidebar.userFallback');
    const perfilAtivo = isActive('/perfil');

    return (
      <aside
        className={cn(
          'flex h-screen flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[240px]'
        )}
      >
        {/* Header com logo MARI */}
        <div className="border-b border-[#E2E8F0] p-3">
          {collapsed ? (
            <img src={mariLogo} alt="MARI" className="h-9 w-9 rounded-md object-cover mx-auto" />
          ) : (
            <img src={mariLogo} alt={t('appSidebar.logoAltFull')} className="w-full rounded-lg" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <div key={item.label}>
                {item.dividerBefore && <div className="my-2 border-t border-[#E2E8F0]" />}
                <button
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#E8E0FF] text-[#7E69AB]'
                      : 'text-[#64748B] hover:bg-[#F1F5F9]'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{t(item.label)}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer lilás */}
        <div className="border-t border-[#E2E8F0] bg-[#F5F0FF] p-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #7E69AB, #9b87f5)', fontFamily: 'Sora, sans-serif' }}
                >
                  {iniciais(nomeFinal)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1E293B]" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {nomeFinal}
                  </p>
                  {user?.email && (
                    <p className="truncate text-xs text-[#94A3B8]">{user.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate('/perfil')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                  perfilAtivo
                    ? 'bg-[#E8E0FF] text-[#7E69AB] font-medium'
                    : 'text-[#64748B] hover:bg-[#F1F5F9]'
                )}
              >
                <UserCircle className="h-4 w-4 shrink-0" />
                {t('appSidebar.profile')}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('common.logout')}
              </Button>
              <button
                onClick={() => setCollapsed(true)}
                className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('appSidebar.collapse')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => navigate('/perfil')}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md',
                  perfilAtivo ? 'bg-[#E8E0FF] text-[#7E69AB]' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                )}
                aria-label={t('appSidebar.profile')}
              >
                <UserCircle className="h-4 w-4" />
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-[#64748B] hover:bg-[#F1F5F9]"
                aria-label={t('common.logout')}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setCollapsed(false)}
                className="text-[#94A3B8] hover:text-[#64748B]"
                aria-label={t('appSidebar.expand')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ============ Layout padrão (demais perfis) ============
  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <span className="font-heading text-sm font-bold text-primary">DM</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold text-foreground">MARI</p>
            <p className="truncate text-xs text-muted-foreground">{profileLabels[profile || ''] || ''}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(item.label)}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-3 space-y-1">
        {!collapsed && user?.email && (
          <p className="truncate px-3 text-xs text-muted-foreground mb-2">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t('common.logout')}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>{t('appSidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
