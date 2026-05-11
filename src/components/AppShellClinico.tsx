import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { useSyncLanguageWithProfile } from '@/hooks/useSyncLanguageWithProfile';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, UserPlus, CreditCard, UserCog, LogOut, Menu, X,
  ChevronRight, User, Loader2, BarChart3, FileText, GraduationCap, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import BlockingModal from '@/components/BlockingModal';
import BannerUsoLaudos from '@/components/BannerUsoLaudos';
import BannerStatusPlano from '@/components/BannerStatusPlano';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { avaliarPlanoStatus } from '@/lib/planoStatus';
import { toast } from '@/hooks/use-toast';

function useBreadcrumb() {
  const { t } = useTranslation();
  const location = useLocation();
  const [pacienteNome, setPacienteNome] = useState<string | null>(null);
  const path = location.pathname;

  useEffect(() => {
    const match = path.match(/^\/paciente\/([^/]+)$/);
    if (match && match[1] !== 'nova') {
      supabase
        .from('pacientes')
        .select('nome')
        .eq('id', match[1])
        .maybeSingle()
        .then(({ data }) => setPacienteNome(data?.nome || match[1].slice(0, 8)));
    } else {
      setPacienteNome(null);
    }
  }, [path]);

  if (path === '/dashboard') return null;
  const patientsParent = { label: t('nav.patients'), path: '/dashboard' };
  if (path === '/paciente/nova') return { parent: patientsParent, current: t('nav.newPatient') };
  if (path.startsWith('/paciente/')) return { parent: patientsParent, current: pacienteNome || '...' };
  if (path === '/planos') return { parent: null, current: t('nav.plans') };
  if (path === '/perfil') return { parent: null, current: t('nav.profile') };
  if (path === '/completar-perfil') return { parent: null, current: t('profile.title') };
  if (path === '/dashboard/metricas') return { parent: null, current: t('nav.metrics') };
  if (path === '/laudos') return { parent: null, current: t('nav.history') };
  if (path === '/meus-cursos') return { parent: null, current: 'Meus Cursos' };
  return null;
}

interface NavItem {
  labelKey: string;
  icon: typeof Users;
  path: string;
  checkLimit?: boolean;
}

// Menus clínicos — seleção explícita por perfil (defesa em profundidade,
// não confiar só no ProtectedRoute).
const navClinicoConsultorio: NavItem[] = [
  { labelKey: 'nav.patients', icon: Users, path: '/dashboard' },
  { labelKey: 'nav.newPatient', icon: UserPlus, path: '/paciente/nova', checkLimit: true },
  { labelKey: 'Meus Cursos', icon: GraduationCap, path: '/meus-cursos' },
  { labelKey: 'nav.metrics', icon: BarChart3, path: '/dashboard/metricas' },
];

const navClinicoInstitucional: NavItem[] = [
  { labelKey: 'nav.patients', icon: Users, path: '/dashboard' },
  { labelKey: 'nav.newPatient', icon: UserPlus, path: '/paciente/nova', checkLimit: true },
  { labelKey: 'nav.history', icon: FileText, path: '/laudos' },
];

// Gestor / gestor_geral normalmente não passam por AppShellClinico, mas se
// cairem aqui por bug de rota recebem menu mínimo — nunca menu de consultório.
const navClinicoGestor: NavItem[] = [];
const navClinicoFallback: NavItem[] = [];

const navRodapeConsultorio: NavItem[] = [
  { labelKey: 'nav.plans', icon: CreditCard, path: '/planos' },
  { labelKey: 'nav.profile', icon: UserCog, path: '/perfil' },
];

const navRodapeInstitucional: NavItem[] = [
  { labelKey: 'nav.profile', icon: UserCog, path: '/perfil' },
];

const navRodapeGestor: NavItem[] = [
  { labelKey: 'nav.profile', icon: UserCog, path: '/perfil' },
];

const navRodapeFallback: NavItem[] = [
  { labelKey: 'nav.profile', icon: UserCog, path: '/perfil' },
];

export default function AppShellClinico() {
  const { t } = useTranslation();
  const { user, signOut, profile, loading: authLoading } = useAuth();
  const { profissionalData, loading: profLoading } = useProfissionalData();
  useSyncLanguageWithProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumb = useBreadcrumb();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (authLoading || profLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profissionalData?.nome
    ? profissionalData.nome.split(' ')[0]
    : user?.email?.split('@')[0] || '';

  const planoNome = profissionalData?.planos?.nome ?? '';
  const planoLimite = profissionalData?.planos?.laudos_por_mes ?? profissionalData?.laudos_limite ?? 0;
  const planoLabel = profissionalData
    ? `${t('nav.plans')} ${planoNome} — ${profissionalData.laudos_usados}/${planoLimite} ${t('nav.reports').toLowerCase()}`
    : '';

  const handleNavClick = async (item: NavItem) => {
    if (item.checkLimit && profissionalData) {
      const planoInfo = avaliarPlanoStatus(profissionalData.plano_status, profissionalData.plano_expira_em);
      if (planoInfo.bloqueado) {
        toast({
          title: planoInfo.titulo,
          description: planoInfo.descricao,
          variant: 'destructive',
        });
        navigate('/planos');
        return;
      }
      const { data } = await supabase.rpc('pode_criar_ficha', { p_profissional_id: profissionalData.id });
      if (data !== true) {
        setShowBlockingModal(true);
        return;
      }
    }
    navigate(item.path);
  };

  const isActive = (itemPath: string) => {
    if (itemPath === '/dashboard') {
      return location.pathname === '/dashboard' || (location.pathname.startsWith('/paciente') && !location.pathname.startsWith('/dashboard/metricas'));
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  // Métricas: bloqueada para planos abaixo de Profissional → exibe cadeado.
  const planoAtual = profissionalData?.planos?.slug ?? 'inicial';
  const metricasBloqueada = planoAtual !== 'profissional';

  const renderNavButton = (item: NavItem) => {
    const ehMetricas = item.path === '/dashboard/metricas';
    const bloqueado = ehMetricas && metricasBloqueada;
    const Icon = bloqueado ? Lock : item.icon;

    return (
      <button
        key={item.path}
        onClick={() => handleNavClick(item)}
        title={bloqueado ? 'Disponível no plano Profissional' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive(item.path)
            ? 'bg-[#E8E0FF] text-[#7E69AB]'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          bloqueado && !isActive(item.path) && 'opacity-70'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        {item.path === '/planos' && profissionalData && (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            {profissionalData.planos?.slug ?? '—'}
          </span>
        )}
      </button>
    );
  };

  // Seleção explícita por perfil — sem default permissivo.
  const perfilSidebar: 'consultorio' | 'institucional' | 'gestor' | 'gestor_geral' | 'fallback' =
    profile === null ? 'consultorio' :
    profile === 'institucional' ? 'institucional' :
    profile === 'gestor' ? 'gestor' :
    profile === 'gestor_geral' ? 'gestor_geral' :
    profile === 'consultorio' ? 'consultorio' :
    'fallback';

  const ehConsultorio = perfilSidebar === 'consultorio';

  const itensClinicos =
    perfilSidebar === 'consultorio' ? navClinicoConsultorio :
    perfilSidebar === 'institucional' ? navClinicoInstitucional :
    perfilSidebar === 'gestor' || perfilSidebar === 'gestor_geral' ? navClinicoGestor :
    navClinicoFallback;

  const itensRodape =
    perfilSidebar === 'consultorio' ? navRodapeConsultorio :
    perfilSidebar === 'institucional' ? navRodapeInstitucional :
    perfilSidebar === 'gestor' || perfilSidebar === 'gestor_geral' ? navRodapeGestor :
    navRodapeFallback;

  const SidebarContent = () => (
    <>
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-4">
        {itensClinicos.map(renderNavButton)}
        {itensClinicos.length > 0 && (
          <div className="my-2 border-t" style={{ borderColor: '#E2E8F0' }} />
        )}
        {itensRodape.map(renderNavButton)}
      </nav>

      <div className="shrink-0 border-t border-border px-3 py-3 bg-card">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen flex-col print:block print:h-auto">
      {/* Header */}
      <header className="shrink-0 z-50 flex h-16 items-center border-b border-border bg-card px-4 print:hidden">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="mr-3 md:hidden text-muted-foreground hover:text-foreground"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="font-heading text-xs font-bold text-primary">DM</span>
          </div>
          <span className="hidden sm:inline font-heading text-base font-semibold" style={{ color: '#2D2B55' }}>
            MARI
          </span>
        </Link>

        <div className="flex-1" />

        {/* Plan badge */}
        {planoLabel && ehConsultorio && (
          <button
            onClick={() => navigate('/planos')}
            className="hidden lg:inline-flex items-center rounded-full px-3 py-1 text-xs font-medium mr-4"
            style={{ backgroundColor: '#F1F0FB', color: '#7E69AB' }}
          >
            {planoLabel}
          </button>
        )}

        {/* Greeting */}
        <span className="hidden md:inline text-sm mr-3" style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('dashboard.welcome', { name: `Dr(a). ${firstName}` })}
        </span>

        {/* Language switcher */}
        <LanguageSwitcher variant="compact" />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <UserCog className="h-4 w-4 mr-2" /> {t('nav.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Banners globais */}
      <BannerStatusPlano />
      {perfilSidebar !== 'institucional' && <BannerUsoLaudos />}

      <div className="flex flex-1 min-h-0 overflow-hidden print:block print:overflow-visible print:h-auto print:min-h-0">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card print:hidden h-full overflow-hidden">
          <SidebarContent />
        </aside>

        {/* Mobile overlay sidebar */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-foreground/20 md:hidden print:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-card shadow-xl md:hidden print:hidden animate-fade-in overflow-hidden"
              style={{ top: '64px' }}
            >
              <SidebarContent />
            </aside>
          </>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-background print:overflow-visible">
          {/* Breadcrumb */}
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

      <BlockingModal
        open={showBlockingModal}
        onClose={() => setShowBlockingModal(false)}
        planoNome={profissionalData?.planos?.nome}
      />
    </div>
  );
}
