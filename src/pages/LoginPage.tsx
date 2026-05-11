import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, getRedirectPath } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import mariLogo from '@/assets/mari-logo.png';

const MARKETING_GRADIENT =
  'linear-gradient(135deg, #7C4DBA 0%, #6B5BB5 45%, #2C7A8C 100%)';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const isFormValid = email.trim() !== '' && password.length >= 6;

  useEffect(() => {
    if (!submitted || loading) return;
    if (!user) return;
    if (profile === null) {
      navigate('/onboarding', { replace: true });
      return;
    }
    if (profile) {
      navigate(getRedirectPath(profile), { replace: true });
    }
  }, [submitted, loading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      const msg = error.toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials')) {
        setError(t('auth.invalidCredentials'));
      } else {
        setError(error);
      }
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Coluna do degradê — em mobile vira faixa superior */}
      <aside
        className="relative flex flex-col items-center justify-center px-6 py-10 text-white lg:py-12"
        style={{ background: MARKETING_GRADIENT }}
        aria-hidden="true"
      >
        <img
          src={mariLogo}
          alt="MARI — Maternal ARtificial Intelligence"
          className="w-full max-w-[260px] lg:max-w-[360px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        />
        <p className="mt-6 max-w-sm text-center font-heading text-sm font-medium leading-relaxed text-white/90 lg:mt-8 lg:text-base">
          {t('auth.appTagline')}
        </p>
        <p className="absolute bottom-4 text-[10px] uppercase tracking-[0.2em] text-white/50 hidden lg:block">
          © 2026 MARI · Maternal ARtificial Intelligence
        </p>
      </aside>

      {/* Coluna do formulário */}
      <main className="relative flex items-center justify-center px-4 py-10 lg:py-12">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-[0_8px_32px_-12px_rgba(124,77,186,0.18)]">
            <h1 className="mb-1 font-heading text-2xl font-semibold text-foreground">
              {t('auth.loginTitle')}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {t('auth.appName')} · {t('auth.appTagline').split('.')[0]}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  {t('auth.emailLabel')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t('auth.passwordLabel')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground transition-all hover:bg-[linear-gradient(135deg,#9b87f5_0%,#7E69AB_100%)] hover:shadow-md"
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.loginButton')
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/recuperar-senha"
                  className="text-sm text-primary transition-colors hover:underline"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground lg:hidden">
            © 2026 MARI
          </p>
        </div>
      </main>
    </div>
  );
}
