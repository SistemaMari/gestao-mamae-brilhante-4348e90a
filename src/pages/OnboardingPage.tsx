import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Briefcase, Building2, Loader2, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function OnboardingPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [escolha, setEscolha] = useState<'consultorio' | 'institucional' | null>(null);

  const criarConsultorio = async () => {
    if (!user) return;
    setLoading(true);
    const nome = user.email?.split('@')[0] ?? 'Profissional';
    const { error } = await supabase.from('profissionais').insert({
      user_id: user.id,
      nome,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar seu perfil. Tente novamente.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Perfil criado', description: 'Complete seus dados profissionais agora.' });
    // Force reload para o AuthContext re-determinar o perfil
    window.location.href = '/completar-perfil';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Bem-vinda(o) à MARI DMG</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Como você vai usar a plataforma?
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className={`cursor-pointer p-6 transition-all hover:border-primary/50 hover:shadow-md ${
              escolha === 'consultorio' ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
            onClick={() => setEscolha('consultorio')}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 font-heading font-semibold text-foreground">Profissional autônomo</h3>
            <p className="text-sm text-muted-foreground">
              Sou médico(a) em consultório próprio, atendendo de forma individual.
            </p>
          </Card>

          <Card
            className={`cursor-pointer p-6 transition-all hover:border-primary/50 hover:shadow-md ${
              escolha === 'institucional' ? 'border-primary ring-2 ring-primary/20' : ''
            }`}
            onClick={() => setEscolha('institucional')}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mb-2 font-heading font-semibold text-foreground">Vou usar via instituição</h3>
            <p className="text-sm text-muted-foreground">
              Trabalho em uma clínica, hospital ou serviço público com equipe.
            </p>
          </Card>
        </div>

        {escolha === 'consultorio' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm text-muted-foreground">
              Vamos criar seu perfil de consultório. Em seguida, você completa CRM, especialidade e dados de contato.
            </p>
            <Button onClick={criarConsultorio} disabled={loading} className="w-full sm:w-auto">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando perfil...</> : 'Criar meu perfil de consultório'}
            </Button>
          </div>
        )}

        {escolha === 'institucional' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="mb-2 text-sm font-medium text-foreground">Você precisa receber um convite</p>
            <p className="mb-4 text-sm text-muted-foreground">
              O gestor da sua unidade deve enviar um convite por e-mail para vincular sua conta. Quando receber, basta acessar o link do convite.
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
