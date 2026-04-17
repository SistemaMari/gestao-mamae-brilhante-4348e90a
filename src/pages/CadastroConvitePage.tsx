import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<ConviteStatus>('loading');
  const [convite, setConvite] = useState<ConviteData | null>(null);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);

  // Form fields
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [crmCoren, setCrmCoren] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vinculando, setVinculando] = useState(false);

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
    const { data: conviteData, error } = await supabase
      .from('convites')
      .select('id, email_convidado, unidade_id, token, status, expires_at')
      .eq('token', token!)
      .maybeSingle();

    if (!conviteData || error) {
      setStatus('invalido');
      return;
    }

    if (conviteData.status === 'aceito') {
      setStatus('usado');
      return;
    }

    if (new Date(conviteData.expires_at) < new Date()) {
      setStatus('expirado');
      return;
    }

    // Get unit name
    const { data: unidade } = await supabase
      .from('unidades')
      .select('nome')
      .eq('id', conviteData.unidade_id)
      .single();

    setConvite({
      id: conviteData.id,
      email_convidado: conviteData.email_convidado,
      unidade_id: conviteData.unidade_id,
      token: conviteData.token,
      unidade_nome: unidade?.nome || 'Unidade',
    });
    setStatus('valido');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !senha || !crmCoren || !especialidade) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (senha.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error('As senhas não coincidem.');
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
        toast.success('Conta criada com sucesso!');
        setCountdown(3);
      } else if (data?.status === 'email_existente') {
        setExistingUserId(data.user_id);
        setStatus('email_existente');
      } else {
        toast.error(data?.mensagem || 'Erro ao criar conta.');
      }
    } catch {
      toast.error('Erro ao criar conta.');
    }

    setSubmitting(false);
  };

  const handleVincular = async () => {
    if (!existingUserId || !convite) return;
    setVinculando(true);

    try {
      // Need to get the profissional_id from the existing user
      const res = await supabase.functions.invoke('vincular-profissional', {
        body: { token: convite.token, profissional_id: existingUserId },
      });

      if (res.data?.status === 'sucesso') {
        toast.success('Vinculação realizada com sucesso!');
        setCountdown(3);
      } else {
        toast.error(res.data?.mensagem || 'Erro ao vincular.');
      }
    } catch {
      toast.error('Erro ao vincular.');
    }

    setVinculando(false);
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
        title="Este convite não é válido."
        description="O link pode estar incorreto ou o convite foi cancelado."
      />
    );
  }

  if (status === 'expirado') {
    return (
      <StatusScreen
        icon={<AlertTriangle className="h-12 w-12 text-amber-500" />}
        title="Este convite expirou."
        description="Solicite um novo ao gestor da sua unidade."
      />
    );
  }

  if (status === 'usado') {
    return (
      <StatusScreen
        icon={<CheckCircle2 className="h-12 w-12 text-secondary" />}
        title="Este convite já foi utilizado."
        description="Se você já tem conta, faça login."
      />
    );
  }

  if (status === 'email_existente') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-sm text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
            Você já tem uma conta MARI
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Deseja vincular-se a <strong>{convite?.unidade_nome}</strong>?
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={handleVincular} disabled={vinculando}>
              {vinculando && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, vincular-me
            </Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Não, manter minha conta individual
            </Button>
          </div>
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
            Conta criada com sucesso!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecionando para o login em <span className="font-bold text-foreground">{countdown}</span>...
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
            Você foi convidado(a) para a {convite?.unidade_nome}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha seus dados para acessar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (readonly) */}
          <div>
            <Label>E-mail</Label>
            <Input value={convite?.email_convidado || ''} disabled className="bg-muted" />
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>

          {/* Senha */}
          <div>
            <Label htmlFor="senha">Senha *</Label>
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
              <p className="mt-1 text-xs text-destructive">Mínimo 6 caracteres</p>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <Label htmlFor="confirmar-senha">Confirmar senha *</Label>
            <Input
              id="confirmar-senha"
              type={showPassword ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
            {confirmarSenha && senha !== confirmarSenha && (
              <p className="mt-1 text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>

          {/* CRM/COREN */}
          <div>
            <Label htmlFor="crm">CRM / COREN *</Label>
            <Input id="crm" value={crmCoren} onChange={(e) => setCrmCoren(e.target.value)} required />
          </div>

          {/* Especialidade */}
          <div>
            <Label>Especialidade *</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
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
            <Label>Idioma preferido</Label>
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
            Criar minha conta
          </Button>
        </form>
      </div>
    </div>
  );
}

function StatusScreen({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="flex justify-center">{icon}</div>
        <h2 className="mt-4 font-heading text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Link to="/login">
          <Button variant="outline" className="mt-6">Ir para o login</Button>
        </Link>
      </div>
    </div>
  );
}
