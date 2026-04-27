import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizeLang } from '@/i18n';

/**
 * Sincroniza o idioma do usuário autenticado:
 * 1. Lê profissionais.idioma do Supabase
 * 2. Aplica no i18n (e localStorage via detector)
 *
 * Só roda 1x por sessão de usuário. Se o usuário trocar via LanguageSwitcher,
 * a UI atualiza imediatamente e o Supabase é atualizado em background.
 */
export function useSyncLanguageWithProfile() {
  const { user } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profissionais')
        .select('idioma')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || !data?.idioma) return;
      const lang = normalizeLang(data.idioma);
      if (i18n.language !== lang) {
        await i18n.changeLanguage(lang);
        localStorage.setItem('app.lang', lang);
        document.documentElement.lang = lang;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, i18n]);
}
