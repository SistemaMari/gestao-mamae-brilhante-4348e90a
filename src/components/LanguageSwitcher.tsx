import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Globe } from 'lucide-react';
import { LANGUAGE_META, SUPPORTED_LANGUAGES, type SupportedLanguage, normalizeLang } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LanguageSwitcherProps {
  variant?: 'icon' | 'compact' | 'full';
  align?: 'start' | 'end' | 'center';
}

export default function LanguageSwitcher({ variant = 'compact', align = 'end' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const current = normalizeLang(i18n.language);

  const change = async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('app.lang', lang);
    document.documentElement.lang = lang;

    // Persistir no perfil se logado (silencioso)
    if (user) {
      try {
        await supabase
          .from('profissionais')
          .update({ idioma: lang })
          .eq('user_id', user.id);
      } catch {
        // silencioso — preferência local já está salva
      }
    }

    toast.success(t('language.changed', { lang: LANGUAGE_META[lang].label }));
  };

  const meta = LANGUAGE_META[current];

  const flagSrc: Record<SupportedLanguage, string> = {
    'pt-BR': 'https://flagcdn.com/w40/br.png',
    'en-US': 'https://flagcdn.com/w40/us.png',
    'es': 'https://flagcdn.com/w40/es.png',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t('language.selectLanguage')}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:shadow-md hover:border-primary/40"
          style={{ backgroundColor: '#F5F0FF', borderColor: '#E2DEF5', color: '#2D2B55' }}
        >
          <img
            src={flagSrc[current]}
            alt=""
            className="h-4 w-6 rounded-sm object-cover"
          />
          <span className="leading-none tracking-wide">{meta.short}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px]">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const m = LANGUAGE_META[lang];
          const isCurrent = lang === current;
          return (
            <DropdownMenuItem
              key={lang}
              onClick={() => change(lang)}
              className="gap-2 cursor-pointer"
            >
              <img src={flagSrc[lang]} alt="" className="h-4 w-6 rounded-sm object-cover" />
              <span className="flex-1">{m.label}</span>
              {isCurrent && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export ícone para uso opcional
export { Globe };
