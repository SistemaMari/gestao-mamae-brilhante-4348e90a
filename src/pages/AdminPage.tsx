import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Users, Building2, UserPlus, ShieldCheck, FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminPage() {
  const [stats, setStats] = useState({ profissionais: 0, unidades: 0, convites: 0 });

  useEffect(() => {
    (async () => {
      const [profsRes, unitsRes, convitesRes] = await Promise.all([
        supabase.from('profissionais').select('id'),
        supabase.from('unidades').select('id'),
        supabase.from('convites').select('id').eq('status', 'pendente'),
      ]);
      setStats({
        profissionais: profsRes.data?.length || 0,
        unidades: unitsRes.data?.length || 0,
        convites: convitesRes.data?.length || 0,
      });
    })();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">Visão geral do sistema Dra. Mari DMG Diagnóstica</p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">Admin</Badge>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Profissionais" value={stats.profissionais} subtitle="cadastrados no sistema" icon={Users} />
            <StatCard title="Unidades" value={stats.unidades} subtitle="instituições ativas" icon={Building2} />
            <StatCard title="Convites pendentes" value={stats.convites} subtitle="aguardando aceite" icon={UserPlus} />
          </div>

          {/* Sections */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Profissionais recentes
              </h2>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Listagem será exibida aqui</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Unidades cadastradas
              </h2>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Listagem será exibida aqui</p>
              </div>
            </div>
          </div>

          {/* System log */}
          <div className="mt-4 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Log do sistema
            </h2>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente registrada</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
