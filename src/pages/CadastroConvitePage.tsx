import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { especialidades, idiomas } from '@/data/locationData';

type ConviteStatus = 'loading' | 'valido' | 'invalido' | 'expirado' | 'usado' | 'email_existente';

interface ConviteData {
  id: string;
  email_convidado: string;
  unidade_id: string;
  token: string;
  unidade_nome?: string;
}

export default function CadastroConvitePage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<ConviteStatus>('loading');
  const [convite, setConvite] = useState<ConviteData | null>(null);

  // Form fields
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [crmCoren, setCrmCoren] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Countdown after success
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!token) { setStatus('invalido'); return; }
    validateToken();
  }, [token]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { navigate('/login', { replace: true }); return; }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  const validateToken = async () => {
    try {
      const res = await supabase.functions.invoke('validar-convite', {
        body: { token },
      });
      const data = res.data as
        | { status: 'valido'; email_convidado: string; unidade_nome: string }
        | { status: 'invalido' | 'expirado' | 'usado' | 'erro' }
        | null;

      if (!data || data.status === 'erro' || data.status === 'invalido') {
        setStatus('invalido');
        return;
      }
      if (data.status === 'expirado' || data.status === 'usado') {
        setStatus(data.status);
        return;
      }
      if (data.status !== 'valido') {
        setStatus('invalido');
        return;
      }

      setConvite({
        id: '',
        email_convidado: data.email_convidado,
        unidade_id: '',
        token: token!,
        unidade_nome: data.unidade_nome,
      });
      setStatus('valido');
    } catch {
      setStatus('invalido');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !senha || !crmCoren || !especialidade) {
      toast.error(t('invite.fillRequired'));
      return;
    }

    if (senha.length < 6) {
      toast.error(t('invite.passwordMinError'));
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error(t('auth.passwordsDontMatch'));
      return;
    }

    setSubmitting(true);

    try {
      const res = await supabase.functions.invoke('aceitar-convite', {
        body: {
          token: convite!.token,
          nome,
          senha,
          crm_coren: crmCoren,
          especialidade,
          idioma_preferido: idioma,
        },
      });

      const data = res.data;

      if (data?.status === 'sucesso') {
        toast.success(t('invite.accountCreated'));
        setCountdown(3);
      } else if (data?.status === 'email_existente') {
        // E-mail já tem conta no MARI. Fluxo de vinculação foi descontinuado:
        // cada e-mail = um único modelo (consultório OU institucional).
        setStatus('email_existente');
      } else {
        toast.error(data?.mensagem || t('invite.createError'));
      }
    } catch {
      toast.error(t('invite.createError'));
    }

    setSubmitting(false);
  };

  // Status screens
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'invalido') {
    return (
      <StatusScreen
        icon={<XCircle className="h-12 w-12 text-destructive" />}
        title={t('invite.invalidTitle')}
        description={t('invite.invalidDesc')}
        loginLabel={t('invite.goToLogin')}
      />
    );
  }

  if (status === 'expirado') {
    return (
      <StatusScreen
        icon={<AlertTriangle className="h-12 w-12 text-amber-500" />}
        title={t('invite.expiredTitle')}
        description={t('invite.expiredDesc')}
        loginLabel={t('invite.goToLogin')}
      />
    );
  }

  if (status === 'usado') {
    return (
      <StatusScreen
        icon={<CheckCircle2 className="h-12 w-12 text-secondary" />}
        title={t('invite.usedTitle')}
        description={t('invite.usedDesc')}
        loginLabel={t('invite.goToLogin')}
      />
    );
  }

  if (status === 'email_existente') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-[560px] rounded-xl border border-border bg-card p-8 shadow-sm text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
            {t('invite.emailInUseTitle')}
          </h2>
          <div className="mt-3 space-y-3 text-left text-sm text-muted-foreground">
            <p>
              {t('invite.emailInUseP1')}
            </p>
            <p>
              <strong className="text-foreground">{t('invite.emailInUseHowLabel')}</strong> {t('invite.emailInUseP2')}
            </p>
          </div>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate('/login')}
          >
            {t('invite.backToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  // Countdown overlay
  if (countdown !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-sm text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-secondary" />
          <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
            {t('invite.accountCreated')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('invite.redirectingLoginPrefix')} <span className="font-bold text-foreground">{countdown}</span>...
          </p>
        </div>
      </div>
    );
  }

  // Valid — show form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-heading text-xl font-bold text-foreground">
            {t('invite.invitedTo', { unidade: convite?.unidade_nome })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('invite.fillDataSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (readonly) */}
          <div>
            <Label>{t('common.email')}</Label>
            <Input value={convite?.email_convidado || ''} disabled className="bg-muted" />
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="nome">{t('invite.fullNameLabel')}</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          {/* Senha */}
          <div>
            <Label htmlFor="senha">{t('invite.passwordLabel')}</Label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {senha && senha.length < 6 && (
              <p className="mt-1 text-xs text-destructive">{t('auth.minChars')}</p>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <Label htmlFor="confirmar-senha">{t('invite.confirmPasswordLabel')}</Label>
            <Input
              id="confirmar-senha"
              type={showPassword ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
            {confirmarSenha && senha !== confirmarSenha && (
              <p className="mt-1 text-xs text-destructive">{t('auth.passwordsDontMatch')}</p>
            )}
          </div>

          {/* CRM/COREN */}
          <div>
            <Label htmlFor="crm">{t('invite.crmCorenLabel')}</Label>
            <Input id="crm" value={crmCoren} onChange={(e) => setCrmCoren(e.target.value)} required />
          </div>

          {/* Especialidade */}
          <div>
            <Label>{t('invite.specialtyLabel')}</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger>
                <SelectValue placeholder={t('invite.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {especialidades.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Idioma */}
          <div>
            <Label>{t('invite.preferredLanguageLabel')}</Label>
            <Select value={idioma} onValueChange={setIdioma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {idiomas.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('invite.createAccount')}
          </Button>
        </form>
      </div>
    </div>
  );
}

function StatusScreen({ icon, title, description, loginLabel }: { icon: React.ReactNode; title: string; description: string; loginLabel: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="flex justify-center">{icon}</div>
        <h2 className="mt-4 font-heading text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link to="/login">
          <Button variant="outline" className="mt-6">{loginLabel}</Button>
        </Link>
      </div>
    </div>
  );
}
