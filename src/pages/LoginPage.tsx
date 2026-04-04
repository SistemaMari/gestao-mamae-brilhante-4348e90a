import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const isFormValid = email.trim() !== '' && (resetMode || password.length >= 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (resetMode) {
      setIsLoading(true);
      const { error } = await resetPassword(email);
      setIsLoading(false);
      if (error) {
        setError(error);
      } else {
        setResetSent(true);
      }
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      setIsLoading(false);
      setError(error);
      return;
    }

    // Aguardar o AuthContext determinar o perfil e redirecionar
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 300));
      const { data } = await supabase.auth.getUser();
      if (!data.user) continue;

      const { data: admin } = await supabase.from('admins').select('id').eq('user_id', data.user.id).maybeSingle();
      if (admin) { navigate('/admin', { replace: true }); return; }

      const { data: gestorGeral } = await supabase.from('gestores_gerais').select('id').eq('user_id', data.user.id).maybeSingle();
      if (gestorGeral) { navigate('/consolidar', { replace: true }); return; }

      const { data: prof } = await supabase.from('profissionais').select('unidade_id, perfil_institucional').eq('user_id', data.user.id).maybeSingle();
      if (!prof) {
        setIsLoading(false);
        setError('Conta não vinculada a nenhum perfil. Entre em contato com o suporte.');
        return;
      }

      if (!prof.unidade_id) { navigate('/dashboard', { replace: true }); return; }
      if (prof.perfil_institucional === 'gestor') { navigate('/gestao', { replace: true }); return; }
      navigate('/dashboard', { replace: true });
      return;
    }
    setIsLoading(false);
    setError('Tempo esgotado. Tente novamente.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] animate-fade-in">
        {/* Logo placeholder */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <span className="font-heading text-2xl font-bold text-primary">DM</span>
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Dra. Mari DMG Diagnóstica
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de apoio à decisão clínica
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">
            {resetMode ? 'Recuperar senha' : 'Entrar'}
          </h2>

          {resetSent ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent p-4">
                <p className="text-sm text-accent-foreground">
                  E-mail de recuperação enviado para <strong>{email}</strong>. Verifique sua caixa de entrada.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setResetMode(false); setResetSent(false); setError(''); }}
              >
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {!resetMode && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
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
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

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
                    {resetMode ? 'Enviando...' : 'Entrando...'}
                  </>
                ) : (
                  resetMode ? 'Enviar e-mail de recuperação' : 'Entrar'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setResetMode(!resetMode); setError(''); setResetSent(false); }}
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  {resetMode ? 'Voltar ao login' : 'Esqueci minha senha'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Quer só visualizar o que já foi criado?{' '}
            <Link to="/" className="font-medium text-primary transition-colors hover:opacity-80">
              Abrir vitrine sem login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
