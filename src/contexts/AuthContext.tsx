import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserProfile = 'consultorio' | 'institucional' | 'gestor' | 'gestor_geral' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function determineProfile(userId: string): Promise<UserProfile | null> {
  // 1. Verificar se é admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (admin) return 'admin';

  // 2. Verificar se é gestor geral
  const { data: gestorGeral } = await supabase
    .from('gestores_gerais')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (gestorGeral) return 'gestor_geral';

  // 3. Consultar tabela profissionais
  const { data: profissional } = await supabase
    .from('profissionais')
    .select('unidade_id, perfil_institucional')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profissional) return null; // Sem perfil vinculado

  if (!profissional.unidade_id) return 'consultorio';
  if (profissional.perfil_institucional === 'gestor') return 'gestor';
  return 'institucional';
}

export function getRedirectPath(profile: UserProfile): string {
  switch (profile) {
    case 'admin': return '/admin';
    case 'gestor_geral': return '/consolidar';
    case 'gestor': return '/gestao';
    default: return '/dashboard';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const p = await determineProfile(session.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Depois getSession
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const p = await determineProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'E-mail ou senha incorretos.' };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: 'Erro ao enviar e-mail de recuperação. Tente novamente.' };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
