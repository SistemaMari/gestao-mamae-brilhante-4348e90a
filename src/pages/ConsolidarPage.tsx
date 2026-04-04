import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Building2, Users, BarChart3, FileText, Clock } from 'lucide-react';

export default function ConsolidarPage() {
  const [stats, setStats] = useState({ unidades: 0, profissionais: 0 });

  useEffect(() => {
    (async () => {
      const [unitsRes, profsRes] = await Promise.all([
        supabase.from('unidades').select('id'),
        supabase.from('profissionais').select('id'),
      ]);
      setStats({
        unidades: unitsRes.data?.length || 0,
        profissionais: profsRes.data?.length || 0,
      });
    })();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-primary mb-1">
              <BarChart3 className="h-4 w-4" />
              <span>Gestor Geral</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Consolidação de Relatórios</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão consolidada de todas as unidades e profissionais
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Unidades" value={stats.unidades} subtitle="ativas no sistema" icon={Building2} />
            <StatCard title="Profissionais" value={stats.profissionais} subtitle="em todas as unidades" icon={Users} />
            <StatCard title="Relatórios" value={0} subtitle="gerados no período" icon={FileText} />
          </div>

          {/* Sections */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Unidades
              </h2>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Dados das unidades serão exibidos aqui</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Dados consolidados
              </h2>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Gráficos e métricas aparecerão aqui</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
