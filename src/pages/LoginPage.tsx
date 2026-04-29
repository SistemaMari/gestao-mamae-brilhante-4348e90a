import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, getRedirectPath } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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

  // Once AuthContext has resolved the profile after a successful sign-in, redirect.
  useEffect(() => {
    if (!submitted || loading) return;
    if (!user) return; // ainda propagando
    if (profile === null) {
      // sem perfil vinculado → onboarding
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

    // signIn ok — AuthContext vai resolver o profile e o useEffect acima redireciona
    setSubmitted(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <span className="font-heading text-2xl font-bold text-primary">DM</span>
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t('auth.appName')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('auth.appTagline')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">
            {t('auth.loginTitle')}
          </h2>

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              className="w-full"
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
                className="text-sm text-primary hover:underline transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('auth.previewCta')}{' '}
            <Link to="/" className="font-medium text-primary transition-colors hover:opacity-80">
              {t('auth.previewLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
