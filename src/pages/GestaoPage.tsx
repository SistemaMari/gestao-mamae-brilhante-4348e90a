import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Users, FileText, UserPlus, ArrowRight, Building2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GestaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unidadeNome, setUnidadeNome] = useState('');
  const [totalProfissionais, setTotalProfissionais] = useState(0);
  const [convitesPendentes, setConvitesPendentes] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profissionais')
        .select('unidade_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!prof?.unidade_id) return;

      const [unidadeRes, profsRes, convitesRes] = await Promise.all([
        supabase.from('unidades').select('nome').eq('id', prof.unidade_id).single(),
        supabase.from('profissionais').select('id').eq('unidade_id', prof.unidade_id),
        supabase.from('convites').select('id').eq('unidade_id', prof.unidade_id).eq('status', 'pendente'),
      ]);

      setUnidadeNome(unidadeRes.data?.nome || '');
      setTotalProfissionais(profsRes.data?.length || 0);
      setConvitesPendentes(convitesRes.data?.length || 0);
    })();
  }, [user]);

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span>{unidadeNome || 'Carregando...'}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard de Gestão</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie sua unidade e equipe de profissionais
            </p>
          </div>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Profissionais ativos"
              value={totalProfissionais}
              subtitle="na sua unidade"
              icon={Users}
            />
            <StatCard
              title="Convites pendentes"
              value={convitesPendentes}
              subtitle="aguardando aceite"
              icon={UserPlus}
            />
            <StatCard
              title="Fichas da unidade"
              value={0}
              subtitle="total acumulado"
              icon={FileText}
            />
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Gestão da equipe</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate('/gestao/equipe')}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Gerenciar equipe</p>
                  <p className="text-sm text-muted-foreground">Ver membros, convidar e remover profissionais</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors">
                  <FileText className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Relatórios da unidade</p>
                  <p className="text-sm text-muted-foreground">Visualizar relatórios consolidados</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">Atividade recente da unidade</h2>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
              <p className="text-xs text-muted-foreground mt-1">A atividade dos profissionais aparecerá aqui.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
