import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Settings, LogOut, ChevronLeft, ChevronRight,
  Building2, BarChart3, ShieldCheck, UserPlus, Activity, BookOpen, GraduationCap
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const navByProfile: Record<string, NavItem[]> = {
  consultorio: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Fichas', icon: FileText, path: '/dashboard' },
    { label: 'Configurações', icon: Settings, path: '/dashboard' },
    { label: 'Meus Cursos', icon: GraduationCap, path: '/meus-cursos' },
  ],
  institucional: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Fichas', icon: FileText, path: '/dashboard' },
    { label: 'Configurações', icon: Settings, path: '/dashboard' },
    { label: 'Meus Cursos', icon: GraduationCap, path: '/meus-cursos' },
  ],
  gestor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/gestao' },
    { label: 'Equipe', icon: Users, path: '/gestao/equipe' },
    { label: 'Relatórios', icon: BarChart3, path: '/gestao' },
    { label: 'Configurações', icon: Settings, path: '/gestao' },
  ],
  gestor_geral: [
    { label: 'Consolidação', icon: BarChart3, path: '/consolidar' },
    { label: 'Unidades', icon: Building2, path: '/consolidar' },
    { label: 'Relatórios', icon: FileText, path: '/consolidar' },
  ],
  admin: [
    { label: 'Painel', icon: ShieldCheck, path: '/admin' },
    { label: 'Usuários', icon: Users, path: '/admin' },
    { label: 'Unidades', icon: Building2, path: '/admin' },
    { label: 'Convites', icon: UserPlus, path: '/admin' },
    { label: 'Base de Conhecimento', icon: BookOpen, path: '/admin/base-conhecimento' },
    { label: 'Monitoramento', icon: Activity, path: '/admin' },
  ],
};

export default function AppSidebar() {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const items = navByProfile[profile || 'consultorio'] || navByProfile.consultorio;

  const profileLabels: Record<string, string> = {
    consultorio: 'Consultório',
    institucional: 'Institucional',
    gestor: 'Gestor',
    gestor_geral: 'Gestor Geral',
    admin: 'Administrador',
  };

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
              {!collapsed && <span>{item.label}</span>}
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
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
