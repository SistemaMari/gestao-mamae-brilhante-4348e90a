import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PerfilCard, PerfilCardTitle } from './PerfilCard';
import CardAlterarSenha from './CardAlterarSenha';
import CardSuporte from '@/components/CardSuporte';

/**
 * Meu perfil do gestor geral. Os dados dele ficam em `gestores_gerais` (não em
 * `profissionais`), e o RLS só permite LER a própria linha: nome e
 * organizações são definidos pelo admin da MARI. Aqui ele vê os dados e troca
 * a própria senha.
 */
export default function PerfilGestorGeral({ userId, email }: { userId: string; email: string }) {
  const { t } = useTranslation();
  const [nome, setNome] = useState<string>('');
  const [organizacoes, setOrganizacoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: gg } = await supabase
        .from('gestores_gerais')
        .select('id, nome')
        .eq('user_id', userId)
        .maybeSingle();
      let orgs: string[] = [];
      if (gg?.id) {
        const { data: vinc } = await supabase
          .from('gestores_gerais_contratantes')
          .select('contratantes(nome)')
          .eq('gestor_geral_id', gg.id);
        orgs = ((vinc ?? []) as Array<{ contratantes: { nome: string } | null }>)
          .map((v) => v.contratantes?.nome)
          .filter((n): n is string => Boolean(n))
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }
      if (cancel) return;
      setNome(gg?.nome ?? '');
      setOrganizacoes(orgs);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [userId]);

  const iniciais = (nome || 'G G').split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('profile.generalManagerSubtitle')}</p>
      </header>

      <PerfilCard>
        <PerfilCardTitle icon={Building2}>{t('profile.linkedOrganizations')}</PerfilCardTitle>
        {organizacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('profile.noOrganizations')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {organizacoes.map((o) => (
              <li key={o} className="rounded-full bg-[#F5F0FF] px-3 py-1 text-sm font-medium text-[#7E69AB]">{o}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t('profile.generalManagerNote')}</p>
      </PerfilCard>

      <PerfilCard>
        <PerfilCardTitle icon={UserCog}>{t('profile.sectionProfile')}</PerfilCardTitle>
        <div className="mb-5 flex items-center gap-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full font-heading text-2xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#7E69AB,#9b87f5)' }}
          >
            {iniciais}
          </div>
          <p className="text-sm text-muted-foreground">{t('profile.generalManagerRole')}</p>
        </div>
        <div className="grid gap-4">
          <div>
            <Label>{t('profile.fullName')}</Label>
            <Input value={nome} disabled className="bg-muted" />
          </div>
          <div>
            <Label>{t('common.email')}</Label>
            <Input value={email} disabled className="bg-muted" />
          </div>
        </div>
      </PerfilCard>

      <CardAlterarSenha email={email} />

      <CardSuporte />
    </div>
  );
}
