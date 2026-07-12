import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, UserPlus, CreditCard, UserCog, LogOut, Menu, X,
  ChevronRight, BarChart3, PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import mariLogo from '@/assets/mari-logo.png';

const DUMMY = {
  firstName: 'Mari',
  fullName: 'Dra. Mari Demo',
  email: 'demo@mari.health',
  planoLabel: 'Plano Inicial',
  planoUsados: 0,
  planoLimite: 10,
};

const navItemsClinical = [
  { label: 'Pacientes', icon: Users, path: '/vitrine/dashboard' },
  { label: 'Nova Paciente', icon: UserPlus, path: '/vitrine/paciente/nova' },
  { label: 'Tutorial', icon: PlayCircle, path: '/vitrine/tutorial' },
  { label: 'Meu Dashboard', icon: BarChart3, path: '/vitrine/dashboard/metricas' },
  { label: 'Meu Plano', icon: CreditCard, path: '/vitrine/planos' },
];

function iniciaisNome(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function usePreviewBreadcrumb() {
  const path = useLocation().pathname;
  if (path === '/vitrine/dashboard') return null;
  if (path === '/vitrine/paciente/nova') return { parent: { label: 'Pacientes', path: '/vitrine/dashboard' }, current: 'Nova paciente' };
  if (path.startsWith('/vitrine/paciente/')) return { parent: { label: 'Pacientes', path: '/vitrine/dashboard' }, current: 'Ficha da paciente' };
  if (path === '/vitrine/planos') return { parent: null, current: 'Meu Plano' };
  if (path === '/vitrine/perfil') return { parent: null, current: 'Meu Perfil' };
  if (path === '/vitrine/dashboard/metricas') return { parent: null, current: 'Meu Dashboard' };
  return null;
}

export default function PreviewAppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumb = usePreviewBreadcrumb();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isActive = (itemPath: string) => {
    if (itemPath === '/vitrine/dashboard') {
      return location.pathname === '/vitrine/dashboard' || (location.pathname.startsWith('/vitrine/paciente') && !location.pathname.includes('/metricas'));
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  const perfilAtivo = location.pathname === '/vitrine/perfil';
  const consumoPct = Math.min(100, Math.round((DUMMY.planoUsados / DUMMY.planoLimite) * 100));

  const renderNavButton = (item: typeof navItemsClinical[0]) => (
    <button
      key={item.label}
      onClick={() => navigate(item.path)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive(item.path)
          ? 'bg-[#E8E0FF] text-[#7E69AB]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span>{item.label}</span>
    </button>
  );

  const SidebarContent = () => (
    <>
      <div className="shrink-0 border-b border-[#E2E8F0] p-3 bg-white">
        <img src={mariLogo} alt="MARI — Maternal ARtificial Intelligence" className="w-full rounded-lg" />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-4">
        {navItemsClinical.map(renderNavButton)}
      </nav>

      <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F5F0FF] p-3 space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #7E69AB, #9b87f5)', fontFamily: 'Sora, sans-serif' }}
          >
            {iniciaisNome(DUMMY.fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1E293B]" style={{ fontFamily: 'Sora, sans-serif' }}>
              {DUMMY.fullName}
            </p>
            <p className="truncate text-xs text-[#94A3B8]">{DUMMY.email}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/vitrine/perfil')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            perfilAtivo
              ? 'bg-[#E8E0FF] text-[#7E69AB] font-medium'
              : 'text-[#64748B] hover:bg-[#F1F5F9]'
          )}
        >
          <UserCog className="h-4 w-4 shrink-0" />
          Meu perfil
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Voltar à vitrine
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col print:block print:h-auto">
      {/* Floating top-right controls (no header bar) */}
      <div className="pointer-events-none fixed top-3 right-4 z-50 flex items-center gap-3 print:hidden">
        <button
          onClick={() => navigate('/vitrine/planos')}
          className="pointer-events-auto hidden lg:flex items-center gap-3 rounded-full pl-3 pr-4 py-1.5 text-xs font-medium hover:opacity-90 transition shadow-sm"
          style={{ backgroundColor: '#F1F0FB', color: '#7E69AB' }}
        >
          <span className="font-semibold">{DUMMY.planoLabel}</span>
          <span className="flex items-center gap-2">
            <span className="relative block h-1.5 w-24 rounded-full overflow-hidden" style={{ backgroundColor: '#E2DEF5' }}>
              <span className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${consumoPct}%`, backgroundColor: '#7E69AB' }} />
            </span>
            <span className="tabular-nums" style={{ color: '#7E69AB' }}>
              {DUMMY.planoUsados}/{DUMMY.planoLimite}
            </span>
          </span>
        </button>
        <div className="pointer-events-auto">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="pointer-events-auto fixed top-3 left-3 z-50 md:hidden rounded-md bg-card/80 backdrop-blur p-2 text-muted-foreground hover:text-foreground shadow-sm print:hidden"
        aria-label="Menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div className="flex flex-1 min-h-0 overflow-hidden print:block print:overflow-visible print:h-auto print:min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[#E2E8F0] bg-white print:hidden h-full overflow-hidden">
          <SidebarContent />
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden print:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-white shadow-xl md:hidden print:hidden animate-fade-in overflow-hidden" style={{ top: '0' }}>
              <SidebarContent />
            </aside>
          </>
        )}

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-background print:overflow-visible">
          {breadcrumb && (
            <div className="border-b border-border bg-card px-6 py-2.5 print:hidden">
              <nav className="flex items-center gap-1.5 text-[13px]" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {breadcrumb.parent && (
                  <>
                    <Link to={breadcrumb.parent.path} className="hover:underline" style={{ color: '#94A3B8' }}>
                      {breadcrumb.parent.label}
                    </Link>
                    <ChevronRight className="h-3 w-3" style={{ color: '#94A3B8' }} />
                  </>
                )}
                <span className="font-medium" style={{ color: '#2D2B55' }}>
                  {breadcrumb.current}
                </span>
              </nav>
            </div>
          )}

          <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
