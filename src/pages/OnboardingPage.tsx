import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Briefcase, Building2, Loader2, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [escolha, setEscolha] = useState<'consultorio' | 'institucional' | null>(null);

  const criarConsultorio = async () => {
    if (!user) return;
    setLoading(true);
    const nome = user.email?.split('@')[0] ?? 'Profissional';
    const { data: planoInicial, error: planoErr } = await supabase
      .from('planos')
      .select('id')
      .eq('slug', 'inicial')
      .maybeSingle();
    if (planoErr || !planoInicial) {
      setLoading(false);
      toast({ title: t('onboarding.errorTitle'), description: t('onboarding.errorDesc'), variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('profissionais').insert({
      user_id: user.id,
      nome,
      plano_id: planoInicial.id,
    });
    setLoading(false);
    if (error) {
      toast({ title: t('onboarding.errorTitle'), description: t('onboarding.errorDesc'), variant: 'destructive' });
      return;
    }
    toast({ title: t('onboarding.profileCreatedTitle'), description: t('onboarding.profileCreatedDesc') });
    window.location.href = '/completar-perfil';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">{t('onboarding.welcome')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('onboarding.question')}
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
            <h3 className="mb-2 font-heading font-semibold text-foreground">{t('onboarding.autonomousTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('onboarding.autonomousDesc')}
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
            <h3 className="mb-2 font-heading font-semibold text-foreground">{t('onboarding.institutionalTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('onboarding.institutionalDesc')}
            </p>
          </Card>
        </div>

        {escolha === 'consultorio' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-sm text-muted-foreground">
              {t('onboarding.autonomousIntro')}
            </p>
            <Button onClick={criarConsultorio} disabled={loading} className="w-full sm:w-auto">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('onboarding.creatingProfile')}</> : t('onboarding.createProfile')}
            </Button>
          </div>
        )}

        {escolha === 'institucional' && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="mb-2 text-sm font-medium text-foreground">{t('onboarding.needInviteTitle')}</p>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('onboarding.needInviteDesc')}
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> {t('onboarding.signOut')}
            </Button>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('onboarding.signOutAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}

