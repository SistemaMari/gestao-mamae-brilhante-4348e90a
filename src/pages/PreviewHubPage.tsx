import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

interface PreviewCardConfig {
  to: string;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

interface PreviewCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const previewCards: PreviewCardConfig[] = [
  {
    to: '/vitrine/completar-perfil',
    titleKey: 'previewHub.cards.completarPerfil.title',
    descriptionKey: 'previewHub.cards.completarPerfil.description',
    icon: ClipboardList,
  },
  {
    to: '/recuperar-senha',
    titleKey: 'previewHub.cards.recuperarSenha.title',
    descriptionKey: 'previewHub.cards.recuperarSenha.description',
    icon: KeyRound,
  },
  {
    to: '/vitrine/planos',
    titleKey: 'previewHub.cards.planos.title',
    descriptionKey: 'previewHub.cards.planos.description',
    icon: Stethoscope,
  },
  {
    to: '/vitrine/dashboard',
    titleKey: 'previewHub.cards.dashboard.title',
    descriptionKey: 'previewHub.cards.dashboard.description',
    icon: LayoutDashboard,
  },
  {
    to: '/vitrine/perfil',
    titleKey: 'previewHub.cards.perfil.title',
    descriptionKey: 'previewHub.cards.perfil.description',
    icon: UserPlus,
  },
  {
    to: '/vitrine/gestao',
    titleKey: 'previewHub.cards.gestao.title',
    descriptionKey: 'previewHub.cards.gestao.description',
    icon: Shield,
  },
  {
    to: '/vitrine/admin',
    titleKey: 'previewHub.cards.admin.title',
    descriptionKey: 'previewHub.cards.admin.description',
    icon: Shield,
  },
  {
    to: '/vitrine/consolidar',
    titleKey: 'previewHub.cards.consolidar.title',
    descriptionKey: 'previewHub.cards.consolidar.description',
    icon: ClipboardList,
  },
  {
    to: '/vitrine/gestao/equipe',
    titleKey: 'previewHub.cards.equipe.title',
    descriptionKey: 'previewHub.cards.equipe.description',
    icon: Users,
  },
  {
    to: '/vitrine/cadastro-convite',
    titleKey: 'previewHub.cards.cadastroConvite.title',
    descriptionKey: 'previewHub.cards.cadastroConvite.description',
    icon: UserPlus,
  },
  {
    to: '/vitrine/ficha-carimbada',
    titleKey: 'previewHub.cards.fichaCarimbada.title',
    descriptionKey: 'previewHub.cards.fichaCarimbada.description',
    icon: CheckCircle2,
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
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t('previewHub.badge')}
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              {t('previewHub.title')}
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              {t('previewHub.subtitle')}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previewCards.map((card) => (
              <PreviewCard
                key={card.to}
                to={card.to}
                title={t(card.titleKey)}
                description={t(card.descriptionKey)}
                icon={card.icon}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t('previewHub.goToRealLogin')}
            </Link>
            <a
              href="https://id-preview--8b197c7e-b34e-494b-a96f-525cfb50face.lovable.app/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t('previewHub.openDirectLink')}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PreviewCompletarPerfilPage() {
  const { t } = useTranslation();

  const handleSubmit = async (_data: ProfileFormData) => {
    toast.success(t('previewHub.completarPerfil.saveToast'));
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="mb-6 text-center">
          <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t('previewHub.completarPerfil.badge')}
          </p>
          <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">
            {t('previewHub.completarPerfil.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('previewHub.completarPerfil.subtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ProfileForm
            initialData={{
              nome: 'MARI Exemplo',
              email: 'teste@dramari.com',
              pais: 'Brasil',
              idioma: 'pt-BR',
              identificador_padrao: 'nenhum',
            }}
            onSubmit={handleSubmit}
            isLoading={false}
            submitLabel={t('previewHub.completarPerfil.submitLabel')}
          />
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm font-medium text-primary transition-colors hover:opacity-80">
            {t('previewHub.completarPerfil.backToShowcase')}
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
  const { t } = useTranslation();

  if (status === 'ativo') {
    return <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">{t('previewHub.equipe.statusAtivo')}</Badge>;
  }

  if (status === 'pendente') {
    return <Badge variant="outline" className="bg-accent text-accent-foreground">{t('previewHub.equipe.statusPendente')}</Badge>;
  }

  return <Badge variant="outline" className="bg-muted text-muted-foreground">{t('previewHub.equipe.statusExpirado')}</Badge>;
}

export function PreviewGestaoEquipePage() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<PreviewMember[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');

  const activeCount = members.filter((member) => member.status === 'ativo').length;
  const pendingCount = members.filter((member) => member.status === 'pendente').length;
  const expiredCount = members.filter((member) => member.status === 'expirado').length;

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error(t('previewHub.equipe.invalidEmail'));
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
    toast.success(t('previewHub.equipe.inviteSent'));
  };

  const handleAction = (member: PreviewMember) => {
    if (member.status === 'ativo') {
      setMembers((current) => current.filter((item) => item.id !== member.id));
      toast.success(t('previewHub.equipe.removed'));
      return;
    }

    setMembers((current) =>
      current.map((item) =>
        item.id === member.id
          ? { ...item, status: 'pendente' }
          : item
      )
    );
    toast.success(t('previewHub.equipe.inviteResent'));
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">{t('previewHub.equipe.title')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('previewHub.equipe.subtitle')}
            </p>
          </div>
          <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
            <Mail className="h-4 w-4" />
            {t('previewHub.equipe.sendInvite')}
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{t('previewHub.equipe.activeProfessionals')}</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{t('previewHub.equipe.pendingInvites')}</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{t('previewHub.equipe.expiredInvites')}</p>
            <p className="mt-2 font-heading text-3xl font-bold text-foreground">{expiredCount}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="preview-invite-email">{t('previewHub.equipe.inviteProfessional')}</Label>
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
              {t('previewHub.equipe.inviteProfessional')}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">{t('previewHub.equipe.unitTeam')}</h2>
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
                      {t('previewHub.equipe.removeFromUnit')}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => handleAction(member)}>
                      <RefreshCw className="h-4 w-4" />
                      {member.status === 'pendente' ? t('previewHub.equipe.resendInvite') : t('previewHub.equipe.generateNewInvite')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function PreviewCadastroConvitePage() {
  const { t } = useTranslation();
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
      toast.error(t('previewHub.cadastroConvite.fillAll'));
      return;
    }

    if (senha.length < 6) {
      toast.error(t('previewHub.cadastroConvite.passwordMinLength'));
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error(t('previewHub.cadastroConvite.passwordsDontMatch'));
      return;
    }

    setSubmitted(true);
    toast.success(t('previewHub.cadastroConvite.successToast'));
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-[500px] rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">{t('previewHub.cadastroConvite.accountCreated')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('previewHub.cadastroConvite.redirecting')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button>{t('previewHub.cadastroConvite.goToLogin')}</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t('previewHub.cadastroConvite.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('previewHub.cadastroConvite.subtitle')}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('previewHub.cadastroConvite.emailLabel')}</Label>
              <Input value="convidado@dramari.com" disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-nome">{t('previewHub.cadastroConvite.fullNameLabel')}</Label>
              <Input id="preview-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preview-senha">{t('previewHub.cadastroConvite.passwordLabel')}</Label>
                <Input
                  id="preview-senha"
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-confirmar">{t('previewHub.cadastroConvite.confirmPasswordLabel')}</Label>
                <Input
                  id="preview-confirmar"
                  type="password"
                  value={confirmarSenha}
                  onChange={(event) => setConfirmarSenha(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-crm">{t('previewHub.cadastroConvite.crmLabel')}</Label>
              <Input id="preview-crm" value={crmCoren} onChange={(event) => setCrmCoren(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t('previewHub.cadastroConvite.specialtyLabel')}</Label>
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder={t('previewHub.cadastroConvite.specialtyPlaceholder')} />
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
              <Label>{t('previewHub.cadastroConvite.languageLabel')}</Label>
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
              {t('previewHub.cadastroConvite.createAccount')}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
