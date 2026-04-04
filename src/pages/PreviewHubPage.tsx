import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, LayoutDashboard, Shield, Stethoscope, LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import ProfileForm, { ProfileFormData } from '@/components/ProfileForm';

interface PreviewCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const previewCards: PreviewCardProps[] = [
  {
    to: '/preview/completar-perfil',
    title: 'Completar perfil',
    description: 'Veja e edite visualmente o formulário real sem bloqueio de login.',
    icon: ClipboardList,
  },
  {
    to: '/planos',
    title: 'Planos',
    description: 'Abra a página pública de planos exatamente como está hoje.',
    icon: Stethoscope,
  },
  {
    to: '/preview/dashboard',
    title: 'Dashboard clínico',
    description: 'Visualize a tela atual do módulo clínico sem autenticação.',
    icon: LayoutDashboard,
  },
  {
    to: '/preview/gestao',
    title: 'Dashboard de gestão',
    description: 'Abra a área institucional em construção sem depender de perfil.',
    icon: Shield,
  },
  {
    to: '/preview/admin',
    title: 'Dashboard admin',
    description: 'Confira a tela administrativa atual sem passar pelo login.',
    icon: Shield,
  },
  {
    to: '/preview/consolidar',
    title: 'Consolidação',
    description: 'Veja a área de consolidação em construção em um clique.',
    icon: ClipboardList,
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
              Prévia liberada sem login
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Veja tudo o que está sendo criado
            </h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Durante a fase de construção, você pode navegar por telas públicas de prévia antes dos testes reais com autenticação e backend.
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
              href="https://id-preview--8b197c7e-b34e-494b-a96f-525cfb50face.lovable.app/preview"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Abrir link direto da prévia
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
          <Link to="/preview" className="text-sm font-medium text-primary transition-colors hover:opacity-80">
            Voltar para a central de prévias
          </Link>
        </div>
      </div>
    </main>
  );
}
