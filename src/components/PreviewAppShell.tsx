import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Users, UserPlus, CreditCard, UserCog, LogOut, Menu, X,
  ChevronRight, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const DUMMY = {
  firstName: 'Mari',
  planoLabel: 'Plano Teste — 3/10 laudos',
  plano: 'teste',
};

const navItems = [
  { label: 'Pacientes', icon: Users, path: '/vitrine/dashboard' },
  { label: 'Nova Paciente', icon: UserPlus, path: '/vitrine/paciente/nova' },
  { label: 'Meu Plano', icon: CreditCard, path: '/vitrine/planos' },
  { label: 'Meu Perfil', icon: UserCog, path: '/vitrine/perfil' },
];

function usePreviewBreadcrumb() {
  const path = useLocation().pathname;
  if (path === '/vitrine/dashboard') return null;
  if (path === '/vitrine/paciente/nova') return { parent: { label: 'Pacientes', path: '/vitrine/dashboard' }, current: 'Nova paciente' };
  if (path.startsWith('/vitrine/paciente/')) return { parent: { label: 'Pacientes', path: '/vitrine/dashboard' }, current: 'Ficha da paciente' };
  if (path === '/vitrine/planos') return { parent: null, current: 'Meu Plano' };
  if (path === '/vitrine/perfil') return { parent: null, current: 'Meu Perfil' };
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
      return location.pathname === '/vitrine/dashboard' || location.pathname.startsWith('/vitrine/paciente');
    }
    return location.pathname === itemPath;
  };

  const SidebarContent = () => (
    <>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
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
            {item.path === '/vitrine/planos' && (
              <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                {DUMMY.plano}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <button
          onClick={() => navigate('/')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Voltar à vitrine</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col print:block">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-card px-4 print:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="mr-3 md:hidden text-muted-foreground hover:text-foreground"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to="/vitrine/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="font-heading text-xs font-bold text-primary">DM</span>
          </div>
          <span className="hidden sm:inline font-heading text-base font-semibold" style={{ color: '#2D2B55' }}>
            Dra. Mari DMG Diagnóstica
          </span>
        </Link>

        <div className="flex-1" />

        <button
          onClick={() => navigate('/vitrine/planos')}
          className="hidden lg:inline-flex items-center rounded-full px-3 py-1 text-xs font-medium mr-4"
          style={{ backgroundColor: '#F1F0FB', color: '#7E69AB' }}
        >
          {DUMMY.planoLabel}
        </button>

        <span className="hidden md:inline text-sm mr-4" style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Olá, Dr(a). {DUMMY.firstName}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/vitrine/perfil')}>
              <UserCog className="h-4 w-4 mr-2" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/')} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Voltar à vitrine
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card print:hidden">
          <SidebarContent />
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden print:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-card shadow-xl md:hidden print:hidden animate-fade-in" style={{ top: '64px' }}>
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
