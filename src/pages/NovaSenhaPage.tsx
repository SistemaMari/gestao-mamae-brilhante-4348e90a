import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';

export default function NovaSenhaPage() {
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
  const navigate = useNavigate();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Detectar tipo de acesso via hash e auth state
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
    if (hash.includes('type=invite') || hash.includes('type=signup')) {
      setIsRecovery(true);
      setIsFirstAccess(true);
    }
    if (hash.includes('error=access_denied') || hash.includes('error_code=')) {
      setExpired(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
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
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        setExpired(true);
      } else {
        setError('Erro ao atualizar senha. Tente novamente.');
      }
      return;
    }

    setSuccess(true);
  };

  // Link expirado / inválido
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
              Este link de recuperação expirou ou é inválido.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Solicite um novo link para redefinir sua senha.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/recuperar-senha"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Solicitar novo link
              </Link>
              <Link
                to="/login"
                className="text-sm text-primary hover:underline transition-colors"
              >
                Voltar para o login
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
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <span className="font-heading text-2xl font-bold text-primary">DM</span>
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {isFirstAccess ? 'Defina sua senha' : 'Redefinir senha'}
          </h1>
          {isFirstAccess && (
            <p className="mt-1 text-sm text-muted-foreground">
              Bem-vinda! Crie uma senha para acessar o sistema.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {success ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-[hsl(var(--clinical-normal-icon))]" />
              <p className="text-sm font-medium text-foreground">
                Senha atualizada com sucesso!
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecionando em {countdown}...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nova senha */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
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
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Indicador de requisito mínimo */}
                {password.length > 0 && (
                  <p className={`text-xs ${passwordLongEnough ? 'text-[hsl(var(--clinical-normal-text))]' : 'text-destructive'}`}>
                    {passwordLongEnough ? '✓' : '✗'} Mínimo 6 caracteres
                  </p>
                )}
              </div>

              {/* Confirmar senha */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirmar senha
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
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
                    Salvando...
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
