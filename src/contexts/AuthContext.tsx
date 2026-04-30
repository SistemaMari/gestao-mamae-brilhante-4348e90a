import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserProfile = 'consultorio' | 'institucional' | 'gestor' | 'gestor_geral' | 'admin';

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

const ROLE_PRIORITY: UserProfile[] = [
  'admin',
  'gestor_geral',
  'gestor',
  'institucional',
  'consultorio',
];

async function rolesFromUserRoles(userId: string): Promise<UserProfile[]> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (!error && data) {
      return (data.map((r) => r.role) as UserProfile[]) ?? [];
    }
    if (tentativa === 0) await new Promise((r) => setTimeout(r, 150));
  }
  return [];
}

async function determineProfile(userId: string): Promise<UserProfile | null> {
  // 1. Fonte oficial: user_roles (com prioridade fixa)
  const roles = await rolesFromUserRoles(userId);
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }

  // 2. Fallback legado: tabelas específicas — só se user_roles estiver vazio
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (admin) return 'admin';

  const { data: gestorGeral } = await supabase
    .from('gestores_gerais')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (gestorGeral) return 'gestor_geral';

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('unidade_id, perfil_institucional')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profissional) return null;
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
    let cancelado = false;

    const resolverPerfil = async (uid: string) => {
      try {
        const p = await determineProfile(uid);
        if (!cancelado) setProfile(p);
      } catch {
        if (!cancelado) setProfile(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    // Listener primeiro — NUNCA usar await dentro do callback (deadlock conhecido do Supabase Auth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Mantém loading=true até o profile ser resolvido — evita flash de /onboarding
          setLoading(true);
          // Defer chamadas Supabase para fora do callback
          setTimeout(() => {
            resolverPerfil(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Depois getSession
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        resolverPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelado = true;
      subscription.unsubscribe();
    };
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
      redirectTo: `${window.location.origin}/nova-senha`,
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
