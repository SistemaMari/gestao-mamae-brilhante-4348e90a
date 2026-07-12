import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { useSyncLanguageWithProfile } from '@/hooks/useSyncLanguageWithProfile';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, UserPlus, CreditCard, UserCog, LogOut, Menu, X,
  ChevronRight, User, Loader2, BarChart3, FileText, GraduationCap, Lock, PlayCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import BlockingModal from '@/components/BlockingModal';
import BannerUsoLaudos from '@/components/BannerUsoLaudos';
import BannerStatusPlano from '@/components/BannerStatusPlano';
import TelaInadimplente from '@/components/TelaInadimplente';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { avaliarPlanoStatus } from '@/lib/planoStatus';
import { toast } from '@/hooks/use-toast';
import mariLogo from '@/assets/mari-logo.png';

function iniciaisNome(nome?: string | null) {
  if (!nome) return 'US';
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

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
  { labelKey: 'Tutorial', icon: PlayCircle, path: '/tutorial' },
  { labelKey: 'nav.metrics', icon: BarChart3, path: '/dashboard/metricas' },
  { labelKey: 'nav.plans', icon: CreditCard, path: '/planos' },
];

const navClinicoInstitucional: NavItem[] = [
  { labelKey: 'nav.patients', icon: Users, path: '/dashboard' },
  { labelKey: 'nav.newPatient', icon: UserPlus, path: '/paciente/nova', checkLimit: true },
  { labelKey: 'Tutorial', icon: PlayCircle, path: '/tutorial' },
];

// Gestor / gestor_geral normalmente não passam por AppShellClinico, mas se
// cairem aqui por bug de rota recebem menu mínimo — nunca menu de consultório.
const navClinicoGestor: NavItem[] = [];
const navClinicoFallback: NavItem[] = [];

const navRodapeConsultorio: NavItem[] = [];

const navRodapeInstitucional: NavItem[] = [];


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

  // ── Gate de inadimplência: bloqueia acesso total quando plano_status ──
  // não está ativo (inadimplente, suspenso, cancelado, expirado por data).
  if (profissionalData) {
    const planoInfo = avaliarPlanoStatus(
      profissionalData.plano_status,
      profissionalData.plano_expira_em,
      profissionalData.proxima_renovacao,
    );
    if (planoInfo.bloqueado) {
      return (
        <TelaInadimplente
          info={planoInfo}
          planoSlug={profissionalData.planos?.slug}
        />
      );
    }
  }

  const firstName = profissionalData?.nome
    ? profissionalData.nome.split(' ')[0]
    : user?.email?.split('@')[0] || '';

  const planoNome = profissionalData?.planos?.nome ?? '';
  const planoLimite = profissionalData?.planos?.laudos_por_mes ?? profissionalData?.laudos_limite ?? 0;
  const laudosUsados = profissionalData?.laudos_usados ?? 0;
  const consumoPct = planoLimite > 0
    ? Math.min(100, Math.round((laudosUsados / planoLimite) * 100))
    : 0;
  const consumoCor = consumoPct >= 100 ? '#EF4444' : consumoPct >= 80 ? '#F59E0B' : '#7E69AB';

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
      // 38B-C (#18): "Pacientes" acende em /dashboard e ao abrir uma ficha
      // (/paciente/:id), mas NÃO em /paciente/nova — lá quem acende é "Nova paciente".
      return location.pathname === '/dashboard'
        || (location.pathname.startsWith('/paciente')
            && !location.pathname.startsWith('/paciente/nova')
            && !location.pathname.startsWith('/dashboard/metricas'));
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
        {item.path === '/planos' && profissionalData?.planos?.nome && (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground capitalize">
            {profissionalData.planos.nome}
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

  const ehInstitucional = perfilSidebar === 'institucional';
  const usaEstiloInstitucional = ehInstitucional || ehConsultorio;
  const perfilAtivo = location.pathname === '/perfil' || location.pathname.startsWith('/perfil/');

  const SidebarContent = () => (
    <>
      {ehInstitucional && (
        <div className="shrink-0 border-b border-[#E2E8F0] p-3 bg-white">
          <img
            src={mariLogo}
            alt="MARI — Maternal ARtificial Intelligence"
            className="w-full rounded-lg"
          />
        </div>
      )}

      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-4">
        {itensClinicos.map((item) => (
          <div key={item.path}>
            {ehInstitucional && item.path === '/tutorial' && (
              <div className="my-2 border-t" style={{ borderColor: '#E2E8F0' }} />
            )}
            {renderNavButton(item)}
          </div>
        ))}
        {itensClinicos.length > 0 && itensRodape.length > 0 && (
          <div className="my-2 border-t" style={{ borderColor: '#E2E8F0' }} />
        )}
        {itensRodape.map(renderNavButton)}
      </nav>


      {ehInstitucional ? (
        <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F5F0FF] p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #7E69AB, #9b87f5)', fontFamily: 'Sora, sans-serif' }}
            >
              {iniciaisNome(profissionalData?.nome || firstName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1E293B]" style={{ fontFamily: 'Sora, sans-serif' }}>
                {profissionalData?.nome || firstName || 'Usuário'}
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
            <UserCog className="h-4 w-4 shrink-0" />
            {t('nav.profile')}
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
        </div>
      ) : (
        <div className="shrink-0 border-t border-border px-3 py-3 bg-card">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>{t('common.logout')}</span>
          </button>
        </div>
      )}
    </>
  );


  return (
    <div className="flex h-screen flex-col print:block print:h-auto">
      {/* Floating top-right controls (no header bar) */}
      <div className="pointer-events-none fixed top-3 right-4 z-50 flex items-center gap-3 print:hidden">
        {profissionalData && ehConsultorio && (
          <button
            onClick={() => navigate('/planos')}
            className="pointer-events-auto hidden lg:flex items-center gap-3 rounded-full pl-3 pr-4 py-1.5 text-xs font-medium hover:opacity-90 transition shadow-sm"
            style={{ backgroundColor: '#F1F0FB', color: '#7E69AB' }}
            title={`${laudosUsados} de ${planoLimite} ${t('nav.reports').toLowerCase()} este mês`}
          >
            <span className="font-semibold">{t('nav.plans')} {planoNome}</span>
            <span className="flex items-center gap-2">
              <span
                className="relative block h-1.5 w-24 rounded-full overflow-hidden"
                style={{ backgroundColor: '#E2DEF5' }}
              >
                <span
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${consumoPct}%`, backgroundColor: consumoCor }}
                />
              </span>
              <span className="tabular-nums" style={{ color: consumoCor }}>
                {laudosUsados}/{planoLimite}
              </span>
            </span>
          </button>
        )}
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
