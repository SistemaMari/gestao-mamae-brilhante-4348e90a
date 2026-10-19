import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';

/**
 * Menu lateral (shadcn Sidebar) do admin e dos gestores no celular: lá ele
 * vira uma gaveta que fica aberta por cima da tela. Fecha a gaveta ao trocar
 * de página e informa se os rótulos devem aparecer — no celular sempre
 * aparecem, mesmo que no computador o menu esteja recolhido só nos ícones.
 */
export function useMenuLateralMobile() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  return { collapsed: state === 'collapsed' && !isMobile };
}
