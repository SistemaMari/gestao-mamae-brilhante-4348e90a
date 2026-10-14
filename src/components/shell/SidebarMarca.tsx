import type React from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import mariLogo from '@/assets/mari-logo.png';

// Peças do menu lateral no padrão do admin e das profissionais (logo no topo,
// rodapé lilás com identidade). Usadas pelos menus do gestor de unidade e do
// gestor geral — antes cada menu tinha a sua versão (sem logo, rodapé branco).

/** "Regina Demonstração" → "RD". */
function iniciais(nome?: string | null, padrao = 'MA'): string {
  if (!nome) return padrao;
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || padrao;
}

export function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <SidebarHeader className="bg-white border-r border-[#E2E8F0] p-3">
      {collapsed ? (
        <img src={mariLogo} alt="MARI" className="h-9 w-9 rounded-md object-cover" />
      ) : (
        <img src={mariLogo} alt="MARI — Maternal ARtificial Intelligence" className="w-full rounded-lg" />
      )}
    </SidebarHeader>
  );
}

export interface LinkRodape {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Rodapé lilás: avatar + nome + papel/e-mail, links (ex.: Meu perfil) e Sair. */
export function SidebarRodapeUsuario({
  collapsed, nome, papel, email, links, onSair,
}: {
  collapsed: boolean;
  nome: string;
  /** Linha abaixo do nome (ex.: "Gestor de Unidade · Unidade Norte"). */
  papel?: string;
  email?: string;
  links: LinkRodape[];
  onSair: () => void;
}) {
  const { t } = useTranslation();
  const classeLink = (ativo: boolean) => cn(
    'flex items-center gap-2 rounded-md px-2 py-2 text-sm',
    ativo ? 'bg-[#E8E0FF] text-[#7E69AB] font-medium' : 'text-[#64748B] hover:bg-[#F1F5F9]',
  );

  return (
    <SidebarFooter className="border-t border-[#E2E8F0] bg-[#F5F0FF] p-3">
      {!collapsed ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #7E69AB, #9b87f5)', fontFamily: 'Sora, sans-serif' }}
            >
              {iniciais(nome)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#1E293B]" style={{ fontFamily: 'Sora, sans-serif' }}>
                {nome || '—'}
              </p>
              {papel && <p className="truncate text-xs text-[#7E69AB]">{papel}</p>}
              {email && <p className="truncate text-xs text-[#94A3B8]">{email}</p>}
            </div>
          </div>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => classeLink(isActive)}>
              <l.icon className="h-4 w-4 shrink-0" />
              {l.label}
            </NavLink>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={onSair}
            className="w-full justify-start border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('common.logout')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              aria-label={l.label}
              className={({ isActive }) => cn(
                'flex h-9 w-9 items-center justify-center rounded-md',
                isActive ? 'bg-[#E8E0FF] text-[#7E69AB]' : 'text-[#64748B] hover:bg-[#F1F5F9]',
              )}
            >
              <l.icon className="h-4 w-4" />
            </NavLink>
          ))}
          <Button variant="ghost" size="icon" onClick={onSair} className="text-[#64748B] hover:bg-[#F1F5F9]" aria-label={t('common.logout')}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </SidebarFooter>
  );
}
