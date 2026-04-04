import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import UsageWarningBanner from '@/components/UsageWarningBanner';
import { Progress } from '@/components/ui/progress';
import { FileText, Activity, Clock, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user } = useAuth();
  const { profissionalData } = useProfissionalData();

  const usagePercent = profissionalData
    ? Math.round((profissionalData.laudos_usados / profissionalData.laudos_limite) * 100)
    : 0;

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {profissionalData && (
          <UsageWarningBanner
            laudosUsados={profissionalData.laudos_usados}
            laudosLimite={profissionalData.laudos_limite}
          />
        )}

        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Olá, {profissionalData?.nome || user?.email?.split('@')[0] || 'Profissional'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bem-vindo ao seu painel clínico · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Fichas criadas"
              value={0}
              subtitle="Nenhuma ficha ainda"
              icon={FileText}
            />
            <StatCard
              title="Laudos gerados"
              value={profissionalData?.laudos_usados ?? 0}
              subtitle={`de ${profissionalData?.laudos_limite ?? 0} disponíveis`}
              icon={Activity}
            />
            <StatCard
              title="Últimos 7 dias"
              value={0}
              subtitle="fichas criadas"
              icon={Clock}
            />
            <StatCard
              title="Plano"
              value={profissionalData?.plano === 'institucional' ? 'Institucional' : profissionalData?.plano === 'basico' ? 'Básico' : profissionalData?.plano === 'premium' ? 'Premium' : profissionalData?.plano || 'Gratuito'}
              subtitle={profissionalData?.plano_status === 'ativo' ? 'Ativo' : 'Inativo'}
              icon={FileText}
              className={profissionalData?.plano_status !== 'ativo' ? 'border-destructive/30' : ''}
            />
          </div>

          {/* Usage bar */}
          {profissionalData && (
            <div className="mb-8 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Uso de laudos</p>
                <p className="text-sm text-muted-foreground">
                  {profissionalData.laudos_usados} / {profissionalData.laudos_limite}
                </p>
              </div>
              <Progress value={usagePercent} className="h-2.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {usagePercent < 90
                  ? `Você utilizou ${usagePercent}% dos laudos disponíveis no período.`
                  : 'Atenção: seu limite de laudos está próximo do fim.'}
              </p>
            </div>
          )}

          {/* Quick actions */}
          <div className="mb-8">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Ações rápidas</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Nova ficha clínica</p>
                  <p className="text-xs text-muted-foreground">Iniciar avaliação de DMG</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                  <FileText className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Ver fichas</p>
                  <p className="text-xs text-muted-foreground">Acessar fichas anteriores</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent group-hover:bg-accent/80 transition-colors">
                  <Activity className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Gerar laudo</p>
                  <p className="text-xs text-muted-foreground">A partir de ficha preenchida</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Atividade recente</h2>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
              <p className="text-xs text-muted-foreground mt-1">Crie sua primeira ficha para começar.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
