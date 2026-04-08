import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserCog, Loader2 } from 'lucide-react';

interface PerfilData {
  nome: string;
  crm: string | null;
  especialidade: string | null;
  estado: string | null;
  pais: string | null;
}

const DUMMY_PROFILE: PerfilData = {
  nome: 'Dra. Mari Exemplo',
  crm: 'CRM 12345/SP',
  especialidade: 'Obstetrícia',
  estado: 'São Paulo',
  pais: 'Brasil',
};

const DUMMY_EMAIL = 'mari.exemplo@dramari.com';

export default function PerfilPage() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const [data, setData] = useState<PerfilData | null>(isPreview ? DUMMY_PROFILE : null);
  const [loading, setLoading] = useState(!isPreview);

  useEffect(() => {
    if (isPreview) {
      setData(DUMMY_PROFILE);
      setLoading(false);
      return;
    }

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      const { data: profileData } = await supabase
        .from('profissionais')
        .select('nome, crm, especialidade, estado, pais')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      setData(profileData as PerfilData | null);
      setLoading(false);
    };

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isPreview, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fields = [
    { label: 'Nome', value: data?.nome },
    { label: 'E-mail', value: isPreview ? DUMMY_EMAIL : user?.email },
    { label: 'Especialidade', value: data?.especialidade },
    { label: 'CRM', value: data?.crm },
    { label: 'Estado', value: data?.estado },
    { label: 'País', value: data?.pais },
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <UserCog className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edição de perfil será construída em breve.
        </p>

        {data && (
          <div className="mt-6 space-y-3 text-left">
            {fields.map((f) => (
              <div key={f.label} className="flex justify-between border-b border-border pb-2">
                <span className="text-sm text-muted-foreground">{f.label}</span>
                <span className="text-sm font-medium text-foreground">{f.value || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
