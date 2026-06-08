import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

export default function NovaSenhaPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hasPkceCode = /[?&]code=/.test(search);
    const hasHashFlow = hash.includes('type=');

    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      setIsRecovery(true);
      setIsFirstAccess(true);
    } else if (hash.includes('type=recovery')) {
      setIsRecovery(true);
      // Convite admin usa type=recovery — tratar como primeiro acesso.
      setIsFirstAccess(true);
    }
    if (hash.includes('error=access_denied') || hash.includes('error_code=')) {
      setExpired(true);
      setChecking(false);
      return;
    }

    // Fluxo PKCE: link de recovery chega como ?code=xxx; o cliente troca automaticamente.
    if (hasPkceCode) {
      setIsRecovery(true);
      setIsFirstAccess(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setIsFirstAccess(true);
        setChecking(false);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (hasPkceCode || hasHashFlow) {
          setIsRecovery(true);
        }
        setChecking(false);
      }
    });

    if (!hasPkceCode && !hasHashFlow) {
      setChecking(false);
      return () => subscription.unsubscribe();
    }

    const timer = setTimeout(() => setChecking(false), 2500);
    return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (success) {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            navigate('/login', { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdownRef.current);
    }
  }, [success, navigate]);

  const passwordLongEnough = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = passwordLongEnough && passwordsMatch && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      const msg = (error.message || '').toLowerCase();
      console.error('[NovaSenha] updateUser error:', error);
      if (msg.includes('expired') || msg.includes('jwt') || msg.includes('session')) {
        setExpired(true);
      } else if (msg.includes('different') || msg.includes('same as')) {
        setError('A nova senha deve ser diferente da senha atual. Escolha outra.');
      } else if (msg.includes('pwned') || msg.includes('compromis') || msg.includes('weak') || msg.includes('breach')) {
        setError('Esta senha aparece em vazamentos públicos. Escolha uma senha mais forte.');
      } else if (msg.includes('characters') || msg.includes('length') || msg.includes('short')) {
        setError('A senha não atende aos requisitos mínimos de tamanho.');
      } else {
        setError(error.message || t('auth.updatePasswordError'));
      }
      return;
    }

    setSuccess(true);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (expired || (!isRecovery && !success)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <span className="font-heading text-2xl font-bold text-primary">DM</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center">
            <p className="text-sm text-foreground font-medium">
              {t('auth.linkExpiredTitle')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('auth.linkExpiredDesc')}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/recuperar-senha"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t('auth.requestNewLink')}
              </Link>
              <Link
                to="/login"
                className="text-sm text-primary hover:underline transition-colors"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <span className="font-heading text-2xl font-bold text-primary">DM</span>
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {isFirstAccess ? t('auth.firstAccessTitle') : t('auth.newPasswordTitle')}
          </h1>
          {isFirstAccess && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('auth.firstAccessSubtitle')}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {success ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-[hsl(var(--clinical-normal-icon))]" />
              <p className="text-sm font-medium text-foreground">
                {t('auth.passwordUpdated')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('auth.redirectingIn', { count: countdown })}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t('auth.newPassword')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
                {password.length > 0 && (
                  <p className={`text-xs ${passwordLongEnough ? 'text-[hsl(var(--clinical-normal-text))]' : 'text-destructive'}`}>
                    {passwordLongEnough ? '✓' : '✗'} {t('auth.minChars')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  {t('auth.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">{t('auth.passwordsDontMatch')}</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.saving')}
                  </>
                ) : (
                  t('auth.saveNewPassword')
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
