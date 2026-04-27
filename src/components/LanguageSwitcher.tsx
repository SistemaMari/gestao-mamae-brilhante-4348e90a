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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className="gap-2"
          aria-label={t('language.selectLanguage')}
        >
          {variant === 'icon' ? (
            <span className="text-lg leading-none">{meta.flag}</span>
          ) : variant === 'full' ? (
            <>
              <span className="text-lg leading-none">{meta.flag}</span>
              <span>{meta.label}</span>
            </>
          ) : (
            <>
              <span className="text-base leading-none">{meta.flag}</span>
              <span className="text-xs font-medium">{meta.short}</span>
            </>
          )}
        </Button>
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
              <span className="text-lg leading-none">{m.flag}</span>
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
