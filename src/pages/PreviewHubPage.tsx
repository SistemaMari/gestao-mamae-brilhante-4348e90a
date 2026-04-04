import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  Shield,
  Stethoscope,
  KeyRound,
  Users,
  UserPlus,
  LucideIcon,
  Mail,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import ProfileForm, { ProfileFormData } from '@/components/ProfileForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { especialidades, idiomas } from '@/data/locationData';

interface PreviewCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const previewCards: PreviewCardProps[] = [
  {
    to: '/vitrine/completar-perfil',
    title: 'Completar perfil',
    description: 'Veja e edite visualmente o formulário real sem bloqueio de login.',
    icon: ClipboardList,
  },
  {
    to: '/recuperar-senha',
    title: 'Recuperar senha',
    description: 'Tela de solicitação de recuperação de senha por e-mail.',
    icon: KeyRound,
  },
  {
    to: '/planos',
    title: 'Planos',
    description: 'Abra a página pública de planos exatamente como está hoje.',
    icon: Stethoscope,
  },
  {
    to: '/vitrine/dashboard',
    title: 'Dashboard clínico',
    description: 'Visualize a tela atual do módulo clínico sem autenticação.',
    icon: LayoutDashboard,
  },
  {
    to: '/vitrine/gestao',
    title: 'Dashboard de gestão',
    description: 'Abra a área institucional em construção sem depender de perfil.',
    icon: Shield,
  },
  {
    to: '/vitrine/admin',
    title: 'Dashboard admin',
    description: 'Confira a tela administrativa atual sem passar pelo login.',
    icon: Shield,
  },
  {
    to: '/vitrine/consolidar',
    title: 'Consolidação',
    description: 'Veja a área de consolidação em construção em um clique.',
    icon: ClipboardList,
  },
  {
    to: '/vitrine/gestao/equipe',
    title: 'Gerenciar Equipe',
    description: 'Prévia funcional da tela do gestor para convidar e gerenciar profissionais.',
    icon: Users,
  },
  {
    to: '/vitrine/cadastro-convite',
    title: 'Cadastro via Convite',
    description: 'Prévia funcional do formulário público recebido por convite.',
    icon: UserPlus,
  },
];

function PreviewCard({ to, title, description, icon: Icon }: PreviewCardProps) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export default function PreviewHubPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Vitrine liberada sem login
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Veja tudo o que está sendo criado
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Agora o preview abre direto nesta vitrine pública para você acompanhar a construção antes dos testes reais com autenticação.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previewCards.map((card) => (
              <PreviewCard key={card.to} {...card} />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ir para o login real
            </Link>
            <a
              href="https://id-preview--8b197c7e-b34e-494b-a96f-525cfb50face.lovable.app/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Abrir link direto da vitrine
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PreviewCompletarPerfilPage() {
  const handleSubmit = async (_data: ProfileFormData) => {
    toast.success('Prévia visual liberada. O salvamento real fica para a etapa de testes.');
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="mb-6 text-center">
          <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Prévia visual do formulário real
          </p>
          <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">
            Complete seu perfil profissional
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta rota existe para você visualizar a construção sem depender de login nem redirecionamentos.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ProfileForm
            initialData={{
              nome: 'Dra. Mari Exemplo',
              email: 'teste@dramari.com',
              pais: 'Brasil',
              idioma: 'pt-BR',
              identificador_padrao: 'nenhum',
            }}
            onSubmit={handleSubmit}
            isLoading={false}
            submitLabel="Salvar e continuar"
          />
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm font-medium text-primary transition-colors hover:opacity-80">
            Voltar para a vitrine
          </Link>
        </div>
      </div>
    </main>
  );
}

type PreviewMemberStatus = 'ativo' | 'pendente' | 'expirado';

interface PreviewMember {
  id: string;
  nome: string;
  email: string;
  crm: string;
  especialidade: string;
  status: PreviewMemberStatus;
}

const initialMembers: PreviewMember[] = [
  {
    id: '1',
    nome: 'Dra. Ana Silva',
    email: 'ana.silva@dramari.com',
    crm: 'CRM 12345',
    especialidade: 'Obstetrícia',
    status: 'ativo',
  },
  {
    id: '2',
    nome: 'Dr. Pedro Costa',
    email: 'pedro.costa@dramari.com',
    crm: 'CRM 98321',
    especialidade: 'Endocrinologia',
    status: 'ativo',
  },
  {
    id: '3',
    nome: 'juliana@clinica.com',
    email: 'juliana@clinica.com',
    crm: '—',
    especialidade: '—',
    status: 'pendente',
  },
  {
    id: '4',
    nome: 'carla@hospital.com',
    email: 'carla@hospital.com',
    crm: '—',
    especialidade: '—',
    status: 'expirado',
  },
];

function StatusBadge({ status }: { status: PreviewMemberStatus }) {
  if (status === 'ativo') {
    return <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">Ativo</Badge>;
  }

  if (status === 'pendente') {
    return <Badge variant="outline" className="bg-accent text-accent-foreground">Convite pendente</Badge>;
  }

  return <Badge variant="outline" className="bg-muted text-muted-foreground">Convite expirado</Badge>;
}

export function PreviewGestaoEquipePage() {
  const [members, setMembers] = useState<PreviewMember[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');

  const activeCount = members.filter((member) => member.status === 'ativo').length;
  const pendingCount = members.filter((member) => member.status === 'pendente').length;
  const expiredCount = members.filter((member) => member.status === 'expirado').length;

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Digite um e-mail válido para a prévia.');
      return;
    }

    setMembers((current) => [
      {
        id: `${Date.now()}`,
        nome: inviteEmail,
        email: inviteEmail,
        crm: '—',
        especialidade: '—',
        status: 'pendente',
      },
      ...current,
    ]);
    setInviteEmail('');
    toast.success('Convite simulado enviado na vitrine.');
  };

  const handleAction = (member: PreviewMember) => {
    if (member.status === 'ativo') {
      setMembers((current) => current.filter((item) => item.id !== member.id));
      toast.success('Profissional removido da lista de prévia.');
      return;
    }

    setMembers((current) =>
      current.map((item) =>
        item.id === member.id
          ? { ...item, status: 'pendente' }
          : item
      )
    );
    toast.success('Convite simulado reenviado.');
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="text-sm font-medium text-primary transition-opacity hover:opacity-80">
              ← Voltar para a vitrine
            </Link>
            <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Gerenciar Equipe</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Prévia funcional da área do gestor para convidar, reenviar e remover profissionais.
            </p>
          </div>
          <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
            <Mail className="h-4 w-4" />
            Enviar convite
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Profissionais ativos</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Convites pendentes</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Convites expirados</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{expiredCount}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="preview-invite-email">Convidar profissional</Label>
              <Input
                id="preview-invite-email"
                type="email"
                placeholder="profissional@clinica.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
              <UserPlus className="h-4 w-4" />
              Convidar profissional
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Equipe da unidade</h2>
          </div>
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{member.nome}</p>
                    <StatusBadge status={member.status} />
                  </div>
                  <div className="mt-1 grid gap-1 text-sm text-muted-foreground md:grid-cols-3">
                    <p>{member.email}</p>
                    <p>{member.crm}</p>
                    <p>{member.especialidade}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {member.status === 'ativo' ? (
                    <Button variant="outline" onClick={() => handleAction(member)}>
                      <Trash2 className="h-4 w-4" />
                      Remover da unidade
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => handleAction(member)}>
                      <RefreshCw className="h-4 w-4" />
                      {member.status === 'pendente' ? 'Reenviar convite' : 'Gerar novo convite'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function PreviewCadastroConvitePage() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [crmCoren, setCrmCoren] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [idioma, setIdioma] = useState('pt-BR');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!nome || !senha || !confirmarSenha || !crmCoren || !especialidade) {
      toast.error('Preencha todos os campos da prévia.');
      return;
    }

    if (senha.length < 6) {
      toast.error('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setSubmitted(true);
    toast.success('Cadastro simulado com sucesso na vitrine.');
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-[520px] rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">Prévia concluída com sucesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nesta etapa visual, o cadastro não grava dados reais. O objetivo aqui é validar a experiência do formulário.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/">
              <Button variant="outline">Voltar para a vitrine</Button>
            </Link>
            <Link to="/login">
              <Button>Ir para o login</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-6 text-center">
          <Link to="/" className="text-sm font-medium text-primary transition-opacity hover:opacity-80">
            ← Voltar para a vitrine
          </Link>
          <p className="mt-4 inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Prévia funcional sem token real
          </p>
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
            Você foi convidado(a) para a Clínica Materna Exemplo
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta versão da vitrine mostra a experiência do cadastro sem depender de convite verdadeiro no backend.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value="convidado@dramari.com" disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-nome">Nome completo *</Label>
              <Input id="preview-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preview-senha">Senha *</Label>
                <Input
                  id="preview-senha"
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-confirmar">Confirmar senha *</Label>
                <Input
                  id="preview-confirmar"
                  type="password"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-crm">CRM / COREN *</Label>
              <Input id="preview-crm" value={crmCoren} onChange={(event) => setCrmCoren(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Especialidade *</Label>
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {especialidades.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Idioma preferido</Label>
              <Select value={idioma} onValueChange={setIdioma}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {idiomas.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full">
              Criar conta na prévia
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
