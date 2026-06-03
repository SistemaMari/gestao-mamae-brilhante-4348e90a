import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, getRedirectPath } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import mariLogo from '@/assets/mari-logo.png';

const GOOGLE_FLAG_KEY = 'mari_google_oauth_attempt';


const MARKETING_GRADIENT =
  'linear-gradient(135deg, #7C4DBA 0%, #6B5BB5 45%, #2C7A8C 100%)';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const isFormValid = email.trim() !== '' && password.length >= 6;

  // Detecta retorno do OAuth Google ainda no carregamento inicial — antes do user resolver.
  useEffect(() => {
    if (sessionStorage.getItem(GOOGLE_FLAG_KEY) === '1') {
      setSubmitted(true);
    }
  }, []);

  useEffect(() => {
    if (!submitted || loading) return;
    if (!user) return;

    const viaGoogle = sessionStorage.getItem(GOOGLE_FLAG_KEY) === '1';

    if (profile === null) {
      if (viaGoogle) {
        // Conta Google não corresponde a nenhum usuário cadastrado — bloquear.
        sessionStorage.removeItem(GOOGLE_FLAG_KEY);
        supabase.auth.signOut().finally(() => {
          setError('Este e-mail Google não está cadastrado. Solicite acesso ao administrador.');
          setSubmitted(false);
          setIsGoogleLoading(false);
        });
        return;
      }
      navigate('/onboarding', { replace: true });
      return;
    }
    if (profile) {
      sessionStorage.removeItem(GOOGLE_FLAG_KEY);
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

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    sessionStorage.setItem(GOOGLE_FLAG_KEY, '1');
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin + '/login',
      });
      if (result.error) {
        sessionStorage.removeItem(GOOGLE_FLAG_KEY);
        setIsGoogleLoading(false);
        setError('Não foi possível iniciar o login com Google. Tente novamente.');
        return;
      }
      if (result.redirected) return; // Browser está redirecionando
      // Tokens já setados — disparar fluxo de verificação
      setSubmitted(true);
    } catch {
      sessionStorage.removeItem(GOOGLE_FLAG_KEY);
      setIsGoogleLoading(false);
      setError('Não foi possível iniciar o login com Google. Tente novamente.');
    }
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

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
                    ou
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
                  </svg>
                )}
                Entrar com Google
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
